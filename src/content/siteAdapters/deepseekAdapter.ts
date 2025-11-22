import type { SiteAdapter, PromptAnswerPair } from './index';

export const deepseekAdapter: SiteAdapter = {
  name: 'DeepSeek',
  
  isSupported(location: Location): boolean {
    return location.hostname === 'chat.deepseek.com';
  },

  getPromptAnswerPairs(root: Document | HTMLElement): PromptAnswerPair[] {
    // 暂时复用 chatgpt 的逻辑，后续根据 deepseek 实际 DOM 结构调整
    // 假设 deepseek 的 DOM 结构可能与 ChatGPT 类似或者有其特定结构
    // 这里先使用一个通用的选择器策略
    
    const pairs: PromptAnswerPair[] = [];
    
    // 尝试查找用户消息
    // DeepSeek 的 class 可能会变，建议使用 inspector 确认
    // 假设它也有类似的 user/assistant 角色区分
    // 这里先用一个比较通用的查询，实际需要根据 DeepSeek 页面调整
    const userMessages = Array.from(root.querySelectorAll('.ds-user-message, .user-message, [role="user"]'));
    
    if (userMessages.length === 0) {
      // 如果找不到，尝试复用 ChatGPT 的选择器（很多 LLM 网站结构相似）
      const chatgptLike = root.querySelectorAll('[data-message-author-role="user"]');
      if (chatgptLike.length > 0) {
        userMessages.push(...Array.from(chatgptLike));
      }
    }

    userMessages.forEach((msg, index) => {
      const element = msg as HTMLElement;
      const rect = element.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const topOffset = rect.top + scrollTop;

      pairs.push({
        id: `deepseek-turn-${index}`,
        promptNode: element,
        promptText: element.textContent?.trim() || '',
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
        '.ds-user-message', 
        '.user-message', 
        '[role="user"]',
        '[data-message-author-role="user"]'
    ].join(',');
    return root.querySelectorAll(selectors).length;
  }
};

