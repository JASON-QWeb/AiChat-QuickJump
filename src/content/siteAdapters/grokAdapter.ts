import { extractPromptContent, type SiteAdapter, type PromptAnswerPair } from './index';

function getTopOffset(element: HTMLElement): number {
  const rect = element.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  return rect.top + scrollTop;
}

function isValidPromptNode(element: HTMLElement): boolean {
  if (element.querySelector('textarea, [contenteditable="true"], form')) {
    return false;
  }

  const text = element.textContent?.trim() || '';
  if (text.length > 0) return true;

  return !!element.querySelector('img, svg, canvas, pre, code');
}

function getCurrentGrokMessages(root: Document | HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll('[data-testid="user-message"], [data-testid="assistant-message"]'))
    .filter((el): el is HTMLElement => el instanceof HTMLElement);
}

/**
 * Grok AI 站点适配器
 * 支持 grok.com 的对话页面
 * 
 * URL 格式：
 * - 普通对话: https://grok.com/c/{conversation_id}
 * - 项目对话: https://grok.com/project/{project_id}?tab=...&chat={chat_id}
 */
export const grokAdapter: SiteAdapter = {
  name: 'Grok',
  
  /**
   * 判断是否是 Grok 对话页面
   */
  isSupported(location: Location): boolean {
    const { hostname, pathname, search } = location;
    
    // 检测是否是 Grok 域名
    if (hostname !== 'grok.com' && !hostname.endsWith('.grok.com')) {
      return false;
    }
    
    // 检测是否是对话页面
    // 1. 普通对话: /c/{id}
    // 2. 项目对话: /project/{id} 且 URL 参数包含 chat=
    const isConversationPage = pathname.startsWith('/c/');
    const isProjectChatPage = pathname.startsWith('/project/') && search.includes('chat=');
    
    return isConversationPage || isProjectChatPage;
  },

  /**
   * 获取页面中所有的「用户问题 + AI 回答」配对
   */
  getPromptAnswerPairs(root: Document | HTMLElement): PromptAnswerPair[] {
    const pairs: PromptAnswerPair[] = [];

    const allMessages = getCurrentGrokMessages(root);
    const currentUserMessages = allMessages.filter(message =>
      message.getAttribute('data-testid') === 'user-message' && isValidPromptNode(message)
    );

    if (currentUserMessages.length > 0) {
      currentUserMessages.forEach((userMsg, index) => {
        const msgIndex = allMessages.indexOf(userMsg);
        let answerNode = userMsg;

        for (let i = msgIndex + 1; i < allMessages.length; i++) {
          const nextMsg = allMessages[i];
          const testId = nextMsg.getAttribute('data-testid');

          if (testId === 'assistant-message') {
            answerNode = nextMsg;
            break;
          }
          if (testId === 'user-message') {
            break;
          }
        }

        pairs.push({
          id: `grok-turn-${index}`,
          promptNode: userMsg,
          promptText: extractPromptContent(userMsg),
          answerNode,
          topOffset: getTopOffset(userMsg)
        });
      });

      return pairs;
    }

    // Grok 可能使用的用户消息选择器
    const userMessageSelectors = [
      '[data-message-author-role="user"]',
      '.user-message',
      'div[class*="user"][class*="message"]',
      '[role="user"]',
      'div[data-sender="user"]',
      'div[data-role="user"]'
    ];

    let userMessages: HTMLElement[] = [];
    
    // 尝试各种选择器
    for (const selector of userMessageSelectors) {
      const found = root.querySelectorAll(selector);
      if (found.length > 0) {
        userMessages = Array.from(found)
          .filter((el): el is HTMLElement => el instanceof HTMLElement && isValidPromptNode(el));
        if (userMessages.length > 0) {
          break;
        }
      }
    }

    // 如果上述选择器都找不到，尝试通用策略
    if (userMessages.length === 0) {
      // 查找可能的消息容器，基于常见的 AI 聊天界面模式
      const allMessages = root.querySelectorAll('[class*="message"], [class*="chat"], [class*="turn"]');
      userMessages = Array.from(allMessages).filter(el => {
        const element = el as HTMLElement;
        // 尝试识别用户消息的特征
        const classList = element.className.toLowerCase();
        const hasUserIndicator = classList.includes('user') || 
                                 classList.includes('human') ||
                                 element.getAttribute('data-sender') === 'user' ||
                                 element.getAttribute('data-role') === 'user';
        
        // 确保有内容
        return hasUserIndicator && isValidPromptNode(element);
      }) as HTMLElement[];
    }

    // 构建配对
    userMessages.forEach((userMsg, index) => {
      const promptText = extractPromptContent(userMsg);
      
      pairs.push({
        id: `grok-legacy-turn-${index}`,
        promptNode: userMsg,
        promptText: promptText,
        answerNode: userMsg, // 暂时指向自己，跳转主要依赖 promptNode
        topOffset: getTopOffset(userMsg)
      });
    });

    return pairs;
  },

  /**
   * 快速获取问题数量
   */
  getPromptCount(root: Document | HTMLElement): number {
    const currentMessages = getCurrentGrokMessages(root).filter(message =>
      message.getAttribute('data-testid') === 'user-message' && isValidPromptNode(message)
    );
    if (currentMessages.length > 0) {
      return currentMessages.length;
    }

    const selectors = [
      '[data-message-author-role="user"]',
      '.user-message',
      'div[class*="user"][class*="message"]',
      '[role="user"]',
      'div[data-sender="user"]',
      'div[data-role="user"]'
    ].join(',');
    
    const elements = root.querySelectorAll(selectors);
    if (elements.length > 0) {
      return Array.from(elements).filter(el =>
        el instanceof HTMLElement && isValidPromptNode(el)
      ).length;
    }
    
    // 回退：尝试通用选择器
    const allMessages = root.querySelectorAll('[class*="message"], [class*="chat"], [class*="turn"]');
    let count = 0;
    
    for (let i = 0; i < allMessages.length; i++) {
      const el = allMessages[i] as HTMLElement;
      const classList = el.className.toLowerCase();
      if ((classList.includes('user') || classList.includes('human')) && isValidPromptNode(el)) {
        count++;
      }
    }
    
    return count;
  }
};
