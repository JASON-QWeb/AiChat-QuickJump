// Content Script
import { getActiveAdapter } from './siteAdapters/index';
import { AnswerIndexManager } from './navigation/answerIndexManager';
import { RightSideTimelineNavigator } from './navigation/rightSideTimelineNavigator';
import { scrollToAndHighlight } from './navigation/scrollAndHighlight';

let indexManager: AnswerIndexManager | null = null;
let timelineNavigator: RightSideTimelineNavigator | null = null;
let isInitializing = false; // 防止重复初始化
let initPromise: Promise<void> | null = null; // 存储当前初始化Promise
let isListLocked = false; // 标记列表是否已锁定（固定总数）
let isManualScrolling = false; // 标记是否正在进行点击导航滚动
let contentMutationObserver: MutationObserver | null = null; // 监听页面变化的观察器引用

/**
 * 防抖函数
 */
function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function(...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * 导航到指定的问题
 */
function navigateToAnswer(index: number): void {
  if (!indexManager) {
    return;
  }
  
  // 标记开始手动导航，暂时屏蔽滚动监听的干扰
  isManualScrolling = true;
  
  indexManager.setCurrentIndex(index);
  const node = indexManager.getCurrentNode();
  
  if (node) {
    // 使用滚动和高亮模块
    scrollToAndHighlight(node);
  }
  
  // 更新 UI 显示
  updateUI();
  
  // 1秒后释放锁（给足够的时间让滚动动画完成）
  setTimeout(() => {
    isManualScrolling = false;
  }, 1000);
}

/**
 * 导航到上一个问题
 */
function navigateToPrev(): void {
  if (!indexManager || indexManager.getTotalCount() === 0) {
    return;
  }
  
  // 如果已经在第一个，滚动到第一个的顶部
  if (indexManager.getCurrentIndex() === 0) {
    const node = indexManager.getCurrentNode();
    if (node) {
      scrollToAndHighlight(node);
    }
  } else {
    // 否则跳转到上一个
    if (indexManager.moveToPrev()) {
      navigateToAnswer(indexManager.getCurrentIndex());
    }
  }
}

/**
 * 导航到下一个问题
 */
function navigateToNext(): void {
  if (!indexManager || indexManager.getTotalCount() === 0) {
    return;
  }
  
  if (indexManager.moveToNext()) {
    navigateToAnswer(indexManager.getCurrentIndex());
  }
}

/**
 * 更新 UI 显示（现在只更新时间线）
 */
function updateUI(): void {
  // 同步更新时间线 active 状态
  if (timelineNavigator && indexManager) {
    timelineNavigator.updateActiveIndex(indexManager.getCurrentIndex());
  }
}

/**
 * 处理窗口 resize 事件
 */
const handleResize = debounce(() => {
  if (indexManager && timelineNavigator) {
    // 重新计算相对位置
    indexManager.refresh();
    
    // 刷新时间线节点位置
    timelineNavigator.refreshPositions();
  }
}, 300);

/**
 * 处理滚动事件
 */
const handleScroll = debounce(() => {
  // 如果正在执行点击导航，忽略滚动事件，防止覆盖目标索引
  if (isManualScrolling) {
    return;
  }

  if (indexManager) {
    indexManager.updateCurrentIndexByScroll(window.scrollY);
    updateUI();
  }
}, 100);

/**
 * 清理 UI
 * 在重新初始化或切换对话时调用，移除旧的时间线节点
 */
function clearUI(): void {
  if (timelineNavigator) {
    timelineNavigator.destroy();
    timelineNavigator = null;
  }

  // 断开 MutationObserver，防止重复监听
  if (contentMutationObserver) {
    contentMutationObserver.disconnect();
    contentMutationObserver = null;
  }
  
  // 移除事件监听器，防止内存泄漏
  document.removeEventListener('scroll', handleScroll, { capture: true } as any);
  window.removeEventListener('resize', handleResize);
  
  // 重置 indexManager，避免持有旧的 DOM 引用
  indexManager = null;
}

/**
 * 从 URL 或页面中获取对话 ID
 */
function getConversationId(): string {
  const pathname = window.location.pathname;
  
  // 尝试从 URL 匹配 /c/UUID
  const match = pathname.match(/\/c\/([a-zA-Z0-9-]+)/);
  if (match && match[1]) {
    return match[1];
  }
  
  // 如果是根路径，可能是新对话，尝试查找 meta 标签或特定元素
  // 这里暂时使用 pathname 作为 ID (例如 "/" 或 "/chat")
  // 为了避免不同新对话共享状态，最好能找到唯一标识
  // 但如果没有唯一标识，只能暂时不持久化或使用临时 ID
  return pathname === '/' ? 'new-chat' : pathname;
}

import type { ThemeMode } from './navigation/themes';

// ... existing imports ...

/**
 * 初始化时间线导航器
 */
function initTimelineNavigator(): void {
  if (!indexManager) return;
  
  // 再次确保旧的被清理
  if (timelineNavigator) {
    timelineNavigator.destroy();
  }
  
  timelineNavigator = new RightSideTimelineNavigator();
  
  // 1. 设置对话 ID
  const conversationId = getConversationId();
  timelineNavigator.setConversationId(conversationId);

  // 2. 加载并设置主题
  chrome.storage.sync.get(['ui_theme'], (result) => {
    const theme = (result.ui_theme as ThemeMode) || 'auto';
    if (timelineNavigator) {
      timelineNavigator.setTheme(theme);
    }
  });
  
  // 注册节点点击事件
  timelineNavigator.onNodeClick((itemIndex: number) => {
    // 复用 navigateToAnswer 函数，统一管理锁逻辑
    navigateToAnswer(itemIndex);
  });
  
  // 传入所有 Prompt-Answer 条目
  const items = indexManager.getItems();
  timelineNavigator.init(items);
  timelineNavigator.updateActiveIndex(indexManager.getCurrentIndex());
}

/**
 * 初始化导航功能
 */
async function init() {
  // 如果正在初始化，返回现有的Promise，避免并发
  if (isInitializing && initPromise) {
    return initPromise;
  }
  
  // 如果已经初始化但没有Promise，说明是重复调用
  if (isInitializing) {
    return;
  }
  
  // 创建初始化Promise
  initPromise = (async () => {
    // 先清理旧 UI，给用户一个"正在加载"的空白状态
    clearUI();
    
    isInitializing = true;
    
    try {
    // 从存储中加载自定义 URL
    const settings = await chrome.storage.sync.get(['custom_urls', 'enable_chatgpt', 'enable_claude', 'enable_gemini']);
    const customUrls = settings.custom_urls || [];
    
    // 获取当前页面适配的站点适配器
    const adapter = getActiveAdapter(window.location, customUrls);
    
    if (!adapter) {
      isInitializing = false;
      return;
    }
    
    // 检查是否在配置中启用了该站点
    let isEnabled = true;
    if (adapter.name === 'ChatGPT') {
        isEnabled = settings.enable_chatgpt !== false;
    } else if (adapter.name === 'Claude') {
        isEnabled = settings.enable_claude !== false;
    } else if (adapter.name === 'Gemini') {
        isEnabled = settings.enable_gemini !== false;
    }

    if (!isEnabled) {
      isInitializing = false;
      return;
    }
  
  // 旧的悬浮按钮导航已被时间线导航替代，此处代码已移除
  
  // 初始化索引管理器
  indexManager = new AnswerIndexManager(adapter, document);
  
  const totalCount = indexManager.getTotalCount();
  
  // 如果扫描到问题，立即锁定列表（不再自动刷新）
  if (totalCount > 0) {
    isListLocked = true;
    
    // 根据当前滚动位置设置初始索引
    indexManager.updateCurrentIndexByScroll(window.scrollY);
  } else {
    // 如果没有找到问题，不锁定，允许后续自动刷新
    isListLocked = false;
  }
  
  // 旧的 UI 更新已移除，使用时间线导航
  
  // ========== 初始化右侧时间线导航器 (仅当找到节点时) ==========
  if (totalCount > 0) {
    initTimelineNavigator();
  }
  // ========== 时间线初始化逻辑调整结束 ==========
  
  // 监听滚动事件
  // 使用 capture: true 捕获所有子元素的滚动事件（包括 ChatGPT 内部容器的滚动）
  document.addEventListener('scroll', handleScroll, { passive: true, capture: true });
  
  // 监听窗口 resize 事件
  window.addEventListener('resize', handleResize, { passive: true });
  
  // 智能刷新：支持新对话动态添加
  // 一旦扫描到问题，就锁定列表，但会检测数量增加的情况
  if (contentMutationObserver) {
    contentMutationObserver.disconnect();
    contentMutationObserver = null;
  }

  contentMutationObserver = new MutationObserver(debounce(() => {
    if (!indexManager) return;

    // 如果列表已锁定，检查是否是新消息（数量增加）
    if (isListLocked) {
      // 检测是否需要刷新（即实际数量是否发生变化）
      if (indexManager.needsRefresh()) {
        // 先获取旧的数量
        const oldCount = indexManager.getTotalCount();
        
        // 刷新数据
        indexManager.refresh();
        const newCount = indexManager.getTotalCount();
        
        // 如果数量增加了，说明有新对话
        if (newCount > oldCount) {
          // 重新初始化时间线（RightSideTimelineNavigator 会处理节点重绘和布局）
          initTimelineNavigator();
          
          // 自动滚动到底部（通常新消息在最下面）
          // 并选中最后一个节点
          indexManager.setCurrentIndex(newCount - 1);
          updateUI();
        }
      }
      return;
    }
    
    // 只有在问题数为0时才尝试刷新（说明页面可能还在加载）
    if (indexManager.getTotalCount() === 0) {
      if (indexManager.needsRefresh()) {
        indexManager.refresh();
        const newCount = indexManager.getTotalCount();
        
        if (newCount > 0) {
          // 找到问题后立即锁定
          isListLocked = true;
          indexManager.updateCurrentIndexByScroll(window.scrollY);
          
          // ============ 延迟初始化的时间线 ============
          initTimelineNavigator();
          // ========================================
          
          updateUI();
        }
      }
    }
  }, 1000));
  
  contentMutationObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // 如果初次扫描未找到问题，5秒后停止自动刷新
  if (totalCount === 0) {
    setTimeout(() => {
      if (!isListLocked) {
        isListLocked = true;
      }
    }, 5000);
  }
  
  } finally {
    isInitializing = false;
    initPromise = null; // 清除Promise引用
  }
  })();
  
  return initPromise;
}

// 监听 URL 变化（用于检测切换对话）
let lastUrl = window.location.href;
const urlObserver = new MutationObserver(() => {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    
    // 立即清理 UI，防止新旧节点混淆
    clearUI();
    
    // 解锁列表，允许新对话重新扫描
    isListLocked = false;
    
    // 延迟重新初始化，等待页面内容加载
    setTimeout(() => {
      init();
    }, 1000);
  }
});

// 监听整个文档的变化以检测 URL 改变
urlObserver.observe(document.documentElement, {
  childList: true,
  subtree: true
});

// 同时监听 popstate 事件（浏览器前进后退）
window.addEventListener('popstate', () => {
  setTimeout(() => {
    init();
  }, 500);
});

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// 监听来自 background 和 options 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'LLM_NAV_PREV_ANSWER') {
    navigateToPrev();
    sendResponse({ success: true });
  } else if (message.type === 'LLM_NAV_NEXT_ANSWER') {
    navigateToNext();
    sendResponse({ success: true });
  } else if (message.type === 'LLM_NAV_TOGGLE_UI') {
    if (timelineNavigator) {
      timelineNavigator.toggle();
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Timeline not initialized' });
    }
  } else if (message.type === 'LLM_NAV_UPDATE_THEME') {
    if (timelineNavigator) {
      timelineNavigator.setTheme(message.theme);
    }
    sendResponse({ success: true });
  } else if (message.type === 'LLM_NAV_TOGGLE_PIN') {
    if (timelineNavigator) {
      timelineNavigator.togglePinnedCurrent();
    }
    sendResponse({ success: true });
  }
  
  return true; // 保持消息通道打开
});
