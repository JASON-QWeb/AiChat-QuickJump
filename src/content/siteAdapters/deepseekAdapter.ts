import { extractPromptContent, type SiteAdapter, type PromptAnswerPair } from './index';

export const deepseekAdapter: SiteAdapter = {
  name: 'DeepSeek',
  
  isSupported(location: Location): boolean {
    return location.hostname === 'chat.deepseek.com';
  },

  getPromptAnswerPairs(root: Document | HTMLElement): PromptAnswerPair[] {
    // 暂时复用 chatgpt 的逻辑，后续根据 deepseek 实际 DOM 结构调整
    // 假设 deepseek 的 DOM 结构可能与 ChatGPT 类似或者有其特定结构
    // 这里先使用一个通用的选择器策略
    // console.log('[LLM-Nav] DeepSeek Adapter scanning...');
    
    const pairs: PromptAnswerPair[] = [];
    
    // 尝试查找用户消息
    // DeepSeek 的 class 可能会变，建议使用 inspector 确认
    // 根据用户提供的 HTML，DeepSeek 使用 data-um-id 标记用户消息容器
    const userMessages = Array.from(root.querySelectorAll([
        'div[data-um-id]',
        '.ds-user-message', 
        '.user-message', 
        '[role="user"]',
        'div[class*="message"][class*="user"]', // 尝试模糊匹配
        '.ds-chat-message-user', // 另一种可能
        '.chat-message-user'
    ].join(',')));
    
    // console.log('[LLM-Nav] DeepSeek primary search found:', userMessages.length);

    if (userMessages.length === 0) {
      // 如果找不到，尝试复用 ChatGPT 的选择器（很多 LLM 网站结构相似）
      const chatgptLike = root.querySelectorAll('[data-message-author-role="user"]');
      if (chatgptLike.length > 0) {
        userMessages.push(...Array.from(chatgptLike));
      }
      // console.log('[LLM-Nav] DeepSeek fallback search found:', chatgptLike.length);
    }

    userMessages.forEach((msg, index) => {
      const element = msg as HTMLElement;
      const rect = element.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const topOffset = rect.top + scrollTop;

      pairs.push({
        id: `deepseek-turn-${index}`,
        promptNode: element,
        promptText: extractPromptContent(element),
        answerNode: element,
        topOffset
      });
    });

    return pairs;
  },

  /**
   * 快速获取问题数量
   */
  getPromptCount(root: Document | HTMLElement): number {
    const selectors = [
        'div[data-um-id]',
        '.ds-user-message', 
        '.user-message', 
        '[role="user"]',
        'div[class*="message"][class*="user"]',
        '.ds-chat-message-user',
        '.chat-message-user',
        '[data-message-author-role="user"]'
    ].join(',');
    return root.querySelectorAll(selectors).length;
  }
};

