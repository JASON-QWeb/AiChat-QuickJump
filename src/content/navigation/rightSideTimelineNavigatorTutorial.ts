import type { TimelineTheme } from './themes';

export type TutorialContext = {
  nodes: HTMLElement[];
  bottomStarsButton: HTMLElement | null;
  favoritesModal: HTMLElement | null;
  tutorialStep: 0 | 1 | 2 | 3 | 4 | 5;
  tutorialStartRequested: boolean;
  tutorialWaitingForFavoritesModal: boolean;
  tutorialBubble: HTMLDivElement | null;
  tutorialBubbleArrow: HTMLDivElement | null;
  tutorialBubbleTitle: HTMLDivElement | null;
  tutorialBubbleText: HTMLDivElement | null;
  tutorialBubblePrompt: HTMLDivElement | null;
  tutorialBubbleActions: HTMLDivElement | null;
  tutorialSkipConfirming: boolean;
  tutorialAnchor: HTMLElement | null;
  tutorialPlacement: 'left' | 'right' | 'top' | 'bottom';
  tutorialListeners: Array<{
    target: EventTarget;
    type: string;
    handler: EventListenerOrEventListenerObject;
    options?: AddEventListenerOptions | boolean;
  }>;
  tutorialTimeoutIds: number[];
  tutorialResizeHandler: (() => void) | null;
  currentTheme: TimelineTheme;
  t: (key: string) => string;
};

async function isTutorialEnabled(storageKey: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(storageKey, (result) => {
        if (chrome.runtime.lastError) {
          resolve(true);
          return;
        }

        const value = result[storageKey];
        resolve(value !== false);
      });
    } catch {
      resolve(true);
    }
  });
}

async function setTutorialEnabled(storageKey: string, enabled: boolean): Promise<void> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set({ [storageKey]: enabled }, () => resolve());
    } catch {
      resolve();
    }
  });
}

export function maybeStartTutorial(ctx: TutorialContext, storageKey: string): void {
  if (ctx.tutorialStartRequested) return;
  if (ctx.nodes.length === 0) return;

  ctx.tutorialStartRequested = true;
  void (async () => {
    const enabled = await isTutorialEnabled(storageKey);
    if (!enabled) return;

    // 触发后即标记为 false，确保仅出现一次
    await setTutorialEnabled(storageKey, false);

    window.setTimeout(() => {
      if (!ctx.nodes[0] || !ctx.nodes[0].isConnected) return;
      startTutorialStep1(ctx);
    }, 250);
  })();
}

function addTutorialListener(
  ctx: TutorialContext,
  target: EventTarget,
  type: string,
  handler: EventListenerOrEventListenerObject,
  options?: AddEventListenerOptions | boolean
): void {
  target.addEventListener(type, handler, options);
  ctx.tutorialListeners.push({ target, type, handler, options });
}

function clearTutorialListeners(ctx: TutorialContext): void {
  ctx.tutorialListeners.forEach(({ target, type, handler, options }) => {
    try {
      target.removeEventListener(type, handler, options as any);
    } catch {
      // ignore
    }
  });
  ctx.tutorialListeners = [];
}

function clearTutorialTimeouts(ctx: TutorialContext): void {
  ctx.tutorialTimeoutIds.forEach((id) => window.clearTimeout(id));
  ctx.tutorialTimeoutIds = [];
}

export function endTutorial(ctx: TutorialContext): void {
  clearTutorialTimeouts(ctx);
  clearTutorialListeners(ctx);
  ctx.tutorialWaitingForFavoritesModal = false;
  ctx.tutorialSkipConfirming = false;
  ctx.tutorialStep = 0;
  ctx.tutorialAnchor = null;

  if (ctx.tutorialResizeHandler) {
    window.removeEventListener('resize', ctx.tutorialResizeHandler);
    ctx.tutorialResizeHandler = null;
  }

  if (ctx.tutorialBubble) {
    ctx.tutorialBubble.remove();
    ctx.tutorialBubble = null;
    ctx.tutorialBubbleArrow = null;
    ctx.tutorialBubbleTitle = null;
    ctx.tutorialBubbleText = null;
    ctx.tutorialBubblePrompt = null;
    ctx.tutorialBubbleActions = null;
  }
}

function showTutorialBubble(
  ctx: TutorialContext,
  opts: {
    step: 1 | 2 | 3 | 4 | 5;
    target: HTMLElement;
    placement: 'left' | 'right' | 'top' | 'bottom';
    message: string;
  }
): void {
  ctx.tutorialSkipConfirming = false;
  ctx.tutorialAnchor = opts.target;
  ctx.tutorialPlacement = opts.placement;

  if (!ctx.tutorialBubble) {
    const bubble = document.createElement('div');
    bubble.className = 'llm-tutorial-bubble';
    Object.assign(bubble.style, {
      position: 'fixed',
      zIndex: '2147483650',
      maxWidth: '320px',
      minWidth: '220px',
      padding: '12px 12px 10px 12px',
      borderRadius: '12px',
      backgroundColor: ctx.currentTheme.tooltipBackgroundColor,
      color: ctx.currentTheme.tooltipTextColor,
      border: '1px solid rgba(128,128,128,0.25)',
      boxShadow: '0 6px 24px rgba(0,0,0,0.32)',
      fontSize: '13px',
      lineHeight: '1.45'
    });

    const arrow = document.createElement('div');
    Object.assign(arrow.style, {
      position: 'absolute',
      width: '0',
      height: '0'
    });

    const title = document.createElement('div');
    Object.assign(title.style, {
      fontWeight: '700',
      fontSize: '12px',
      opacity: '0.85',
      marginBottom: '6px'
    });

    const text = document.createElement('div');
    Object.assign(text.style, {
      marginBottom: '8px',
      whiteSpace: 'pre-wrap'
    });

    const prompt = document.createElement('div');
    Object.assign(prompt.style, {
      display: 'none',
      fontSize: '12px',
      opacity: '0.75',
      marginBottom: '8px'
    });

    const actions = document.createElement('div');
    Object.assign(actions.style, {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '8px'
    });

    bubble.appendChild(arrow);
    bubble.appendChild(title);
    bubble.appendChild(text);
    bubble.appendChild(prompt);
    bubble.appendChild(actions);

    document.body.appendChild(bubble);

    ctx.tutorialBubble = bubble;
    ctx.tutorialBubbleArrow = arrow;
    ctx.tutorialBubbleTitle = title;
    ctx.tutorialBubbleText = text;
    ctx.tutorialBubblePrompt = prompt;
    ctx.tutorialBubbleActions = actions;

    ctx.tutorialResizeHandler = () => positionTutorialBubble(ctx);
    window.addEventListener('resize', ctx.tutorialResizeHandler);
  }

  if (!ctx.tutorialBubbleTitle || !ctx.tutorialBubbleText || !ctx.tutorialBubblePrompt) return;

  ctx.tutorialBubbleTitle.textContent = `${ctx.t('tutorial.title')} (${opts.step}/5)`;
  ctx.tutorialBubbleText.textContent = opts.message;
  ctx.tutorialBubblePrompt.style.display = 'none';
  ctx.tutorialBubblePrompt.textContent = '';

  renderTutorialActions(ctx);
  positionTutorialBubble(ctx);
  requestAnimationFrame(() => positionTutorialBubble(ctx));
}

function renderTutorialActions(ctx: TutorialContext): void {
  if (!ctx.tutorialBubbleActions || !ctx.tutorialBubblePrompt) return;
  const actions = ctx.tutorialBubbleActions;
  actions.innerHTML = '';
  ctx.tutorialBubblePrompt.textContent = '';
  ctx.tutorialBubblePrompt.style.display = 'none';

  const baseBtnStyle: Partial<CSSStyleDeclaration> = {
    padding: '6px 10px',
    borderRadius: '10px',
    border: '1px solid rgba(128,128,128,0.3)',
    backgroundColor: 'transparent',
    color: ctx.currentTheme.tooltipTextColor,
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'all 0.2s ease'
  };

  const primaryBtnStyle: Partial<CSSStyleDeclaration> = {
    ...baseBtnStyle,
    border: 'none',
    backgroundColor: ctx.currentTheme.activeColor,
    color: '#fff'
  };

  const createBtn = (label: string, style: Partial<CSSStyleDeclaration>) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    Object.assign(btn.style, style);
    btn.addEventListener('mouseenter', () => {
      btn.style.filter = 'brightness(0.95)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.filter = 'none';
    });
    return btn;
  };

  if (!ctx.tutorialSkipConfirming) {
    const skipBtn = createBtn(ctx.t('tutorial.skip'), baseBtnStyle);
    skipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      ctx.tutorialSkipConfirming = true;
      renderTutorialActions(ctx);
    });
    actions.appendChild(skipBtn);
    return;
  }

  ctx.tutorialBubblePrompt.textContent = ctx.t('tutorial.skipConfirm');
  ctx.tutorialBubblePrompt.style.display = 'block';

  const cancelBtn = createBtn(ctx.t('favorites.cancel'), baseBtnStyle);
  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    ctx.tutorialSkipConfirming = false;
    renderTutorialActions(ctx);
  });

  const confirmBtn = createBtn(ctx.t('favorites.confirm'), primaryBtnStyle);
  confirmBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    endTutorial(ctx);
  });

  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
}

function positionTutorialBubble(ctx: TutorialContext): void {
  if (!ctx.tutorialBubble || !ctx.tutorialBubbleArrow || !ctx.tutorialAnchor) return;
  if (!ctx.tutorialAnchor.isConnected) return;

  const targetRect = ctx.tutorialAnchor.getBoundingClientRect();
  const bubbleRect = ctx.tutorialBubble.getBoundingClientRect();
  const gap = 12;
  const margin = 10;

  let left = 0;
  let top = 0;

  const placement = ctx.tutorialPlacement;
  if (placement === 'left') {
    left = targetRect.left - bubbleRect.width - gap;
    top = targetRect.top + targetRect.height / 2 - bubbleRect.height / 2;
  } else if (placement === 'right') {
    left = targetRect.right + gap;
    top = targetRect.top + targetRect.height / 2 - bubbleRect.height / 2;
  } else if (placement === 'top') {
    left = targetRect.left + targetRect.width / 2 - bubbleRect.width / 2;
    top = targetRect.top - bubbleRect.height - gap;
  } else {
    left = targetRect.left + targetRect.width / 2 - bubbleRect.width / 2;
    top = targetRect.bottom + gap;
  }

  left = Math.max(margin, Math.min(left, window.innerWidth - bubbleRect.width - margin));
  top = Math.max(margin, Math.min(top, window.innerHeight - bubbleRect.height - margin));

  ctx.tutorialBubble.style.left = `${left}px`;
  ctx.tutorialBubble.style.top = `${top}px`;

  const bg = ctx.currentTheme.tooltipBackgroundColor;
  const arrow = ctx.tutorialBubbleArrow;
  arrow.style.border = '';
  arrow.style.left = '';
  arrow.style.right = '';
  arrow.style.top = '';
  arrow.style.bottom = '';

  const arrowSize = 8;
  if (placement === 'left') {
    Object.assign(arrow.style, {
      borderTop: `${arrowSize}px solid transparent`,
      borderBottom: `${arrowSize}px solid transparent`,
      borderLeft: `${arrowSize}px solid ${bg}`,
      right: `-${arrowSize}px`,
      top: `${bubbleRect.height / 2 - arrowSize}px`
    });
  } else if (placement === 'right') {
    Object.assign(arrow.style, {
      borderTop: `${arrowSize}px solid transparent`,
      borderBottom: `${arrowSize}px solid transparent`,
      borderRight: `${arrowSize}px solid ${bg}`,
      left: `-${arrowSize}px`,
      top: `${bubbleRect.height / 2 - arrowSize}px`
    });
  } else if (placement === 'top') {
    Object.assign(arrow.style, {
      borderLeft: `${arrowSize}px solid transparent`,
      borderRight: `${arrowSize}px solid transparent`,
      borderTop: `${arrowSize}px solid ${bg}`,
      bottom: `-${arrowSize}px`,
      left: `${bubbleRect.width / 2 - arrowSize}px`
    });
  } else {
    Object.assign(arrow.style, {
      borderLeft: `${arrowSize}px solid transparent`,
      borderRight: `${arrowSize}px solid transparent`,
      borderBottom: `${arrowSize}px solid ${bg}`,
      top: `-${arrowSize}px`,
      left: `${bubbleRect.width / 2 - arrowSize}px`
    });
  }
}

function startTutorialStep1(ctx: TutorialContext): void {
  const firstNode = ctx.nodes[0];
  if (!firstNode) return;
  ctx.tutorialStep = 1;

  showTutorialBubble(ctx, {
    step: 1,
    target: firstNode,
    placement: 'left',
    message: ctx.t('tutorial.step1')
  });

  const onHover = () => {
    if (ctx.tutorialStep !== 1) return;
    startTutorialStep2(ctx);
  };
  addTutorialListener(ctx, firstNode, 'mouseenter', onHover, { once: true });

  // 如果已在 hover 状态，视作完成
  ctx.tutorialTimeoutIds.push(
    window.setTimeout(() => {
      if (ctx.tutorialStep === 1 && firstNode.matches(':hover')) {
        startTutorialStep2(ctx);
      }
    }, 250)
  );
}

function startTutorialStep2(ctx: TutorialContext): void {
  const btn = ctx.bottomStarsButton;
  if (!btn) {
    endTutorial(ctx);
    return;
  }

  ctx.tutorialStep = 2;
  showTutorialBubble(ctx, {
    step: 2,
    target: btn,
    placement: 'left',
    message: ctx.t('tutorial.step2')
  });

  const onClick = () => {
    if (ctx.tutorialStep !== 2) return;
    ctx.tutorialWaitingForFavoritesModal = true;
    ctx.tutorialStep = 3;
    // 等收藏弹窗打开后再显示下一步
    if (ctx.tutorialResizeHandler) {
      window.removeEventListener('resize', ctx.tutorialResizeHandler);
      ctx.tutorialResizeHandler = null;
    }
    if (ctx.tutorialBubble) {
      ctx.tutorialBubble.remove();
      ctx.tutorialBubble = null;
      ctx.tutorialBubbleArrow = null;
      ctx.tutorialBubbleTitle = null;
      ctx.tutorialBubbleText = null;
      ctx.tutorialBubblePrompt = null;
      ctx.tutorialBubbleActions = null;
    }
  };

  addTutorialListener(ctx, btn, 'click', onClick, { once: true, capture: true });
}

export function maybeContinueTutorialAfterFavoritesModalOpened(ctx: TutorialContext): void {
  if (ctx.tutorialStep !== 3 || !ctx.tutorialWaitingForFavoritesModal) return;
  ctx.tutorialWaitingForFavoritesModal = false;

  const modal = ctx.favoritesModal;
  if (!modal) return;

  const header = modal.querySelector('.llm-tutorial-favorites-header') as HTMLElement | null;
  const content = modal.querySelector('.llm-tutorial-favorites-content') as HTMLElement | null;
  const target = header || content;
  if (!target) return;

  startTutorialStep3(ctx, target);
}

function startTutorialStep3(ctx: TutorialContext, target: HTMLElement): void {
  ctx.tutorialStep = 3;
  showTutorialBubble(ctx, {
    step: 3,
    target,
    placement: 'top',
    message: ctx.t('tutorial.step3')
  });

  // 给用户读一会儿，再提示归档入口
  ctx.tutorialTimeoutIds.push(
    window.setTimeout(() => {
      if (ctx.tutorialStep === 3) startTutorialStep4(ctx);
    }, 3000)
  );
}

function startTutorialStep4(ctx: TutorialContext): void {
  const modal = ctx.favoritesModal;
  if (!modal) {
    endTutorial(ctx);
    return;
  }

  const flipBtn = modal.querySelector('.llm-tutorial-flip-archive') as HTMLElement | null;
  if (!flipBtn) {
    endTutorial(ctx);
    return;
  }

  ctx.tutorialStep = 4;
  showTutorialBubble(ctx, {
    step: 4,
    target: flipBtn,
    placement: 'bottom',
    message: ctx.t('tutorial.step4')
  });

  const onClick = () => {
    if (ctx.tutorialStep !== 4) return;
    // 等翻转动画结束再展示下一步
    ctx.tutorialTimeoutIds.push(
      window.setTimeout(() => {
        if (ctx.tutorialStep === 4) startTutorialStep5(ctx);
      }, 650)
    );
  };
  addTutorialListener(ctx, flipBtn, 'click', onClick, { once: true });
}

function startTutorialStep5(ctx: TutorialContext): void {
  const modal = ctx.favoritesModal;
  if (!modal) {
    endTutorial(ctx);
    return;
  }

  const settingsBtn =
    (modal.querySelector('.llm-favorites-settings-btn[data-tutorial-side="back"]') as HTMLElement | null) ||
    (modal.querySelector('.llm-favorites-settings-btn') as HTMLElement | null);
  if (!settingsBtn) {
    endTutorial(ctx);
    return;
  }

  ctx.tutorialStep = 5;
  showTutorialBubble(ctx, {
    step: 5,
    target: settingsBtn,
    placement: 'top',
    message: ctx.t('tutorial.step5')
  });

  const onClick = () => {
    if (ctx.tutorialStep !== 5) return;
    endTutorial(ctx);
  };
  addTutorialListener(ctx, settingsBtn, 'click', onClick, { once: true, capture: true });
}
