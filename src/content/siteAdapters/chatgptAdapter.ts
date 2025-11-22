import type { SiteAdapter, PromptAnswerPair } from './index';

/**
 * ChatGPT 站点适配器
 */
export const chatgptAdapter: SiteAdapter = {
  name: 'ChatGPT',
  
  /**
   * 判断是否是 ChatGPT 对话页面
   */
  isSupported(location: Location): boolean {
    const { hostname, pathname } = location;
    
    // 检测是否是 ChatGPT 域名
    const isChatGPT = hostname === 'chatgpt.com' || hostname === 'chat.openai.com';
    
    // 检测是否是对话页面（路径包含 /c/ 或者是根路径）
    const isConversationPage = pathname === '/' || pathname.startsWith('/c/');
    
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
     * 辅助函数：提取文本内容（去除多余空白）
     */
    const extractText = (element: HTMLElement): string => {
      return element.textContent?.trim().replace(/\s+/g, ' ') || '';
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
      
      // 排除太小的元素（例如空 div）
      const text = extractText(element);
      if (text.length < 1) {
        return false;
      }
      
      return true;
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
      const promptText = extractText(userMsg);
      
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
  }
};

