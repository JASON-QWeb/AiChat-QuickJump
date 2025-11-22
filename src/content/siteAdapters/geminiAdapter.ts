import type { SiteAdapter, PromptAnswerPair } from './index';

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
        promptText: element.textContent?.trim() || '',
        answerNode: element,
        topOffset
      });
    });

    console.log(`🔍 Gemini Adapter: 扫描到 ${pairs.length} 个用户问题`);
    return pairs;
  }
};

