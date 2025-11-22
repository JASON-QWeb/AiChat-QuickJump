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
let currentInitId = 0; // 初始化版本控制，防止竞态条件

// Settings Cache
let cachedSettings: { [key: string]: any } | null = null;

async function getSettings() {
  if (cachedSettings) return cachedSettings;
  cachedSettings = await chrome.storage.sync.get([
    'custom_urls', 
    'enable_chatgpt', 
    'enable_claude', 
    'enable_gemini',
    'enable_deepseek',
    'ui_theme'
  ]);
  return cachedSettings;
}

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync') {
    if (cachedSettings) {
      for (const key in changes) {
        cachedSettings[key] = changes[key].newValue;
      }
    }
    
    // Real-time theme update
    if (changes.ui_theme && timelineNavigator) {
      timelineNavigator.setTheme(changes.ui_theme.newValue || 'auto');
    }
  }
});

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
  
  // 1. 禁用 Observer 自动更新
  // 防止自动滚动过程中 IntersectionObserver 错误地更新索引
  indexManager.setScrollUpdateEnabled(false);
  isManualScrolling = true;
  
  // 2. 设置索引并执行滚动
  indexManager.setCurrentIndex(index);
  const node = indexManager.getCurrentNode();
  
  if (node) {
    scrollToAndHighlight(node);
  }
  
  // 3. 更新 UI 显示
  updateUI();
  
  // 4. 恢复逻辑：监听用户交互或超时
  // 定义恢复函数
  const restoreScrollTracking = () => {
    if (!indexManager) return;
    
    isManualScrolling = false;
    indexManager.setScrollUpdateEnabled(true);
    
    // 移除监听器
    cleanupListeners();
  };
  
  // 监听用户交互事件（一旦用户手动介入，立即恢复跟踪）
  const userInteractionEvents = ['wheel', 'touchmove', 'keydown', 'mousedown'];
  const cleanupListeners = () => {
    userInteractionEvents.forEach(event => {
      window.removeEventListener(event, restoreScrollTracking, { capture: true });
    });
  };
  
  userInteractionEvents.forEach(event => {
    window.addEventListener(event, restoreScrollTracking, { capture: true, passive: true });
  });
  
  // 5. 保底机制：如果用户一直不操作，1秒后自动恢复
  // 考虑到平滑滚动可能需要时间，1秒通常足够
  setTimeout(() => {
    // 只有当仍然处于手动滚动状态时才恢复，避免覆盖了用户的早期介入
    if (isManualScrolling) {
      restoreScrollTracking();
    }
  }, 1000);
}

/**
 * 导航到上一个问题
 */
function navigateToPrev(): void {
  if (!indexManager || indexManager.getTotalCount() === 0) {
    return;
  }
  
  const currentIndex = indexManager.getCurrentIndex();
  // 即使已经是第一个（index 0），也执行跳转（相当于滚动到顶部）
  // 使用 Math.max 确保不小于 0
  const targetIndex = Math.max(0, currentIndex - 1);
  
  // 统一使用 navigateToAnswer 以复用滚动锁定逻辑
  navigateToAnswer(targetIndex);
}

/**
 * 导航到下一个问题
 */
function navigateToNext(): void {
  if (!indexManager || indexManager.getTotalCount() === 0) {
    return;
  }
  
  const currentIndex = indexManager.getCurrentIndex();
  const total = indexManager.getTotalCount();
  
  // 只有当不是最后一个时才跳转
  if (currentIndex < total - 1) {
    // 统一使用 navigateToAnswer 以复用滚动锁定逻辑
    navigateToAnswer(currentIndex + 1);
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
  // 如果正在执行点击导航，忽略滚动事件
  if (isManualScrolling) {
    return;
  }

  // 仅用于其他可能的滚动逻辑，索引更新已移交 IntersectionObserver
}, 100);

/**
 * 清理 UI
 * 在重新初始化或切换对话时调用，移除旧的时间线节点
 */
function clearUI(): void {
  // 增加版本号，使所有正在进行的（旧）init 流程失效
  currentInitId++;

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
  
  // 如果不存在实例，则创建
  if (!timelineNavigator) {
    timelineNavigator = new RightSideTimelineNavigator();
    
    // 注册节点点击事件 (只需注册一次)
    timelineNavigator.onNodeClick((itemIndex: number) => {
      // 复用 navigateToAnswer 函数，统一管理锁逻辑
      navigateToAnswer(itemIndex);
    });
  }
  
  // 1. 更新/设置对话 ID
  const conversationId = getConversationId();
  timelineNavigator.setConversationId(conversationId);

  // 2. 更新/设置主题
  const theme = (cachedSettings?.ui_theme as ThemeMode) || 'auto';
  timelineNavigator.setTheme(theme);
  
  // 3. 传入所有 Prompt-Answer 条目 (init 方法内部会处理增量更新)
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
  
  // 锁定当前执行ID
  const myInitId = ++currentInitId;

  // 创建初始化Promise
  initPromise = (async () => {
    // 先清理旧 UI，给用户一个"正在加载"的空白状态
    // 注意：clearUI 会自增 currentInitId，所以这里不用调用它，或者调用后要重新同步 ID？
    // 逻辑修正：clearUI() 应该在外部或者 init 开始前调用。但为了保持原有逻辑（init 内部清理），
    // 我们在 clearUI 内部自增了 ID。
    // 这里调用 clearUI 会导致 currentInitId 增加，所以我们需要在 clearUI 之后获取 ID，或者接受这个副作用。
    // 更好的方式是：init() 开始时不调用 clearUI，或者 clearUI 是 init 的一部分。
    // 原有逻辑是 init 内部调用 clearUI。
    // 如果 clearUI 增加 ID，那么上面的 myInitId 就过时了。
    // 调整策略：myInitId 应该在 clearUI 之后确定。
    
    // 但为了防止外部 clearUI 干扰，我们在 async 闭包内部再次检查。
    // 让我们简单点：myInitId 在 async 内部确定。
    
    clearUI(); // 这会增加 currentInitId
    const executionId = currentInitId; // 获取当前最新的 ID
    
    isInitializing = true;
    
    try {
    // 从存储中加载自定义 URL
    const settings = await getSettings();
    
    // 关键检查：如果在 await 期间被外部再次调用了 clearUI/init，则终止
    if (executionId !== currentInitId) return;

    const customUrls = settings.custom_urls || [];
    
    // 获取当前页面适配的站点适配器
    const adapter = getActiveAdapter(window.location, customUrls);
    
    if (!adapter) {
      // 只有当我是最新的 init 时，才重置标志
      if (executionId === currentInitId) isInitializing = false;
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
    } else if (adapter.name === 'DeepSeek') {
        isEnabled = settings.enable_deepseek !== false;
    }

    if (!isEnabled) {
      if (executionId === currentInitId) isInitializing = false;
      return;
    }
  
  // 旧的悬浮按钮导航已被时间线导航替代，此处代码已移除
  
  // 尝试查找更精确的根容器（通常是 <main>）以减少不必要的扫描和监听
    const mainElement = document.querySelector('main');
    const rootElement = mainElement || document.body;
    
    // 初始化索引管理器
    indexManager = new AnswerIndexManager(adapter, rootElement);
    
    // 注册索引变更回调，自动更新 UI
    indexManager.onIndexChange((index) => {
      updateUI();
    });
  
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
    // 再次检查 ID，确保回调仍然有效（虽然 destroy 会断开 observer，但防抖可能导致延迟执行）
    if (executionId !== currentInitId) return;
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
  
  contentMutationObserver.observe(rootElement, {
    childList: true,
    subtree: true
  });
  
  // 如果初次扫描未找到问题，5秒后停止自动刷新
  if (totalCount === 0) {
    setTimeout(() => {
      // 再次检查 ID
      if (executionId !== currentInitId) return;
      if (!isListLocked) {
        isListLocked = true;
      }
    }, 5000);
  }
  
  } finally {
    // 无论是否因为版本号不一致而提前返回，都必须重置初始化状态
    // 否则会导致死锁，后续的 init 永远无法执行
    isInitializing = false;
    initPromise = null;
  }
  })();
  
  return initPromise;
}

// 监听 URL 变化（用于检测切换对话）
let lastUrl = window.location.href;

/**
 * 处理 URL 变化
 */
function handleUrlChange() {
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
}

// 使用轮询检测 URL 变化 (替代昂贵的全局 MutationObserver)
setInterval(handleUrlChange, 1000);

// 监听 popstate 事件（浏览器前进后退）
window.addEventListener('popstate', () => {
  // 给一点时间让 URL 更新
  setTimeout(handleUrlChange, 100);
});

// 监听点击事件，以便在点击链接时更快响应
document.addEventListener('click', () => {
  setTimeout(handleUrlChange, 200);
}, { capture: true, passive: true });

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
  
  // 所有消息都同步处理完成，不需要返回 true
});
