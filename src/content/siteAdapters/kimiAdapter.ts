import { extractPromptContent, type SiteAdapter, type PromptAnswerPair } from './index';

/**
 * Kimi（月之暗面）站点适配器
 * 支持 kimi.com 的对话页面
 * 
 * URL 格式：
 * - 对话页面: https://www.kimi.com/chat/{conversation_id}
 */
export const kimiAdapter: SiteAdapter = {
  name: 'Kimi',
  
  /**
   * 判断是否是 Kimi 对话页面
   */
  isSupported(location: Location): boolean {
    const { hostname, pathname } = location;
    
    // 检测是否是 Kimi 域名
    if (hostname !== 'www.kimi.com' && hostname !== 'kimi.com') {
      return false;
    }
    
    // 检测是否是对话页面
    return pathname.startsWith('/chat/');
  },

  /**
   * 获取页面中所有的「用户问题 + AI 回答」配对
   */
  getPromptAnswerPairs(root: Document | HTMLElement): PromptAnswerPair[] {
    const pairs: PromptAnswerPair[] = [];
    
    /**
     * 辅助函数：计算元素相对于文档顶部的偏移量
     */
    const getTopOffset = (element: HTMLElement): number => {
      const rect = element.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      return rect.top + scrollTop;
    };

    /**
     * 辅助函数：检查是否是有效的对话节点
     */
    const isValidNode = (element: HTMLElement): boolean => {
      // 排除输入框区域
      if (element.querySelector('textarea') || 
          element.querySelector('[contenteditable="true"]') ||
          element.querySelector('form')) {
        return false;
      }
      
      // 只要有文本内容或特殊元素（图片、图表等），就视为有效
      const text = element.textContent?.trim() || '';
      if (text.length > 0) return true;
      
      // 检查是否包含多媒体元素
      if (element.querySelector('img, svg, canvas, pre, code')) {
        return true;
      }
      
      return false;
    };

    // Kimi 的用户消息选择器
    // 根据 HTML 结构，用户消息在 .chat-content-item-user 内
    const userMessageSelectors = [
      '.chat-content-item-user',  // 主要选择器
      '.segment-user',             // 备选选择器
      '.segment-container',        // 容器选择器
      '.user-content'              // 内容选择器
    ];

    let userMessages: HTMLElement[] = [];
    
    // 尝试各种选择器
    for (const selector of userMessageSelectors) {
      const found = root.querySelectorAll(selector);
      if (found.length > 0) {
        userMessages = Array.from(found).filter(el => 
          el instanceof HTMLElement && isValidNode(el)
        ) as HTMLElement[];
        if (userMessages.length > 0) {
          break;
        }
      }
    }

    // 构建配对
    userMessages.forEach((userMsg, index) => {
      const promptText = extractPromptContent(userMsg);
      
      // 尝试查找对应的 AI 回答（在用户消息后面）
      let answerNode = userMsg;
      let nextSibling = userMsg.nextElementSibling;
      while (nextSibling) {
        // 查找可能的 AI 回答容器（通常有 assistant 或 ai 相关的 class）
        const classList = (nextSibling as HTMLElement).className || '';
        if (classList.includes('assistant') || 
            classList.includes('ai') ||
            classList.includes('chat-content-item-assistant') ||
            classList.includes('segment-assistant')) {
          answerNode = nextSibling as HTMLElement;
          break;
        }
        nextSibling = nextSibling.nextElementSibling;
      }
      
      pairs.push({
        id: `kimi-turn-${index}-${Date.now()}`,
        promptNode: userMsg,
        promptText: promptText,
        answerNode: answerNode,
        topOffset: getTopOffset(userMsg)
      });
    });

    return pairs;
  },

  /**
   * 快速获取问题数量
   */
  getPromptCount(root: Document | HTMLElement): number {
    const selectors = [
      '.chat-content-item-user',
      '.segment-user',
      '.segment-container',
      '.user-content'
    ].join(',');
    
    const elements = root.querySelectorAll(selectors);
    let count = 0;
    
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i] as HTMLElement;
      // 简单的有效性检查
      if (el.querySelector('textarea') || el.querySelector('form')) {
        continue;
      }
      count++;
    }
    
    return count;
  }
};

