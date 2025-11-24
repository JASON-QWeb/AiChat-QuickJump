import { extractPromptContent, type SiteAdapter, type PromptAnswerPair } from './index';

/**
 * 自定义/通用站点适配器
 * 用于用户在设置中添加的自定义网址
 * 尝试使用多种策略来识别对话内容
 */
export const customSiteAdapter: SiteAdapter = {
  name: 'Custom Site',
  
  // 这里的 isSupported 实际上由 index.ts 中的逻辑控制
  // 但为了接口完整性，我们返回 false，由 getActiveAdapter 显式调用
  isSupported: () => false,

  getPromptAnswerPairs(root: Document | HTMLElement): PromptAnswerPair[] {
    const pairs: PromptAnswerPair[] = [];
    let userMessages: HTMLElement[] = [];

    // 策略 1: ChatGPT 风格 (data-message-author-role)
    const chatgptStyle = root.querySelectorAll('[data-message-author-role="user"]');
    if (chatgptStyle.length > 0) {
      userMessages = Array.from(chatgptStyle) as HTMLElement[];
    }

    // 策略 2: Claude 风格
    if (userMessages.length === 0) {
      const claudeStyle = root.querySelectorAll('.font-user-message, [data-testid="user-message"]');
      if (claudeStyle.length > 0) {
        userMessages = Array.from(claudeStyle) as HTMLElement[];
      }
    }

    // 策略 3: Gemini 风格
    if (userMessages.length === 0) {
      const geminiStyle = root.querySelectorAll('user-query, .user-query');
      if (geminiStyle.length > 0) {
        userMessages = Array.from(geminiStyle) as HTMLElement[];
      }
    }

    // 策略 4: DeepSeek / 通用 Class 匹配
    if (userMessages.length === 0) {
      const genericSelectors = [
        '[role="user"]',
        '.user-message',
        '.message-user',
        '[class*="user-message"]',
        '[class*="UserMessage"]',
        // 一些开源 UI 库的常见模式
        '.chat-message-user'
      ];
      const genericNodes = root.querySelectorAll(genericSelectors.join(','));
      if (genericNodes.length > 0) {
        userMessages = Array.from(genericNodes) as HTMLElement[];
      }
    }

    // 过滤无效节点
    userMessages = userMessages.filter(el => {
      // 排除输入框
      if (el.querySelector('textarea, form, [contenteditable]')) return false;
      
      // 检查内容
      const text = el.textContent?.trim() || '';
      if (text.length > 0) return true;
      if (el.querySelector('img, svg, canvas, pre, code')) return true;
      
      return false;
    });

    userMessages.forEach((msg, index) => {
      const rect = msg.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const topOffset = rect.top + scrollTop;

      pairs.push({
        id: `custom-turn-${index}-${Date.now()}`,
        promptNode: msg,
        promptText: extractPromptContent(msg),
        answerNode: msg, // 暂时指向自己
        topOffset
      });
    });

    return pairs;
  },

  getPromptCount(root: Document | HTMLElement): number {
    // 简化版计数，尝试所有选择器
    const allSelectors = [
      '[data-message-author-role="user"]',
      '.font-user-message',
      '[data-testid="user-message"]',
      'user-query',
      '.user-query',
      '[role="user"]',
      '.user-message',
      '.message-user'
    ].join(',');
    
    return root.querySelectorAll(allSelectors).length;
  }
};

