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

function uniqueElements(elements: HTMLElement[]): HTMLElement[] {
  return Array.from(new Set(elements));
}

function getFirstValidElements(root: Document | HTMLElement, selectors: string[]): HTMLElement[] {
  for (const selector of selectors) {
    const found = Array.from(root.querySelectorAll(selector))
      .filter((el): el is HTMLElement => el instanceof HTMLElement && isValidPromptNode(el));

    if (found.length > 0) {
      return uniqueElements(found);
    }
  }

  return [];
}

/**
 * 通义千问（Qwen）站点适配器
 * 支持 qianwen.com/qwen.ai 的对话页面
 * 
 * URL 格式：
 * - 对话页面: https://www.qianwen.com/chat/{conversation_id}
 */
export const qwenAdapter: SiteAdapter = {
  name: 'Qwen',
  
  /**
   * 判断是否是通义千问对话页面
   */
  isSupported(location: Location): boolean {
    const { hostname } = location;
    
    // qwen.ai 可能在首页内通过 SPA 切到对话状态；无消息时不会显示 UI。
    return [
      'www.qianwen.com',
      'qianwen.com',
      'qwen.ai',
      'www.qwen.ai',
      'chat.qwen.ai'
    ].includes(hostname);
  },

  /**
   * 获取页面中所有的「用户问题 + AI 回答」配对
   */
  getPromptAnswerPairs(root: Document | HTMLElement): PromptAnswerPair[] {
    const pairs: PromptAnswerPair[] = [];

    // 通义千问的用户消息选择器
    const userMessageSelectors = [
      '[data-chat-question-wrap]',
      '.chat-question-wrap',
      '.message-card-wrap.question',
      '.questionItem-MPmrIl',
      '.content-YjXTeU',
      '.bubble-uo23is'
    ];

    const userMessages = getFirstValidElements(root, userMessageSelectors);

    // 构建配对
    userMessages.forEach((userMsg, index) => {
      const promptText = extractPromptContent(userMsg);
      
      const chatRound = userMsg.closest('.chat-round');
      const answerInRound = chatRound?.querySelector(
        '[data-chat-answers-wrap], .chat-answers-card-wrap, .answer-common-card, .message-card-wrap.answer, .qk-markdown'
      );
      let answerNode = answerInRound instanceof HTMLElement ? answerInRound : userMsg;

      if (answerNode === userMsg) {
        let nextSibling = userMsg.nextElementSibling;
        while (nextSibling) {
          const classList = (nextSibling as HTMLElement).className || '';
          if (classList.includes('answer') ||
              classList.includes('assistant') ||
              classList.includes('response')) {
            answerNode = nextSibling as HTMLElement;
            break;
          }
          nextSibling = nextSibling.nextElementSibling;
        }
      }
      
      pairs.push({
        id: `qwen-turn-${index}`,
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
      '[data-chat-question-wrap]',
      '.chat-question-wrap',
      '.message-card-wrap.question',
      '.questionItem-MPmrIl',
      '.content-YjXTeU',
      '.bubble-uo23is'
    ];

    return getFirstValidElements(root, selectors).length;
  }
};
