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

function getQuestionNodes(root: Document | HTMLElement): HTMLElement[] {
  const selectors = [
    '.conversation.question[id^="row-question-"]',
    '.conversation.question',
    '[id^="row-question-"]'
  ].join(',');

  return Array.from(root.querySelectorAll(selectors))
    .filter((el): el is HTMLElement => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.id.startsWith('row-question-p-')) return false;
      return isValidPromptNode(el);
    });
}

function getQuestionTextNode(questionNode: HTMLElement): HTMLElement {
  const textNode = questionNode.querySelector('.question-txt, [id^="row-question-p-"]');
  return textNode instanceof HTMLElement ? textNode : questionNode;
}

function findAnswerNode(questionNode: HTMLElement): HTMLElement {
  const questionId = questionNode.id || '';
  const questionIndex = questionId.match(/^row-question-(\d+)$/)?.[1];

  if (questionIndex) {
    const answerById = document.getElementById(`row-answer-${questionIndex}`);
    if (answerById instanceof HTMLElement) {
      return answerById;
    }
  }

  const item = questionNode.closest('.conversation-item');
  const answerInItem = item?.querySelector('.answer, [id^="row-answer-"]');
  if (answerInItem instanceof HTMLElement) {
    return answerInItem;
  }

  let nextSibling = questionNode.nextElementSibling;
  while (nextSibling) {
    if (nextSibling instanceof HTMLElement) {
      const classList = nextSibling.className || '';
      if (classList.includes('answer') || nextSibling.id.startsWith('row-answer-')) {
        return nextSibling;
      }
    }
    nextSibling = nextSibling.nextElementSibling;
  }

  return questionNode;
}

/**
 * 智谱清言（ChatGLM）站点适配器
 */
export const chatglmAdapter: SiteAdapter = {
  name: 'ChatGLM',

  isSupported(location: Location): boolean {
    return location.hostname === 'chatglm.cn' || location.hostname.endsWith('.chatglm.cn');
  },

  getPromptAnswerPairs(root: Document | HTMLElement): PromptAnswerPair[] {
    return getQuestionNodes(root).map((questionNode, index) => {
      const textNode = getQuestionTextNode(questionNode);

      return {
        id: `chatglm-turn-${index}`,
        promptNode: questionNode,
        promptText: extractPromptContent(textNode),
        answerNode: findAnswerNode(questionNode),
        topOffset: getTopOffset(questionNode)
      };
    });
  },

  getPromptCount(root: Document | HTMLElement): number {
    return getQuestionNodes(root).length;
  }
};
