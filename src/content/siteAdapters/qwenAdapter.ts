import { extractPromptContent, type SiteAdapter, type PromptAnswerPair } from './index';

/**
 * 通义千问（Qwen）站点适配器
 * 支持:
 * 1. qianwen.com (旧版)
 * 2. chat.qwen.ai (新版)
 */
export const qwenAdapter: SiteAdapter = {
  name: 'Qwen',
  
  /**
   * 判断是否是通义千问对话页面
   */
  isSupported(location: Location): boolean {
    const { hostname, pathname } = location;
    
    // 1. 检测 qianwen.com (旧版)
    if (hostname === 'qianwen.com' || hostname === 'www.qianwen.com') {
      return pathname.startsWith('/chat/');
    }

    // 2. 检测 chat.qwen.ai (新版)
    if (hostname === 'chat.qwen.ai' || hostname === 'www.chat.qwen.ai') {
      return true; // 新站点可能包含 /c/guest 或 /c/{uuid}
    }
    
    return false;
  },

  /**
   * 获取页面中所有的「用户问题 + AI 回答」配对
   */
  getPromptAnswerPairs(root: Document | HTMLElement): PromptAnswerPair[] {
    const hostname = window.location.hostname;

    if (hostname.includes('chat.qwen.ai')) {
      return getPairsForChatQwen(root);
    } else {
      return getPairsForQianwenCom(root);
    }
  },

  /**
   * 快速获取问题数量
   */
  getPromptCount(root: Document | HTMLElement): number {
    const hostname = window.location.hostname;
    
    if (hostname.includes('chat.qwen.ai')) {
      return root.querySelectorAll('.user-message-content').length;
    } else {
      return selectQianwenUserMessages(root).length;
    }
  }
};

/**
 * Helper: Select user messages for qianwen.com (Old)
 * Strategy: Try selectors in order, use the first one that matches, and filter valid nodes
 */
const qianwenUserMsgSelectors = [
  '.questionItem-MPmrIl',
  '.content-YjXTeU',
  '.bubble-uo23is'
];

function selectQianwenUserMessages(root: Document | HTMLElement): HTMLElement[] {
  for (const selector of qianwenUserMsgSelectors) {
    const found = root.querySelectorAll(selector);
    if (found.length > 0) {
      const validMessages = Array.from(found).filter(el => 
        el instanceof HTMLElement && isValidNode(el)
      ) as HTMLElement[];
      
      // If we found valid messages with this selector, return them
      if (validMessages.length > 0) {
        return validMessages;
      }
    }
  }
  return [];
}

/**
 * -----------------------------------------------------------------------------
 * Strategy for chat.qwen.ai (New)
 * -----------------------------------------------------------------------------
 */
function getPairsForChatQwen(root: Document | HTMLElement): PromptAnswerPair[] {
  const pairs: PromptAnswerPair[] = [];
  
  // 1. Find all user messages
  const userMessages = Array.from(root.querySelectorAll('.user-message-content'));

  if (userMessages.length === 0) {
    // Debug logging for troubleshooting
    // console.debug('[QwenAdapter] No user messages found with selector .user-message-content');
  }

  userMessages.forEach((userMsg, index) => {
    if (!(userMsg instanceof HTMLElement)) return;

    // 2. Find the corresponding AI message
    const answerNode = findAIMessageForChatQwen(userMsg) || userMsg;

    pairs.push({
      id: `qwen-chat-${index}-${Date.now()}`,
      promptNode: userMsg,
      promptText: extractPromptContent(userMsg),
      answerNode: answerNode as HTMLElement,
      topOffset: getTopOffset(userMsg)
    });
  });

  return pairs;
}

/**
 * Helper: Find AI message for chat.qwen.ai
 * Strategy: Sibling inference + Fallback
 */
function findAIMessageForChatQwen(userMessageEl: Element): Element | null {
  // Step 1: Find the container of the user message (Row container)
  // The user message is usually inside a container that has siblings (AI rows)
  const userContainer = userMessageEl.parentElement;

  if (!userContainer) {
    // console.debug('[QwenAdapter] User message container not found');
    return null;
  }

  // Step 2: Look for the next sibling (The AI Message Row)
  let nextSibling = userContainer.nextElementSibling;

  // Step 3: Traverse siblings to find the AI response
  while (nextSibling) {
    // If the sibling contains a user message, we've hit the next turn
    if (nextSibling.querySelector('.user-message-content')) {
      // console.debug('[QwenAdapter] Hit next user message, stopping search');
      return null;
    }

    // Check for explicit AI classes (if they exist/are known)
    const classList = nextSibling.className || '';
    if (/assistant|model|answer|ai-message|message-content/i.test(classList)) {
      // console.debug('[QwenAdapter] Found AI message by class match');
      return nextSibling;
    }

    // Fallback: If the sibling has text content or specific structure, assume it's AI
    // In "guest mode", classes might be minified or generic.
    // We assume the immediate next non-empty sibling row is the AI response.
    if (nextSibling.textContent?.trim() || nextSibling.querySelector('img, svg, .loading')) {
      // console.debug('[QwenAdapter] Found AI message by fallback (content existence)');
      return nextSibling;
    }

    nextSibling = nextSibling.nextElementSibling;
  }

  // console.debug('[QwenAdapter] No AI message found');
  return null;
}

/**
 * -----------------------------------------------------------------------------
 * Strategy for qianwen.com (Old)
 * -----------------------------------------------------------------------------
 */
function getPairsForQianwenCom(root: Document | HTMLElement): PromptAnswerPair[] {
  const pairs: PromptAnswerPair[] = [];
  
  // Use the shared selector logic
  const userMessages = selectQianwenUserMessages(root);

  userMessages.forEach((userMsg, index) => {
    // Try to find the AI answer (following the user message)
    let answerNode = userMsg;
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
    
    pairs.push({
      id: `qwen-turn-${index}-${Date.now()}`,
      promptNode: userMsg,
      promptText: extractPromptContent(userMsg),
      answerNode: answerNode,
      topOffset: getTopOffset(userMsg)
    });
  });

  return pairs;
}

/**
 * Common Helper: Calculate top offset
 */
const getTopOffset = (element: HTMLElement): number => {
  const rect = element.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  return rect.top + scrollTop;
};

/**
 * Common Helper: Check if node is valid
 */
const isValidNode = (element: HTMLElement): boolean => {
  if (element.querySelector('textarea') || 
      element.querySelector('[contenteditable="true"]') ||
      element.querySelector('form')) {
    return false;
  }
  
  const text = element.textContent?.trim() || '';
  if (text.length > 0) return true;
  
  if (element.querySelector('img, svg, canvas, pre, code')) {
    return true;
  }
  
  return false;
};
