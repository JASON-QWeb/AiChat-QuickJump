import { extractPromptContent, type SiteAdapter, type PromptAnswerPair } from './index';

export const geminiAdapter: SiteAdapter = {
  name: 'Gemini',
  
  isSupported(location: Location): boolean {
    return location.hostname === 'gemini.google.com';
  },

  getPromptAnswerPairs(root: Document | HTMLElement): PromptAnswerPair[] {
    const pairs: PromptAnswerPair[] = [];
    
    // Gemini 的用户消息选择器
    const userSelectors = [
      'user-query', // 标签名
      '.user-query', // 类名
      '[data-test-id="user-query"]' // 属性
    ];
    
    const userMessages = Array.from(root.querySelectorAll(userSelectors.join(',')));

    userMessages.forEach((msg, index) => {
      const element = msg as HTMLElement;
      const rect = element.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const topOffset = rect.top + scrollTop;

      pairs.push({
        id: `gemini-turn-${index}`,
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
    const userSelectors = [
      'user-query', // 标签名
      '.user-query', // 类名
      '[data-test-id="user-query"]' // 属性
    ];
    // Gemini 的选择器比较明确，通常不需要额外的 filter
    return root.querySelectorAll(userSelectors.join(',')).length;
  }
};

