import type { PromptAnswerItem } from './answerIndexManager';
import { PinnedStore } from '../store/pinnedStore';
import { FavoriteStore, type FavoriteConversation } from '../store/favoriteStore';
import { themes, resolveTheme, type ThemeMode, type TimelineTheme } from './themes';
import { getTranslation, type Language } from '../../utils/i18n';
import {
  ChristmasThemeEffects,
  SciFiThemeEffects,
  injectThemeAnimationStyles
} from './themeEffects';
import {
  autoFavoriteIfNeeded,
  closeFavoritesModal,
  createBottomStarsButton,
  createConversationItem,
  createFavoritesModalFooter,
  createTopStarButton,
  getSiteIconUrl,
  handleFavoriteClick,
  openOptionsPage,
  playStarBounceAnimation,
  refreshFavoritesModalIfOpen,
  removeFavoritesModalElements,
  showConfirmDialog,
  showFavoritesModal,
  showInputDialog,
  syncPinnedToFavorites,
  updateBottomStarsStyle,
  updateTopStarStyle,
  navigateToFavorite
} from './rightSideTimelineNavigatorFavorites';
import type { FavoritesContext } from './rightSideTimelineNavigatorFavorites';
import {
  endTutorial,
  maybeContinueTutorialAfterFavoritesModalOpened,
  maybeStartTutorial
} from './rightSideTimelineNavigatorTutorial';
import type { TutorialContext } from './rightSideTimelineNavigatorTutorial';

/**
 * 右侧时间线导航器
 * 在页面右侧显示纵向时间线，每个节点代表一个对话
 */
export class RightSideTimelinejump {
  private static readonly TUTORIAL_ENABLED_KEY = 'llm-nav-tutorial-enabled';

  private container: HTMLElement;
  private timelineBar: HTMLElement;
  private nodesWrapper: HTMLElement;
  private nodesContent: HTMLElement;
  private nodes: HTMLElement[] = [];
  private items: PromptAnswerItem[] = [];
  private activeIndex: number = 0;
  private onClickCallback: ((index: number) => void) | null = null;
  private tooltip: HTMLElement;

  private resizeObserver: ResizeObserver | null = null;
  private conversationId: string | null = null;
  private pinnedNodes: Set<string> = new Set();

  // 收藏功能相关
  private topStarButton: HTMLElement | null = null;
  private bottomStarsButton: HTMLElement | null = null;
  private favoritesModal: HTMLElement | null = null;
  private favoritesModalView: 'front' | 'back' = 'front';
  private isFavorited: boolean = false;
  private siteName: string = '';
  private currentLanguage: Language = 'auto';
  private currentUrl: string = '';

  private contentHeight: number = 0;
  private slider: HTMLElement | null = null;
  private sliderHandle: HTMLElement | null = null;
  private sliderVisible: boolean = false;
  private sliderDragging: boolean = false;
  private sliderPointerId: number | null = null;
  private sliderDragStartY: number = 0;
  private sliderDragStartHandleTop: number = 0;
  private sliderDragMaxTop: number = 0;
  private sliderPointerMoveHandler?: (event: PointerEvent) => void;
  private sliderPointerUpHandler?: (event: PointerEvent) => void;

  private readonly NODE_PADDING = 30;
  private readonly MIN_NODE_GAP = 28;

  // 当前主题
  private currentTheme: TimelineTheme = themes.light;
  private currentThemeMode: ThemeMode = 'auto';

  // 特殊主题效果管理器
  private christmasEffects: ChristmasThemeEffects | null = null;
  private scifiEffects: SciFiThemeEffects | null = null;

  // 防止 ResizeObserver 无限循环的标志
  private isUpdatingPositions: boolean = false;

  // 新手教程
  private tutorialStep: 0 | 1 | 2 | 3 | 4 | 5 = 0;
  private tutorialStartRequested: boolean = false;
  private tutorialWaitingForFavoritesModal: boolean = false;
  private tutorialBubble: HTMLDivElement | null = null;
  private tutorialBubbleArrow: HTMLDivElement | null = null;
  private tutorialBubbleTitle: HTMLDivElement | null = null;
  private tutorialBubbleText: HTMLDivElement | null = null;
  private tutorialBubblePrompt: HTMLDivElement | null = null;
  private tutorialBubbleActions: HTMLDivElement | null = null;
  private tutorialSkipConfirming: boolean = false;
  private tutorialAnchor: HTMLElement | null = null;
  private tutorialPlacement: 'left' | 'right' | 'top' | 'bottom' = 'left';
  private tutorialListeners: Array<{
    target: EventTarget;
    type: string;
    handler: EventListenerOrEventListenerObject;
    options?: AddEventListenerOptions | boolean;
  }> = [];
  private tutorialTimeoutIds: number[] = [];
  private tutorialResizeHandler: (() => void) | null = null;

  constructor() {
    // 注入主题动画样式
    injectThemeAnimationStyles();

    // 确保主题已初始化
    const savedTheme = localStorage.getItem('llm_nav_theme_cache');
    if (savedTheme && themes[savedTheme]) {
      this.currentTheme = themes[savedTheme];
      this.currentThemeMode = savedTheme as ThemeMode;
    }

    this.container = this.createContainer();
    this.timelineBar = this.createTimelineBar();
    this.nodesWrapper = this.createNodesWrapper();
    this.nodesContent = this.createNodesContent();
    this.tooltip = this.createTooltip();
    this.container.appendChild(this.timelineBar);
    this.container.appendChild(this.nodesWrapper);
    this.nodesWrapper.appendChild(this.nodesContent);
    document.body.appendChild(this.container);
    document.body.appendChild(this.tooltip);

    // 创建顶部单星按钮和底部三星按钮
    this.createTopStarButton();
    this.createBottomStarsButton();

    this.createSlider();
    this.nodesWrapper.addEventListener('scroll', this.handleWrapperScroll, { passive: true });

    // 监听容器大小变化
    this.resizeObserver = new ResizeObserver(() => {
      // 防止递归触发
      if (!this.isUpdatingPositions) {
        this.updateNodePositions();
      }
    });
    this.resizeObserver.observe(this.container);

    // 初始化主题监听 (系统主题变更)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      // 只有在 auto 模式下才响应系统变化，这里需要从外部触发更新，或者存储当前的 mode
      // 简单起见，由外部 content script 监听 storage 变化来驱动 setTheme
    });
  }

  /**
   * 设置主题模式
   */
  setTheme(mode: ThemeMode) {
    const themeType = resolveTheme(mode);
    this.currentTheme = themes[themeType];
    this.currentThemeMode = mode;
    // 缓存主题，防止构造函数加载时闪烁
    localStorage.setItem('llm_nav_theme_cache', themeType);

    // 清理之前的特殊主题效果
    this.cleanupThemeEffects();

    // 根据主题类型应用不同的效果
    const themeTypeFlag = this.currentTheme.themeType;

    if (themeTypeFlag === 'christmas') {
      this.applyChristmasTheme();
    } else if (themeTypeFlag === 'scifi') {
      this.applySciFiTheme();
    } else {
      // 普通主题
      this.applyNormalTheme();
    }

    if (this.slider) {
      this.slider.style.borderColor = this.currentTheme.timelineBarColor;
    }
    if (this.sliderHandle) {
      this.sliderHandle.style.backgroundColor = this.currentTheme.activeColor;
      this.sliderHandle.style.boxShadow = `0 0 8px ${this.currentTheme.activeShadow}`;
    }

    // 更新 Tooltip 样式
    this.updateTooltipTheme();

    // 刷新所有节点样式
    this.nodes.forEach((node, index) => {
      this.updateNodeStyle(node, index);
    });

    // 更新星星按钮样式
    this.updateTopStarStyle();
    this.updateBottomStarsStyle();
    void this.refreshFavoritesModalIfOpen();
  }

  /**
   * 清理之前的特殊主题效果
   */
  private cleanupThemeEffects(): void {
    if (this.christmasEffects) {
      this.christmasEffects.destroy();
      this.christmasEffects = null;
    }
    if (this.scifiEffects) {
      this.scifiEffects.destroy();
      this.scifiEffects = null;
    }

    // 移除主题相关的类名
    this.tooltip.classList.remove('christmas-tooltip', 'scifi-tooltip');
  }

  /**
   * 应用圣诞主题
   */
  private applyChristmasTheme(): void {
    // 初始化圣诞特效
    this.christmasEffects = new ChristmasThemeEffects(this.container);
    this.christmasEffects.init();

    // 应用灯条树干样式
    const barStyle = ChristmasThemeEffects.getTimelineBarStyle();
    this.timelineBar.style.cssText = `
      position: absolute;
      left: 50%;
      top: 0;
      height: 100%;
      transform: translateX(-50%);
      pointer-events: none;
      transition: background-color 0.3s ease;
      ${barStyle}
    `;

    // Tooltip 添加圣诞类名
    this.tooltip.classList.add('christmas-tooltip');
  }

  /**
   * 应用科幻主题
   */
  private applySciFiTheme(): void {
    // 初始化科幻特效
    this.scifiEffects = new SciFiThemeEffects(this.container);
    this.scifiEffects.init();

    // 应用流体树干样式
    const barStyle = SciFiThemeEffects.getTimelineBarStyle();
    this.timelineBar.style.cssText = `
      position: absolute;
      left: 50%;
      top: 0;
      height: 100%;
      transform: translateX(-50%);
      pointer-events: none;
      transition: background-color 0.3s ease;
      ${barStyle}
    `;

    // Tooltip 添加科幻类名
    this.tooltip.classList.add('scifi-tooltip');
  }

  /**
   * 应用普通主题
   */
  private applyNormalTheme(): void {
    // 重置时间线主干为普通样式
    this.timelineBar.style.cssText = '';
    Object.assign(this.timelineBar.style, {
      position: 'absolute',
      left: '50%',
      top: '0',
      width: '2px',
      height: '100%',
      backgroundColor: this.currentTheme.timelineBarColor,
      transform: 'translateX(-50%)',
      pointerEvents: 'none',
      transition: 'background-color 0.3s ease'
    });
  }

  /**
   * 更新 Tooltip 主题样式
   */
  private updateTooltipTheme(): void {
    const themeTypeFlag = this.currentTheme.themeType;

    if (themeTypeFlag === 'christmas') {
      this.tooltip.style.backgroundColor = '#FFFAF0';
      this.tooltip.style.color = '#8B4513';
      this.tooltip.style.border = '1px solid #DAA520';
    } else if (themeTypeFlag === 'scifi') {
      this.tooltip.style.backgroundColor = 'rgba(20, 10, 40, 0.95)';
      this.tooltip.style.color = '#00FFFF';
      this.tooltip.style.border = '1px solid #00FFFF';
    } else {
      this.tooltip.style.backgroundColor = this.currentTheme.tooltipBackgroundColor;
      this.tooltip.style.color = this.currentTheme.tooltipTextColor;
      this.tooltip.style.border = 'none';
    }
  }

  /**
   * 设置当前对话 ID 并加载标记状态
   */
  async setConversationId(id: string) {
    this.conversationId = id;
    this.currentUrl = window.location.href;
    this.pinnedNodes = await PinnedStore.loadPinned(id);

    // 检查是否已收藏，或者有被标记的节点（自动点亮）
    const isExplicitlyFavorited = await FavoriteStore.isFavorited(id);
    const hasPinnedNodes = this.pinnedNodes.size > 0;
    this.isFavorited = isExplicitlyFavorited || hasPinnedNodes;

    // 如果有标记节点但未收藏，自动创建收藏
    if (hasPinnedNodes && !isExplicitlyFavorited) {
      // 延迟自动收藏，等待 items 加载完成
      setTimeout(() => this.autoFavoriteIfNeeded(), 500);
    }

    this.updateTopStarStyle();

    // 重新应用样式
    this.nodes.forEach((node, index) => {
      this.updateNodeStyle(node, index);
    });
  }

  /**
   * 设置站点名称
   */
  setSiteName(name: string): void {
    this.siteName = name;
  }

  /**
   * 设置当前语言
   */
  setLanguage(lang: Language): void {
    this.currentLanguage = lang;
    this.updateTopStarStyle();
    if (this.bottomStarsButton) {
      this.bottomStarsButton.title = this.t('favorites.viewAll');
    }
    void this.refreshFavoritesModalIfOpen();
  }

  /**
   * 获取翻译文本
   */
  private t(key: string): string {
    return getTranslation(key, this.currentLanguage);
  }

  private getFavoritesContext(): FavoritesContext {
    return this as unknown as FavoritesContext;
  }

  private getTutorialContext(): TutorialContext {
    return this as unknown as TutorialContext;
  }

  /**
   * 创建顶部单星按钮（收藏当前对话）
   */
  private createTopStarButton(): void {
    createTopStarButton(this.getFavoritesContext());
  }

  /**
   * 创建底部三星按钮（打开收藏列表）
   */
  private createBottomStarsButton(): void {
    createBottomStarsButton(this.getFavoritesContext());
  }

  /**
   * 更新底部三星样式（主题变化时调用）
   */
  private updateBottomStarsStyle(): void {
    updateBottomStarsStyle(this.getFavoritesContext());
  }

  /**
   * 处理收藏按钮点击
   */
  private async handleFavoriteClick(): Promise<void> {
    return handleFavoriteClick(this.getFavoritesContext());
  }

  /**
   * 播放星星跳跃动画
   */
  private playStarBounceAnimation(): void {
    playStarBounceAnimation(this.getFavoritesContext());
  }

  /**
   * 同步标记节点到收藏（当标记状态变化时调用）
   * 如果有标记节点但尚未收藏，会自动创建收藏
   */
  async syncPinnedToFavorites(): Promise<void> {
    return syncPinnedToFavorites(this.getFavoritesContext());
  }

  /**
   * 更新顶部星星样式
   */
  private updateTopStarStyle(): void {
    updateTopStarStyle(this.getFavoritesContext());
  }

  /**
   * 刷新收藏弹窗（保持当前视图）
   */
  private async refreshFavoritesModalIfOpen(): Promise<void> {
    return refreshFavoritesModalIfOpen(this.getFavoritesContext());
  }

  /**
   * 显示收藏列表弹窗
   */
  private async showFavoritesModal(initialView: 'front' | 'back' = 'front'): Promise<void> {
    return showFavoritesModal(this.getFavoritesContext(), initialView);
  }

  private createFavoritesModalFooter(side: 'front' | 'back'): HTMLElement {
    return createFavoritesModalFooter(this.getFavoritesContext(), side);
  }

  private openOptionsPage(): void {
    openOptionsPage();
  }

  /**
   * 创建对话收藏项
   */
  private createConversationItem(conv: FavoriteConversation): HTMLElement {
    return createConversationItem(this.getFavoritesContext(), conv);
  }

  /**
   * 跳转到收藏的对话
   */
  private navigateToFavorite(conv: FavoriteConversation, nodeIndex: number): void {
    navigateToFavorite(this.getFavoritesContext(), conv, nodeIndex);
  }

  /**
   * 关闭收藏弹窗
   */
  private closeFavoritesModal(): void {
    closeFavoritesModal(this.getFavoritesContext());
  }

  private removeFavoritesModalElements(): void {
    removeFavoritesModalElements(this.getFavoritesContext());
  }

  /**
   * 显示自定义确认对话框
   */
  private showConfirmDialog(message: string): Promise<boolean> {
    return showConfirmDialog(this.getFavoritesContext(), message);
  }

  private showInputDialog(
    title: string,
    defaultValue: string,
    placeholder: string
  ): Promise<string | null> {
    return showInputDialog(this.getFavoritesContext(), title, defaultValue, placeholder);
  }

  /**
   * 获取网站对应的图标 URL
   */
  private getSiteIconUrl(siteName: string): string {
    return getSiteIconUrl(siteName);
  }

  /**
   * 如果有标记节点但未收藏，自动创建收藏
   */
  private async autoFavoriteIfNeeded(): Promise<void> {
    return autoFavoriteIfNeeded(this.getFavoritesContext());
  }

  private maybeStartTutorial(): void {
    maybeStartTutorial(this.getTutorialContext(), RightSideTimelinejump.TUTORIAL_ENABLED_KEY);
  }

  private maybeContinueTutorialAfterFavoritesModalOpened(): void {
    maybeContinueTutorialAfterFavoritesModalOpened(this.getTutorialContext());
  }

  private endTutorial(): void {
    endTutorial(this.getTutorialContext());
  }

  /**
   * 创建主容器
   */
  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.id = 'llm-timeline-jump';

    // 样式
    Object.assign(container.style, {
      position: 'fixed',
      right: '20px',
      top: '50%',
      transform: 'translateY(-50%)',
      width: '40px',
      height: '80vh',
      maxHeight: '800px',
      zIndex: '2147483647', // 使用最大层级，但避免影响其他功能
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      pointerEvents: 'auto'
    });

    return container;
  }

  /**
   * 创建时间线竖线
   */
  private createTimelineBar(): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'timeline-bar';

    Object.assign(bar.style, {
      position: 'absolute',
      left: '50%',
      top: '0',
      width: '2px',
      height: '100%',
      backgroundColor: this.currentTheme.timelineBarColor, // 使用主题色
      transform: 'translateX(-50%)',
      pointerEvents: 'none',
      transition: 'background-color 0.3s ease'
    });

    return bar;
  }

  /**
   * 创建节点容器（支持滚动）
   */
  private createNodesWrapper(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'timeline-nodes-wrapper';
    Object.assign(wrapper.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: '100%',
      height: '100%',
      overflowY: 'auto',
      overflowX: 'hidden',
      scrollbarWidth: 'none', // Firefox 隐藏滚动条
      msOverflowStyle: 'none', // IE/Edge
      pointerEvents: 'auto',
      zIndex: '2'
    });
    // WebKit 隐藏滚动条
    wrapper.style.setProperty('scrollbar-color', 'transparent transparent');
    wrapper.style.setProperty('scrollbar-width', 'none');
    wrapper.addEventListener('wheel', (event) => {
      // 防止滚动事件冒泡到页面其他区域
      event.stopPropagation();
    }, { passive: true });
    return wrapper;
  }

  private createNodesContent(): HTMLElement {
    const content = document.createElement('div');
    content.className = 'timeline-nodes-content';
    Object.assign(content.style, {
      position: 'relative',
      width: '100%',
      height: '100%',
      pointerEvents: 'auto'
    });
    return content;
  }

  /**
   * 创建 tooltip（用于 hover 显示 prompt 内容）
   */
  private createTooltip(): HTMLElement {
    const tooltip = document.createElement('div');
    tooltip.id = 'llm-timeline-tooltip';

    Object.assign(tooltip.style, {
      position: 'fixed',
      maxWidth: '200px', // 缩窄宽度
      padding: '8px 12px',
      backgroundColor: this.currentTheme.tooltipBackgroundColor, // 使用主题色
      color: this.currentTheme.tooltipTextColor, // 使用主题色
      fontSize: '12px',
      lineHeight: '1.4',
      borderRadius: '6px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
      zIndex: '9999',
      pointerEvents: 'none',
      wordWrap: 'break-word',
      whiteSpace: 'pre-wrap',
      display: '-webkit-box',
      visibility: 'hidden',
      // 限制显示两行
      webkitLineClamp: '2',
      webkitBoxOrient: 'vertical',
      overflow: 'hidden'
    });

    return tooltip;
  }

  /**
   * 显示 tooltip
   */
  private showTooltip(text: string, nodeElement: HTMLElement): void {
    // 检查是否被标记
    const index = nodeElement.dataset.index;
    const isPinned = index && this.pinnedNodes.has(index);

    // 截断文本（最多 50 字符）
    const displayText = this.truncateTooltipText(text, 50);
    if (!displayText) {
      this.hideTooltip();
      return;
    }

    // 如果被标记，添加带主题颜色的星星
    if (isPinned) {
      this.tooltip.innerHTML = `<span style="color: ${this.currentTheme.pinnedColor}; margin-right: 4px;">★</span>${this.escapeHtml(displayText)}`;
    } else {
      this.tooltip.textContent = displayText;
    }
    this.tooltip.style.visibility = 'visible';

    // 计算位置（显示在节点左侧）
    const rect = nodeElement.getBoundingClientRect();
    const gap = 10; // 节点与 tooltip 之间的间距 (更紧邻)

    // 默认显示在左侧
    let left = rect.left - this.tooltip.offsetWidth - gap;
    let top = rect.top + rect.height / 2 - this.tooltip.offsetHeight / 2; // 垂直居中

    // 如果左侧空间不够，显示在右侧
    if (left < 10) {
      left = rect.right + gap;
    }

    // 确保不超出顶部和底部
    if (top < 10) top = 10;
    if (top + this.tooltip.offsetHeight > window.innerHeight - 10) {
      top = window.innerHeight - this.tooltip.offsetHeight - 10;
    }

    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${top}px`;
  }

  /**
   * 隐藏 tooltip
   */
  private hideTooltip(): void {
    this.tooltip.style.visibility = 'hidden';
  }

  private truncateTooltipText(text: string, maxChars: number): string {
    const chars = Array.from(text);
    if (chars.length <= maxChars) return text;
    return chars.slice(0, maxChars).join('') + '...';
  }

  /**
   * 转义 HTML 特殊字符
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 更新单个节点的样式（包含 Active 和 Pinned 状态）
   */
  private updateNodeStyle(node: HTMLElement, index: number) {
    const isActive = index === this.activeIndex;
    const isPinned = this.pinnedNodes.has(String(index));
    const themeTypeFlag = this.currentTheme.themeType;

    // 首先彻底清理节点的所有特殊样式和元素
    this.cleanNodeStyles(node);

    // 基础样式
    node.style.transition = 'all 0.2s ease';

    // 根据主题类型应用不同的节点样式
    if (themeTypeFlag === 'christmas') {
      this.applyChristmasNodeStyle(node, isActive, isPinned);
    } else if (themeTypeFlag === 'scifi') {
      this.applySciFiNodeStyle(node, isActive, isPinned);
    } else {
      this.applyNormalNodeStyle(node, isActive, isPinned);
    }
  }

  /**
   * 清理节点的特殊主题样式和子元素（保留核心位置属性）
   */
  private cleanNodeStyles(node: HTMLElement): void {
    // 保留节点的 top 位置
    const savedTop = node.style.top;

    // 移除所有特殊主题的子元素
    node.querySelectorAll('.scifi-outer-ring, .scifi-inner-ring, .scifi-center, .scifi-ring, .scifi-crosshair').forEach(el => el.remove());

    // 移除所有主题相关的类名
    node.classList.remove(
      'christmas-node-sphere', 'christmas-node-default', 'christmas-node-active', 'christmas-node-pinned', 'christmas-node-pinned-active',
      'scifi-dual-ring', 'scifi-single-ring'
    );

    // 只重置样式属性，不改变核心定位
    node.style.animation = '';
    node.style.background = '';
    node.style.boxShadow = '';

    // 恢复 top 位置
    if (savedTop) {
      node.style.top = savedTop;
    }
  }

  /**
   * 应用圣诞主题节点样式 - 立体圆球效果
   * 修复：标记的 node 点击时显示标记颜色（红色更亮）
   */
  private applyChristmasNodeStyle(node: HTMLElement, isActive: boolean, isPinned: boolean): void {
    // 添加圣诞主题类名
    node.classList.add('christmas-node-sphere');

    // 基础变换和层级
    if (isActive && isPinned) {
      // 标记且激活 - 红色更亮更大
      node.style.transform = 'translate(-50%, -50%) scale(1.4)';
      node.style.zIndex = '10';
      node.classList.add('christmas-node-pinned-active');
    } else if (isActive) {
      node.style.transform = 'translate(-50%, -50%) scale(1.4)';
      node.style.zIndex = '10';
      node.classList.add('christmas-node-active');
    } else if (isPinned) {
      node.style.transform = 'translate(-50%, -50%) scale(1.2)';
      node.style.zIndex = '5';
      node.classList.add('christmas-node-pinned');
    } else {
      node.style.transform = 'translate(-50%, -50%) scale(1)';
      node.style.zIndex = '1';
      node.classList.add('christmas-node-default');
    }

    // 清除溢出限制以显示阴影
    node.style.overflow = 'visible';
    node.style.border = 'none';
  }

  /**
   * 应用科幻主题节点样式 - 瞄准图案
   * 使用科技蓝色 (#00A8FF)，标记时红色
   * 按住时放大SVG而不是改变颜色
   */
  private applySciFiNodeStyle(node: HTMLElement, isActive: boolean, isPinned: boolean): void {
    // 科技蓝色，标记时为红色
    const techBlue = '#00A8FF';
    const color = isPinned ? '#FF4444' : techBlue;
    const glowColor = isPinned ? 'rgba(255, 68, 68, 0.6)' : 'rgba(0, 168, 255, 0.6)';

    // 添加科幻主题类名
    node.classList.add('scifi-single-ring');

    // 清除默认背景样式
    node.style.backgroundColor = 'transparent';
    node.style.border = 'none';
    node.style.boxShadow = 'none';
    node.style.overflow = 'visible';

    // 基础变换 - 按住时放大效果更明显
    if (isActive && isPinned) {
      node.style.transform = 'translate(-50%, -50%) scale(2.0)';
      node.style.zIndex = '10';
    } else if (isActive) {
      node.style.transform = 'translate(-50%, -50%) scale(1.8)';
      node.style.zIndex = '10';
    } else if (isPinned) {
      node.style.transform = 'translate(-50%, -50%) scale(1.3)';
      node.style.zIndex = '5';
    } else {
      node.style.transform = 'translate(-50%, -50%) scale(1.2)';
      node.style.zIndex = '1';
    }

    // 创建瞄准图案容器 - 放大SVG
    const crosshair = document.createElement('div');
    crosshair.className = 'scifi-crosshair';
    Object.assign(crosshair.style, {
      position: 'absolute',
      width: '150%',
      height: '150%',
      pointerEvents: 'none',
      top: '-25%',
      left: '-25%'
    });

    // 根据状态设置动画 - 按住时旋转更快
    const shouldRotate = isActive || isPinned;
    const rotateSpeed = isActive ? '1.5s' : '3s';
    const glowIntensity = isActive ? '10px' : (isPinned ? '8px' : '5px');

    crosshair.innerHTML = `
      <svg width="100%" height="100%" viewBox="0 0 100 100" style="filter: drop-shadow(0 0 ${glowIntensity} ${glowColor}); ${shouldRotate ? `animation: scifiRingRotate ${rotateSpeed} linear infinite;` : ''}">
        <circle cx="50" cy="50" r="42" fill="none" stroke="${color}" stroke-width="2.5"/>
        <circle cx="50" cy="50" r="28" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.6"/>
        <circle cx="50" cy="50" r="5" fill="${color}"/>
        <line x1="50" y1="3" x2="50" y2="18" stroke="${color}" stroke-width="2.5"/>
        <line x1="50" y1="82" x2="50" y2="97" stroke="${color}" stroke-width="2.5"/>
        <line x1="3" y1="50" x2="18" y2="50" stroke="${color}" stroke-width="2.5"/>
        <line x1="82" y1="50" x2="97" y2="50" stroke="${color}" stroke-width="2.5"/>
      </svg>
    `;

    node.appendChild(crosshair);
  }

  /**
   * 应用普通主题节点样式
   */
  private applyNormalNodeStyle(node: HTMLElement, isActive: boolean, isPinned: boolean): void {
    // 恢复标准节点外观
    node.style.overflow = 'hidden';

    if (isActive) {
      // 激活状态
      node.style.transform = 'translate(-50%, -50%) scale(1.4)';
      node.style.zIndex = '10';
      node.style.boxShadow = `0 0 10px ${this.currentTheme.activeShadow}`;
      node.style.border = '3px solid #fff';

      if (isPinned) {
        node.style.backgroundColor = this.currentTheme.pinnedColor;
      } else {
        node.style.backgroundColor = this.currentTheme.activeColor;
      }
    } else {
      // 非激活状态
      node.style.transform = 'translate(-50%, -50%) scale(1)';
      node.style.zIndex = '1';
      node.style.boxShadow = 'none';
      node.style.border = '2px solid #fff';

      if (isPinned) {
        node.style.backgroundColor = this.currentTheme.pinnedColor;
        node.style.transform = 'translate(-50%, -50%) scale(1.2)';
      } else {
        node.style.backgroundColor = this.currentTheme.defaultNodeColor;
        node.style.transform = 'translate(-50%, -50%) scale(1)';
      }
    }
  }

  /**
   * 创建单个节点
   */
  private createNode(item: PromptAnswerItem, index: number): HTMLElement {
    const node = document.createElement('div');
    node.className = 'timeline-node';
    node.dataset.index = String(index);

    // 初始样式
    Object.assign(node.style, {
      position: 'absolute',
      left: '50%',
      width: '12px',
      height: '12px',
      borderRadius: '50%',
      cursor: 'pointer',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'auto',
      overflow: 'hidden', // 确保内部填充层不溢出
    });

    // 填充层（用于长按动画）
    const fillLayer = document.createElement('div');
    fillLayer.className = 'fill-layer';
    Object.assign(fillLayer.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundColor: this.currentTheme.pinnedColor, // 初始色为主题重点色
      borderRadius: '50%',
      transform: 'scale(0)', // 默认隐藏
      transition: 'transform 200ms ease-out', // 默认快速回退
      pointerEvents: 'none',
      zIndex: '0'
    });
    node.appendChild(fillLayer);

    this.updateNodeStyle(node, index);

    // 长按相关变量
    let pressTimer: ReturnType<typeof setTimeout> | null = null;
    let isLongPress = false;

    const startPress = () => {
      isLongPress = false;

      // 判断是标记还是取消标记，设置不同的填充色
      const isAlreadyPinned = this.pinnedNodes.has(String(index));
      if (isAlreadyPinned) {
        // 取消标记：使用灰色/白色填充，表示"擦除"
        fillLayer.style.backgroundColor = '#E0E0E0';
      } else {
        // 标记：使用主题定义的重点色填充
        fillLayer.style.backgroundColor = this.currentTheme.pinnedColor;
      }

      // 开始动画：慢慢变大
      fillLayer.style.transition = 'transform 500ms linear';
      fillLayer.style.transform = 'scale(1)';

      pressTimer = setTimeout(async () => {
        isLongPress = true;

        if (this.conversationId) {
          const nodeId = String(index);
          const newPinnedState = await PinnedStore.togglePinned(this.conversationId, nodeId);

          if (newPinnedState) {
            this.pinnedNodes.add(nodeId);
          } else {
            this.pinnedNodes.delete(nodeId);
          }

          this.updateNodeStyle(node, index);

          // 同步到收藏
          this.syncPinnedToFavorites();

          // 震动反馈 (如果支持)
          if (navigator.vibrate) {
            try { navigator.vibrate(50); } catch (e) { }
          }
        }

        // 无论结果如何，重置填充层（因为状态改变后 updateNodeStyle 会处理背景色）
        // 但为了视觉连贯性，我们让它保持满，直到鼠标松开
      }, 500); // 500ms 长按阈值
    };

    const cancelPress = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }

      // 动画回退
      fillLayer.style.transition = 'transform 200ms ease-out';
      fillLayer.style.transform = 'scale(0)';
    };

    // 鼠标/触摸事件处理
    node.addEventListener('mousedown', startPress);
    node.addEventListener('touchstart', startPress, { passive: true });

    node.addEventListener('mouseup', cancelPress);
    node.addEventListener('mouseleave', cancelPress);
    node.addEventListener('touchend', cancelPress);

    // ... (其余事件监听保持不变)

    // 鼠标悬浮效果 + 显示 tooltip
    node.addEventListener('mouseenter', () => {
      // 悬浮放大效果仅在非 active 时应用
      if (index !== this.activeIndex) {
        node.style.transform = 'translate(-50%, -50%) scale(1.2)';
      }

      // 显示 tooltip
      if (this.items[index]) {
        this.showTooltip(this.items[index].promptText, node);
      }
    });

    node.addEventListener('mouseleave', () => {
      // 恢复样式
      this.updateNodeStyle(node, index);

      // 隐藏 tooltip
      this.hideTooltip();
    });

    // 点击事件
    node.addEventListener('click', (e) => {
      // 如果触发了长按，则阻止点击跳转
      if (isLongPress) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const clickedIndex = parseInt(node.dataset.index || '0');
      if (this.onClickCallback) {
        this.onClickCallback(clickedIndex);
      }
    });

    return node;
  }

  /**
   * 初始化或更新时间线（传入所有对话条目）
   * 采用增量更新策略，实现平滑动画
   */
  init(items: PromptAnswerItem[]): void {
    this.items = items;
    const newCount = items.length;
    const currentCount = this.nodes.length;

    if (newCount === 0) {
      this.endTutorial();
      // 清空节点
      this.nodes.forEach(node => node.remove());
      this.nodes = [];
      this.nodesWrapper.scrollTop = 0;
      this.nodesContent.style.height = '100%';
      this.contentHeight = 0;
      this.hideSlider();
      return;
    }

    // 1. 如果新数量少于当前数量（例如切换对话），移除多余节点
    if (newCount < currentCount) {
      for (let i = newCount; i < currentCount; i++) {
        this.nodes[i].remove();
      }
      this.nodes.length = newCount;
    }

    // 2. 更新现有节点的数据，并创建新节点
    items.forEach((item, index) => {
      if (index < this.nodes.length) {
        // 更新现有节点（如果有需要更新的数据，比如 tooltip 内容）
        // 位置更新统一在 updateNodePositions 处理
        // 确保样式正确
        this.updateNodeStyle(this.nodes[index], index);
      } else {
        // 创建新节点
        const node = this.createNode(item, index);

        // 新节点初始状态：透明、微缩
        node.style.opacity = '0';
        node.style.transform = 'translate(-50%, -50%) scale(0)';

        this.nodesContent.appendChild(node);
        this.nodes.push(node);

        // 下一帧显示，触发过渡动画
        requestAnimationFrame(() => {
          node.style.opacity = '1';
          this.updateNodeStyle(node, index); // 恢复正常样式和变换
        });
      }
    });

    // 3. 计算并更新所有节点位置（利用 CSS transition 实现平滑移动）
    this.updateNodePositions();
    this.maybeStartTutorial();
  }

  /**
   * 更新所有节点的位置
   * 采用"等间距分布"策略 (Even Distribution)：
   * - 第一个节点固定在顶部 (Padding 位置)
   * - 最后一个节点固定在底部 (ContainerHeight - Padding)
   * - 中间节点均匀分布
   * - 这种方式类似"气泡"效果：新节点加入底部，旧节点自动向上挤压调整，且不再依赖页面 scrollHeight，彻底解决节点不可见问题
   */
  private updateNodePositions(): void {
    // 防止递归触发 ResizeObserver
    if (this.isUpdatingPositions) return;
    this.isUpdatingPositions = true;

    try {
      const count = this.items.length;
      if (count === 0) return;

      const containerHeight = this.container.clientHeight;
      // 容器可能还没渲染出来
      if (containerHeight === 0) return;

      const padding = 30; // 上下留白
      const usableHeight = containerHeight - padding * 2;

      this.items.forEach((item, index) => {
        const node = this.nodes[index];
        if (!node) return;

        let topPosition = padding;

        if (count === 1) {
          // 如果只有一个节点，显示在顶部
          topPosition = padding;
        } else {
          // 多个节点：按索引均匀分布
          // 公式：Padding + (当前索引 / (总数 - 1)) * 可用高度
          // index=0 -> 0% (Top)
          // index=max -> 100% (Bottom)
          const ratio = index / (count - 1);
          topPosition = padding + ratio * usableHeight;
        }

        node.style.top = `${topPosition}px`;
      });
    } finally {
      // 确保标志位被重置
      this.isUpdatingPositions = false;
    }
  }

  /**
   * 刷新节点位置（当窗口 resize 或内容变化时调用）
   */
  refreshPositions(): void {
    this.updateNodePositions();
  }

  /**
   * 确保当前激活节点在可视区域内
   */
  private ensureActiveNodeVisible(): void {
    if (!this.nodesWrapper || this.activeIndex < 0 || this.activeIndex >= this.nodes.length) return;
    const wrapperHeight = this.nodesWrapper.clientHeight || 0;
    if (wrapperHeight === 0) return;

    const activeNode = this.nodes[this.activeIndex];
    const nodeTop = parseFloat(activeNode.dataset.timelineTop || activeNode.style.top || '0');
    const nodeBottom = nodeTop + activeNode.offsetHeight;
    const visibleTop = this.nodesWrapper.scrollTop;
    const visibleBottom = visibleTop + wrapperHeight;
    const padding = 40;

    let nextScrollTop = visibleTop;
    if (nodeTop < visibleTop + padding) {
      nextScrollTop = Math.max(0, nodeTop - padding);
    } else if (nodeBottom > visibleBottom - padding) {
      nextScrollTop = Math.min(this.contentHeight - wrapperHeight, nodeBottom - wrapperHeight + padding);
    }

    if (nextScrollTop !== visibleTop && isFinite(nextScrollTop)) {
      this.nodesWrapper.scrollTop = nextScrollTop;
      this.syncSliderToScroll();
    }
  }

  /**
   * 更新当前激活的节点
   */
  updateActiveIndex(index: number): void {
    if (index < 0 || index >= this.nodes.length) {
      return;
    }

    // 重置之前的 active 节点
    if (this.activeIndex >= 0 && this.activeIndex < this.nodes.length) {
      const oldIndex = this.activeIndex;
      // 临时更改 activeIndex 以便 updateNodeStyle 正确判断
      this.activeIndex = -1;
      this.updateNodeStyle(this.nodes[oldIndex], oldIndex);
    }

    // 设置新的 active 节点
    this.activeIndex = index;
    this.updateNodeStyle(this.nodes[index], index);
    this.ensureActiveNodeVisible();
  }

  /**
   * 注册节点点击回调
   */
  onNodeClick(callback: (itemIndex: number) => void): void {
    this.onClickCallback = callback;
  }

  /**
   * 显示时间线
   */
  show(): void {
    this.container.style.display = 'flex';
  }

  /**
   * 隐藏时间线
   */
  hide(): void {
    this.container.style.display = 'none';
  }

  /**
   * 切换显示/隐藏
   */
  toggle(): void {
    if (this.container.style.display === 'none') {
      this.show();
    } else {
      this.hide();
    }
  }

  /**
   * 切换当前节点的标记状态
   */
  async togglePinnedCurrent(): Promise<void> {
    if (!this.conversationId || this.activeIndex < 0 || this.activeIndex >= this.nodes.length) {
      return;
    }

    const index = this.activeIndex;
    const nodeId = String(index);

    // 调用 Store 更新状态
    const newPinnedState = await PinnedStore.togglePinned(this.conversationId, nodeId);

    if (newPinnedState) {
      this.pinnedNodes.add(nodeId);
    } else {
      this.pinnedNodes.delete(nodeId);
    }

    // 更新样式
    this.updateNodeStyle(this.nodes[index], index);

    // 同步到收藏
    this.syncPinnedToFavorites();

    // 震动反馈
    if (navigator.vibrate) {
      try { navigator.vibrate(50); } catch (e) { }
    }
  }

  /**
   * 销毁时间线
   */
  destroy(): void {
    this.endTutorial();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.nodesWrapper) {
      this.nodesWrapper.removeEventListener('scroll', this.handleWrapperScroll);
    }

    // 清理主题效果
    this.cleanupThemeEffects();

    this.detachSliderEvents();
    this.slider?.remove();
    this.container.remove();
    this.tooltip.remove();
    this.closeFavoritesModal();
  }

  private handleWrapperScroll = (): void => {
    if (this.sliderDragging) return;
    this.syncSliderToScroll();
  };

  /**
   * 创建自定义滚动条
   */
  private createSlider(): void {
    const slider = document.createElement('div');
    slider.className = 'timeline-slider';
    Object.assign(slider.style, {
      position: 'absolute',
      left: '-18px',
      width: '6px',
      borderRadius: '999px',
      border: `1px solid ${this.currentTheme.timelineBarColor}`,
      background: 'rgba(255,255,255,0.05)',
      display: 'none',
      pointerEvents: 'auto',
      zIndex: '3'
    });

    const handle = document.createElement('div');
    handle.className = 'timeline-slider-handle';
    Object.assign(handle.style, {
      position: 'absolute',
      left: '-4px',
      width: '14px',
      height: '40px',
      borderRadius: '8px',
      cursor: 'grab',
      backgroundColor: this.currentTheme.activeColor,
      boxShadow: `0 0 8px ${this.currentTheme.activeShadow}`,
      top: '0'
    });

    handle.addEventListener('pointerdown', (event) => this.startSliderDrag(event));

    slider.appendChild(handle);
    this.container.appendChild(slider);

    this.slider = slider;
    this.sliderHandle = handle;
  }

  private updateSliderVisibility(): void {
    if (!this.slider || !this.sliderHandle) return;
    const wrapperHeight = this.nodesWrapper.clientHeight || 0;

    if (wrapperHeight === 0 || this.contentHeight <= wrapperHeight + 1) {
      this.hideSlider();
      return;
    }

    this.sliderVisible = true;
    const sliderHeight = Math.max(120, Math.min(wrapperHeight, 240));
    this.slider.style.display = 'flex';
    this.slider.style.height = `${sliderHeight}px`;
    this.slider.style.top = `calc(50% - ${sliderHeight / 2}px)`;

    const ratio = wrapperHeight / this.contentHeight;
    const handleHeight = Math.max(24, Math.min(sliderHeight - 12, sliderHeight * ratio));
    this.sliderHandle.style.height = `${handleHeight}px`;
    this.sliderDragMaxTop = Math.max(1, sliderHeight - handleHeight);

    this.syncSliderToScroll();
  }

  private hideSlider(): void {
    if (!this.slider || !this.sliderHandle) return;
    this.sliderVisible = false;
    this.slider.style.display = 'none';
    this.sliderHandle.style.top = '0px';
  }

  private syncSliderToScroll(): void {
    if (!this.slider || !this.sliderHandle || !this.sliderVisible) return;
    const wrapperHeight = this.nodesWrapper.clientHeight || 0;
    const maxScroll = Math.max(1, this.contentHeight - wrapperHeight);
    const ratio = maxScroll > 0 ? this.nodesWrapper.scrollTop / maxScroll : 0;
    this.sliderHandle.style.top = `${ratio * this.sliderDragMaxTop}px`;
  }

  private startSliderDrag(event: PointerEvent): void {
    if (!this.sliderHandle || !this.sliderVisible) return;
    event.preventDefault();
    this.sliderDragging = true;
    this.sliderPointerId = event.pointerId;
    this.sliderHandle.setPointerCapture(event.pointerId);
    this.sliderHandle.style.cursor = 'grabbing';
    this.sliderDragStartY = event.clientY;
    this.sliderDragStartHandleTop = this.sliderHandle.offsetTop || 0;

    const sliderHeight = this.slider?.clientHeight || 0;
    const handleHeight = this.sliderHandle.clientHeight || 0;
    this.sliderDragMaxTop = Math.max(1, sliderHeight - handleHeight);

    this.sliderPointerMoveHandler = (e) => this.handleSliderDrag(e);
    this.sliderPointerUpHandler = (e) => this.endSliderDrag(e);
    window.addEventListener('pointermove', this.sliderPointerMoveHandler, { passive: false });
    window.addEventListener('pointerup', this.sliderPointerUpHandler, { passive: true });
  }

  private handleSliderDrag(event: PointerEvent): void {
    if (!this.sliderDragging || !this.sliderHandle) return;
    event.preventDefault();
    const deltaY = event.clientY - this.sliderDragStartY;
    let nextTop = this.sliderDragStartHandleTop + deltaY;
    nextTop = Math.max(0, Math.min(nextTop, this.sliderDragMaxTop));
    this.sliderHandle.style.top = `${nextTop}px`;

    const wrapperHeight = this.nodesWrapper.clientHeight || 0;
    const maxScroll = Math.max(1, this.contentHeight - wrapperHeight);
    const ratio = this.sliderDragMaxTop > 0 ? nextTop / this.sliderDragMaxTop : 0;
    this.nodesWrapper.scrollTop = ratio * maxScroll;
  }

  private endSliderDrag(event?: PointerEvent): void {
    if (!this.sliderDragging) return;
    if (event) {
      event.preventDefault();
    }
    this.sliderDragging = false;
    if (this.sliderPointerId !== null && this.sliderHandle) {
      try {
        this.sliderHandle.releasePointerCapture(this.sliderPointerId);
      } catch {
        // ignore
      }
    }
    this.sliderPointerId = null;
    if (this.sliderHandle) {
      this.sliderHandle.style.cursor = 'grab';
    }
    this.detachSliderEvents();
    this.syncSliderToScroll();
  }

  private detachSliderEvents(): void {
    if (this.sliderPointerMoveHandler) {
      window.removeEventListener('pointermove', this.sliderPointerMoveHandler);
      this.sliderPointerMoveHandler = undefined;
    }
    if (this.sliderPointerUpHandler) {
      window.removeEventListener('pointerup', this.sliderPointerUpHandler);
      this.sliderPointerUpHandler = undefined;
    }
  }
}
