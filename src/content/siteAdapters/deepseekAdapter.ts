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

function getCurrentDeepSeekMessages(root: Document | HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll('.ds-message'))
    .filter((el): el is HTMLElement => el instanceof HTMLElement);
}

function isCurrentDeepSeekUserMessage(element: HTMLElement): boolean {
  return !element.querySelector('.ds-assistant-message-main-content') && isValidPromptNode(element);
}

function getLegacyUserMessages(root: Document | HTMLElement): HTMLElement[] {
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

  return Array.from(root.querySelectorAll(selectors))
    .filter((el): el is HTMLElement => el instanceof HTMLElement && isValidPromptNode(el));
}

export const deepseekAdapter: SiteAdapter = {
  name: 'DeepSeek',
  
  isSupported(location: Location): boolean {
    return location.hostname === 'chat.deepseek.com' ||
           location.hostname === 'www.chat.deepseek.com';
  },

  getPromptAnswerPairs(root: Document | HTMLElement): PromptAnswerPair[] {
    const pairs: PromptAnswerPair[] = [];

    // 当前 DeepSeek 使用 .ds-message，assistant 内容带有
    // .ds-assistant-message-main-content，用户问题没有该子节点。
    const allMessages = getCurrentDeepSeekMessages(root);
    const userMessages = allMessages.filter(isCurrentDeepSeekUserMessage);

    if (userMessages.length > 0) {
      userMessages.forEach((userMsg, index) => {
        const msgIndex = allMessages.indexOf(userMsg);
        let answerNode = userMsg;

        for (let i = msgIndex + 1; i < allMessages.length; i++) {
          const nextMsg = allMessages[i];
          if (nextMsg.querySelector('.ds-assistant-message-main-content')) {
            answerNode = nextMsg;
            break;
          }
          if (isCurrentDeepSeekUserMessage(nextMsg)) {
            break;
          }
        }

        pairs.push({
          id: `deepseek-turn-${index}`,
          promptNode: userMsg,
          promptText: extractPromptContent(userMsg),
          answerNode,
          topOffset: getTopOffset(userMsg)
        });
      });

      return pairs;
    }

    // 旧版 DOM fallback。
    getLegacyUserMessages(root).forEach((userMsg, index) => {
      pairs.push({
        id: `deepseek-legacy-turn-${index}`,
        promptNode: userMsg,
        promptText: extractPromptContent(userMsg),
        answerNode: userMsg,
        topOffset: getTopOffset(userMsg)
      });
    });

    return pairs;
  },

  /**
   * 快速获取问题数量
   */
  getPromptCount(root: Document | HTMLElement): number {
    const currentMessages = getCurrentDeepSeekMessages(root).filter(isCurrentDeepSeekUserMessage);
    if (currentMessages.length > 0) {
      return currentMessages.length;
    }

    return getLegacyUserMessages(root).length;
  }
};
