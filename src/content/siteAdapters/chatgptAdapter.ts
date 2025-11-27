import { extractPromptContent, type SiteAdapter, type PromptAnswerPair } from './index';

/**
 * ChatGPT 站点适配器
 */
export const chatgptAdapter: SiteAdapter = {
  name: 'ChatGPT',
  
  /**
   * 判断是否是 ChatGPT 对话页面
   * 
   * 支持的 URL 格式：
   * - 根路径: https://chatgpt.com/
   * - 普通对话: https://chatgpt.com/c/{conversation_id}
   * - Project 对话: https://chatgpt.com/g/g-p-{project_id}/c/{conversation_id}
   */
  isSupported(location: Location): boolean {
    const { hostname, pathname } = location;
    
    // 检测是否是 ChatGPT 域名
    const isChatGPT = hostname === 'chatgpt.com' || hostname === 'chat.openai.com';
    
    // 检测是否是对话页面
    // 1. 根路径: /
    // 2. 普通对话: /c/
    // 3. Project 对话: /g/g-p-.../c/
    const isConversationPage = pathname === '/' || 
                               pathname.startsWith('/c/') ||
                               (pathname.startsWith('/g/') && pathname.includes('/c/'));
    
    return isChatGPT && isConversationPage;
  },

  /**
   * 获取页面中所有的「用户问题 + AI 回答」配对
   * 
   * 改进逻辑：
   * 1. 以用户问题 (role=user) 为核心锚点
   * 2. 只要找到用户问题，就生成一个条目
   * 3. 尝试在用户问题后面寻找对应的 AI 回答，如果找不到也不影响节点生成
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
      // 使用 extractPromptContent 的逻辑的简化版来判断存在性
      const text = element.textContent?.trim() || '';
      if (text.length > 0) return true;
      
      // 检查是否包含多媒体元素
      if (element.querySelector('img, svg, canvas, pre, code, [data-testid*="file"]')) {
        return true;
      }
      
      return false;
    };

    // 1. 获取所有带有 author-role 的消息元素
    const allMessages = Array.from(root.querySelectorAll('[data-message-author-role]'));
    
    // 2. 筛选出所有用户问题
    const userMessages = allMessages.filter(el => 
      el.getAttribute('data-message-author-role') === 'user' && 
      el instanceof HTMLElement && 
      isValidNode(el)
    ) as HTMLElement[];

    // 3. 为每个用户问题构建配对
    userMessages.forEach((userMsg, index) => {
      const promptText = extractPromptContent(userMsg);
      
      // 尝试查找对应的 assistant 回答
      // 逻辑：在 allMessages 中找到当前 userMsg 的位置，然后向后找最近的一个 assistant
      const msgIndex = allMessages.indexOf(userMsg);
      let answerNode = userMsg; // 默认 fallback 到 userMsg
      
      for (let i = msgIndex + 1; i < allMessages.length; i++) {
        const nextMsg = allMessages[i];
        const role = nextMsg.getAttribute('data-message-author-role');
        
        if (role === 'assistant') {
          answerNode = nextMsg as HTMLElement;
          break; // 找到第一个 assistant 就停止
        } else if (role === 'user') {
          break; // 如果遇到下一个 user，说明当前 prompt 没有回答（或结构断了），停止寻找
        }
      }

      // 构建配对对象
      pairs.push({
        id: `pair-${index}-${Date.now()}`,
        promptNode: userMsg,
        promptText: promptText,
        answerNode: answerNode, // 如果没找到回答，这里就是 promptNode 自身
        topOffset: getTopOffset(userMsg) // 关键：位置以 prompt 为准
      });
    });
    
    return pairs;
  },

  /**
   * 快速获取问题数量
   */
  getPromptCount(root: Document | HTMLElement): number {
    // 直接复用 getPromptAnswerPairs 中的核心选择器逻辑
    // 排除输入框等干扰项的简化版逻辑
    const allUserRoles = root.querySelectorAll('[data-message-author-role="user"]');
    let count = 0;
    
    for (let i = 0; i < allUserRoles.length; i++) {
      const el = allUserRoles[i] as HTMLElement;
      // 简单的可见性/有效性检查，尽量避免 offsetHeight/getBoundingClientRect
      // 这里只检查是否包含某些特定排除项
      if (el.querySelector('textarea') || el.querySelector('form')) {
        continue;
      }
      count++;
    }
    
    return count;
  }
};

