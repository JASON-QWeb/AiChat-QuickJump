import type { PromptAnswerItem } from './answerIndexManager';
import { PinnedStore } from '../store/pinnedStore';
import { FavoriteStore, type FavoriteConversation } from '../store/favoriteStore';
import {
  FavoriteArchiveStore,
  addArchiveLinkToFolder,
  cleanupArchivedLinks,
  createArchiveFolder,
  deleteArchiveFolder,
  findArchiveFolder,
  getAllArchivedLinkKeys,
  removeArchiveLinkFromFolder,
  renameArchiveFolder,
  toFavoriteLinkKey,
  type FavoriteArchiveLink,
  type FavoriteArchiveState,
  type FavoriteArchiveFolder
} from '../store/favoriteArchiveStore';
import { themes, resolveTheme, type ThemeMode, type TimelineTheme } from './themes';
import { getTranslation, getSystemLanguage, type Language } from '../../utils/i18n';
import {
  ChristmasThemeEffects,
  SciFiThemeEffects,
  injectThemeAnimationStyles
} from './themeEffects';

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
   * 如果有标记节点但未收藏，自动创建收藏
   */
  private async autoFavoriteIfNeeded(): Promise<void> {
    if (!this.conversationId || this.items.length === 0) return;

    const isExplicitlyFavorited = await FavoriteStore.isFavorited(this.conversationId);
    if (isExplicitlyFavorited) return;

    if (this.pinnedNodes.size > 0) {
      const pinnedItems: Array<{ index: number; promptText: string }> = [];
      this.pinnedNodes.forEach(nodeId => {
        const index = parseInt(nodeId);
        if (this.items[index]) {
          pinnedItems.push({
            index,
            promptText: this.items[index].promptText
          });
        }
      });

      if (pinnedItems.length > 0) {
        const chatTitle = this.items.length > 0 ? this.items[0].promptText : this.t('favorites.unnamed');
        await FavoriteStore.favoriteConversation(
          this.conversationId,
          this.currentUrl,
          this.siteName || 'Unknown',
          chatTitle,
          pinnedItems
        );
        this.isFavorited = true;
        this.updateTopStarStyle();
      }
    }
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

  /**
   * 创建顶部单星按钮（收藏当前对话）
   */
  private createTopStarButton(): void {
    const button = document.createElement('div');
    button.className = 'timeline-top-star';

    Object.assign(button.style, {
      position: 'absolute',
      top: '-30px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '24px',
      height: '24px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '18px',
      opacity: '0.5',
      transition: 'all 0.2s ease',
      zIndex: '10'
    });

    button.innerHTML = '☆'; // 空心星星
    button.title = this.t('favorites.add');

    button.addEventListener('mouseenter', () => {
      button.style.opacity = '1';
      button.style.transform = 'translateX(-50%) scale(1.2)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.opacity = this.isFavorited ? '1' : '0.5';
      button.style.transform = 'translateX(-50%) scale(1)';
    });

    button.addEventListener('click', () => this.handleFavoriteClick());

    this.container.appendChild(button);
    this.topStarButton = button;
  }

  /**
   * 创建底部三星按钮（打开收藏列表）
   */
  private createBottomStarsButton(): void {
    const button = document.createElement('div');
    button.className = 'timeline-bottom-stars';

    Object.assign(button.style, {
      position: 'absolute',
      bottom: '-35px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '36px',
      height: '28px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '16px',
      opacity: '1', // 常亮状态
      transition: 'all 0.2s ease',
      zIndex: '10',
      color: this.currentTheme.pinnedColor // 跟随主题颜色
    });

    // 三星重叠效果
    button.innerHTML = `
      <span style="position: relative;">
        <span style="position: absolute; left: -6px; top: 0; opacity: 0.7;">★</span>
        <span style="position: relative; z-index: 1;">★</span>
        <span style="position: absolute; left: 6px; top: 0; opacity: 0.7;">★</span>
      </span>
    `;
    button.title = this.t('favorites.viewAll');

    button.addEventListener('mouseenter', () => {
      button.style.transform = 'translateX(-50%) scale(1.2)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'translateX(-50%) scale(1)';
    });

    button.addEventListener('click', () => this.showFavoritesModal());

    this.container.appendChild(button);
    this.bottomStarsButton = button;
  }

  /**
   * 更新底部三星样式（主题变化时调用）
   */
  private updateBottomStarsStyle(): void {
    if (!this.bottomStarsButton) return;

    const themeTypeFlag = this.currentTheme.themeType;

    // 首先彻底清除所有内容，防止重复元素
    while (this.bottomStarsButton.firstChild) {
      this.bottomStarsButton.removeChild(this.bottomStarsButton.firstChild);
    }
    this.bottomStarsButton.innerHTML = '';

    if (themeTypeFlag === 'christmas') {
      // 圣诞主题：礼物图片
      this.bottomStarsButton.innerHTML = ChristmasThemeEffects.createBottomGifts();
      this.bottomStarsButton.style.color = '';
      this.bottomStarsButton.style.width = '40px';
      this.bottomStarsButton.style.height = '32px';
    } else if (themeTypeFlag === 'scifi') {
      // 科幻主题：Love Death Robots 动画（5s周期）
      const ldrElement = SciFiThemeEffects.createLDRBottom();
      this.bottomStarsButton.appendChild(ldrElement);
      this.bottomStarsButton.style.color = '';
      this.bottomStarsButton.style.width = '65px';
      this.bottomStarsButton.style.height = '40px';
    } else {
      // 普通主题：三星
      this.bottomStarsButton.innerHTML = `
        <span style="position: relative;">
          <span style="position: absolute; left: -6px; top: 0; opacity: 0.7;">★</span>
          <span style="position: relative; z-index: 1;">★</span>
          <span style="position: absolute; left: 6px; top: 0; opacity: 0.7;">★</span>
        </span>
      `;
      this.bottomStarsButton.style.color = this.currentTheme.pinnedColor;
      this.bottomStarsButton.style.width = '36px';
      this.bottomStarsButton.style.height = '28px';
    }
  }

  /**
   * 处理收藏按钮点击
   */
  private async handleFavoriteClick(): Promise<void> {
    if (!this.conversationId) return;

    this.currentUrl = window.location.href;

    if (this.isFavorited) {
      // 取消收藏
      await FavoriteStore.unfavoriteConversation(this.conversationId);
      this.isFavorited = false;
    } else {
      // 收藏当前对话
      // 收集所有被标记的节点
      const pinnedItems: Array<{ index: number; promptText: string }> = [];

      this.pinnedNodes.forEach(nodeId => {
        const index = parseInt(nodeId);
        if (this.items[index]) {
          pinnedItems.push({
            index,
            promptText: this.items[index].promptText
          });
        }
      });

      // 如果没有标记的节点，收藏整个对话（使用第一个节点作为代表）
      if (pinnedItems.length === 0 && this.items.length > 0) {
        pinnedItems.push({
          index: 0,
          promptText: this.items[0].promptText
        });
      }

      // 获取整个对话的标题（使用第一个问题的文本）
      const chatTitle = this.items.length > 0 ? this.items[0].promptText : this.t('favorites.unnamed');

      await FavoriteStore.favoriteConversation(
        this.conversationId,
        this.currentUrl,
        this.siteName || 'Unknown',
        chatTitle,
        pinnedItems
      );
      this.isFavorited = true;
    }

    this.updateTopStarStyle();

    // 添加跳跃动画反馈
    this.playStarBounceAnimation();
  }

  /**
   * 播放星星跳跃动画
   */
  private playStarBounceAnimation(): void {
    if (!this.topStarButton) return;

    // 添加跳跃动画
    this.topStarButton.style.transition = 'transform 0.1s ease-out';
    this.topStarButton.style.transform = 'translateX(-50%) scale(1.4) translateY(-8px)';

    setTimeout(() => {
      if (this.topStarButton) {
        this.topStarButton.style.transform = 'translateX(-50%) scale(0.9) translateY(2px)';
      }
    }, 100);

    setTimeout(() => {
      if (this.topStarButton) {
        this.topStarButton.style.transform = 'translateX(-50%) scale(1.1) translateY(-3px)';
      }
    }, 200);

    setTimeout(() => {
      if (this.topStarButton) {
        this.topStarButton.style.transform = 'translateX(-50%) scale(1)';
        this.topStarButton.style.transition = 'all 0.2s ease';
      }
    }, 300);
  }

  /**
   * 同步标记节点到收藏（当标记状态变化时调用）
   * 如果有标记节点但尚未收藏，会自动创建收藏
   */
  async syncPinnedToFavorites(): Promise<void> {
    if (!this.conversationId) return;

    // 收集当前所有被标记的节点
    const pinnedItems: Array<{ index: number; promptText: string }> = [];

    this.pinnedNodes.forEach(nodeId => {
      const index = parseInt(nodeId);
      if (this.items[index]) {
        pinnedItems.push({
          index,
          promptText: this.items[index].promptText
        });
      }
    });

    // 如果有标记的节点但尚未收藏，自动创建收藏
    if (pinnedItems.length > 0 && !this.isFavorited) {
      this.currentUrl = window.location.href;
      const chatTitle = this.items.length > 0 ? this.items[0].promptText : this.t('favorites.unnamed');

      await FavoriteStore.favoriteConversation(
        this.conversationId,
        this.currentUrl,
        this.siteName || 'Unknown',
        chatTitle,
        pinnedItems
      );
      this.isFavorited = true;
      this.updateTopStarStyle();
      this.playStarBounceAnimation();
      return;
    }

    // 如果已收藏，更新收藏的子项
    if (this.isFavorited) {
      // 如果没有标记的节点了，保留第一个节点作为代表
      if (pinnedItems.length === 0 && this.items.length > 0) {
        pinnedItems.push({
          index: 0,
          promptText: this.items[0].promptText
        });
      }
      await FavoriteStore.updateFavoriteItems(this.conversationId, pinnedItems);
    }
  }

  /**
   * 更新顶部星星样式
   */
  private updateTopStarStyle(): void {
    if (!this.topStarButton) return;

    const themeTypeFlag = this.currentTheme.themeType;

    if (themeTypeFlag === 'christmas') {
      // 圣诞主题：梦幻模糊星星，根据收藏状态显示不同亮度
      this.topStarButton.innerHTML = ChristmasThemeEffects.createTopStar(this.isFavorited);
      this.topStarButton.style.opacity = '1';
      this.topStarButton.style.color = '';
    } else if (themeTypeFlag === 'scifi') {
      // 科幻主题：红色骷髅头
      this.topStarButton.innerHTML = SciFiThemeEffects.createTopSkull(this.isFavorited);
      this.topStarButton.style.opacity = '1';
      this.topStarButton.style.color = '';
    } else {
      // 普通主题：星星
      if (this.isFavorited) {
        this.topStarButton.innerHTML = '★'; // 实心星星
        this.topStarButton.style.color = this.currentTheme.pinnedColor;
        this.topStarButton.style.opacity = '1';
      } else {
        this.topStarButton.innerHTML = '☆'; // 空心星星
        this.topStarButton.style.color = this.currentTheme.defaultNodeColor;
        this.topStarButton.style.opacity = '0.5';
      }
    }

    this.topStarButton.title = this.isFavorited ? this.t('favorites.remove') : this.t('favorites.add');
  }

  /**
   * 刷新收藏弹窗（保持当前视图）
   */
  private async refreshFavoritesModalIfOpen(): Promise<void> {
    if (!this.favoritesModal) return;
    const currentView = this.favoritesModalView;
    await this.showFavoritesModal(currentView);
  }

  /**
   * 显示收藏列表弹窗
   */
  private async showFavoritesModal(initialView: 'front' | 'back' = 'front'): Promise<void> {
    // 如果弹窗已存在，先移除
    this.removeFavoritesModalElements();
    this.favoritesModalView = initialView;

    type FavoriteLinkInfo = {
      key: string;
      link: FavoriteArchiveLink;
      conv: FavoriteConversation;
      promptText: string;
      timestamp: number;
    };

    const buildLinkIndex = (favs: FavoriteConversation[]) => {
      const byKey = new Map<string, FavoriteLinkInfo>();
      const allLinks: FavoriteLinkInfo[] = [];

      favs.forEach((conv) => {
        conv.items.forEach((item) => {
          const link: FavoriteArchiveLink = {
            conversationId: conv.conversationId,
            nodeIndex: item.nodeIndex
          };
          const key = toFavoriteLinkKey(link);
          const info: FavoriteLinkInfo = {
            key,
            link,
            conv,
            promptText: item.promptText,
            timestamp: item.timestamp
          };
          byKey.set(key, info);
          allLinks.push(info);
        });
      });

      allLinks.sort((a, b) => b.timestamp - a.timestamp);
      return { byKey, allLinks, existingKeys: new Set(allLinks.map((l) => l.key)) };
    };

    let favorites = await FavoriteStore.loadAll();
    let { byKey: linkInfoByKey, allLinks: allFavoriteLinks, existingKeys: existingLinkKeys } =
      buildLinkIndex(favorites);

    let archiveState: FavoriteArchiveState = await FavoriteArchiveStore.load();
    if (cleanupArchivedLinks(archiveState, existingLinkKeys)) {
      await FavoriteArchiveStore.save(archiveState);
    }

    const expandedFolderIds = new Set<string>();
    archiveState.rootFolders.forEach((f) => expandedFolderIds.add(f.id));

    let importOverlay: HTMLElement | null = null;
    let importListContainer: HTMLElement | null = null;
    let importFolderId: string | null = null;
    let archiveContent: HTMLElement | null = null;

    const refreshFavoritesCache = async (): Promise<void> => {
      favorites = await FavoriteStore.loadAll();
      const built = buildLinkIndex(favorites);
      linkInfoByKey = built.byKey;
      allFavoriteLinks = built.allLinks;
      existingLinkKeys = built.existingKeys;
      if (cleanupArchivedLinks(archiveState, existingLinkKeys)) {
        await FavoriteArchiveStore.save(archiveState);
      }
    };

    const hoverBg =
      this.currentTheme.name === '暗色' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

    const createIconButton = (opts: {
      title: string;
      svg: string;
      onClick: (e: MouseEvent) => void;
      danger?: boolean;
    }): HTMLButtonElement => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.title = opts.title;
      btn.setAttribute('aria-label', opts.title);
      btn.innerHTML = opts.svg;
      Object.assign(btn.style, {
        background: 'none',
        border: 'none',
        padding: '6px',
        cursor: 'pointer',
        color: opts.danger ? '#e53935' : this.currentTheme.tooltipTextColor,
        opacity: '0.6',
        borderRadius: '8px',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: '0'
      });
      btn.addEventListener('mouseenter', () => {
        btn.style.opacity = '1';
        btn.style.backgroundColor = hoverBg;
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.opacity = '0.6';
        btn.style.backgroundColor = 'transparent';
      });
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        opts.onClick(e);
      });
      return btn;
    };

    const closeImportDialog = (): void => {
      if (importOverlay) {
        importOverlay.remove();
        importOverlay = null;
        importListContainer = null;
        importFolderId = null;
      }
    };

    const renderImportList = (): void => {
      if (!importListContainer || !importFolderId) return;

      const listContainer = importListContainer;
      const targetFolderId = importFolderId;

      listContainer.innerHTML = '';
      const archivedKeys = getAllArchivedLinkKeys(archiveState);
      const available = allFavoriteLinks.filter((l) => !archivedKeys.has(l.key));

      if (available.length === 0) {
        const empty = document.createElement('div');
        empty.textContent = this.t('favorites.archive.noImportable');
        Object.assign(empty.style, {
          padding: '18px 12px',
          textAlign: 'center',
          opacity: '0.7'
        });
        listContainer.appendChild(empty);
        return;
      }

      available.forEach((info) => {
        const row = document.createElement('div');
        Object.assign(row.style, {
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 10px',
          borderRadius: '10px',
          cursor: 'default'
        });

        row.addEventListener('mouseenter', () => {
          row.style.backgroundColor = hoverBg;
        });
        row.addEventListener('mouseleave', () => {
          row.style.backgroundColor = 'transparent';
        });

        const text = document.createElement('div');
        Object.assign(text.style, {
          flex: '1',
          minWidth: '0',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        });

        const siteIcon = document.createElement('img');
        siteIcon.src = this.getSiteIconUrl(info.conv.siteName);
        siteIcon.alt = info.conv.siteName;
        siteIcon.title = info.conv.siteName;
        Object.assign(siteIcon.style, {
          width: '16px',
          height: '16px',
          borderRadius: '3px',
          flexShrink: '0',
          objectFit: 'contain'
        });
        siteIcon.onerror = () => {
          siteIcon.remove();
        };
        text.appendChild(siteIcon);

        const main = document.createElement('div');
        const displayText =
          info.promptText.length > 60 ? info.promptText.substring(0, 60) + '...' : info.promptText;
        main.textContent = displayText;
        Object.assign(main.style, {
          fontSize: '13px',
          fontWeight: '500',
          flex: '1',
          minWidth: '0',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        });

        text.appendChild(main);

        const addBtn = createIconButton({
          title: this.t('favorites.archive.addToFolder'),
          svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>`,
          onClick: async () => {
            addArchiveLinkToFolder(archiveState, targetFolderId, info.link);
            await FavoriteArchiveStore.save(archiveState);
            renderArchiveTree();
            renderImportList();
          }
        });

        row.appendChild(text);
        row.appendChild(addBtn);
        listContainer.appendChild(row);
      });
    };

    const openImportDialog = async (folderId: string): Promise<void> => {
      await refreshFavoritesCache();
      closeImportDialog();

      const folder = findArchiveFolder(archiveState, folderId);
      if (!folder) return;
      importFolderId = folderId;

      const overlay = document.createElement('div');
      overlay.className = 'llm-favorites-import-overlay';
      Object.assign(overlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        backgroundColor: 'rgba(0,0,0,0.4)',
        zIndex: '2147483648',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      });
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeImportDialog();
      });

      const dialog = document.createElement('div');
      Object.assign(dialog.style, {
        backgroundColor: this.currentTheme.tooltipBackgroundColor,
        color: this.currentTheme.tooltipTextColor,
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
        width: '720px',
        maxWidth: '92vw',
        maxHeight: '75vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      });

      const header = document.createElement('div');
      Object.assign(header.style, {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 16px',
        borderBottom: '1px solid rgba(128,128,128,0.2)'
      });

      const title = document.createElement('div');
      title.textContent = `${this.t('favorites.archive.importTo')}: ${folder.name}`;
      Object.assign(title.style, { fontSize: '14px', fontWeight: '600', overflow: 'hidden' });

      const closeBtn = createIconButton({
        title: this.t('favorites.archive.close'),
        svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
        onClick: () => closeImportDialog()
      });

      header.appendChild(title);
      header.appendChild(closeBtn);

      const list = document.createElement('div');
      Object.assign(list.style, {
        flex: '1',
        overflowY: 'auto',
        padding: '10px 12px'
      });

      importOverlay = overlay;
      importListContainer = list;

      dialog.appendChild(header);
      dialog.appendChild(list);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      renderImportList();
    };

    const renderFavoritesList = (container: HTMLElement): void => {
      container.innerHTML = '';
      if (favorites.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.textContent = this.t('favorites.empty');
        Object.assign(emptyMsg.style, {
          textAlign: 'center',
          color: 'rgba(128,128,128,0.8)',
          padding: '40px 0'
        });
        container.appendChild(emptyMsg);
        return;
      }

      favorites.forEach((conv) => {
        const convItem = this.createConversationItem(conv);
        container.appendChild(convItem);
      });
    };

    const renderArchiveTree = (): void => {
      if (!archiveContent) return;
      const treeContainer = archiveContent;

      treeContainer.innerHTML = '';

      if (archiveState.rootFolders.length === 0) {
        const empty = document.createElement('div');
        empty.textContent = this.t('favorites.archive.noFolders');
        Object.assign(empty.style, {
          padding: '22px 10px',
          textAlign: 'center',
          opacity: '0.7'
        });
        treeContainer.appendChild(empty);
        return;
      }

      const renderLinkRow = (folderId: string, link: FavoriteArchiveLink): HTMLElement => {
        const key = toFavoriteLinkKey(link);
        const info = linkInfoByKey.get(key);

        const row = document.createElement('div');
        Object.assign(row.style, {
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 10px',
          borderRadius: '10px',
          cursor: info ? 'pointer' : 'default',
          marginTop: '6px'
        });

        row.addEventListener('mouseenter', () => {
          row.style.backgroundColor = hoverBg;
        });
        row.addEventListener('mouseleave', () => {
          row.style.backgroundColor = 'transparent';
        });

        const text = document.createElement('div');
        Object.assign(text.style, {
          flex: '1',
          minWidth: '0',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        });

        if (info) {
          const siteIcon = document.createElement('img');
          siteIcon.src = this.getSiteIconUrl(info.conv.siteName);
          siteIcon.alt = info.conv.siteName;
          siteIcon.title = info.conv.siteName;
          Object.assign(siteIcon.style, {
            width: '16px',
            height: '16px',
            borderRadius: '3px',
            flexShrink: '0',
            objectFit: 'contain'
          });
          siteIcon.onerror = () => {
            siteIcon.remove();
          };
          text.appendChild(siteIcon);
        }

        const main = document.createElement('div');
        main.textContent = info
          ? info.promptText.length > 60
            ? info.promptText.substring(0, 60) + '...'
            : info.promptText
          : this.t('favorites.archive.missingLink');
        Object.assign(main.style, {
          fontSize: '13px',
          fontWeight: '500',
          flex: '1',
          minWidth: '0',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        });

        text.appendChild(main);

        const removeBtn = createIconButton({
          title: this.t('favorites.archive.removeFromFolder'),
          svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
          onClick: async () => {
            removeArchiveLinkFromFolder(archiveState, folderId, link);
            await FavoriteArchiveStore.save(archiveState);
            renderArchiveTree();
            renderImportList();
          }
        });

        if (info) {
          row.addEventListener('click', () => this.navigateToFavorite(info.conv, info.link.nodeIndex));
        }

        row.appendChild(text);
        row.appendChild(removeBtn);
        return row;
      };

      const renderFolder = (folder: FavoriteArchiveFolder, depth: number): HTMLElement => {
        const wrapper = document.createElement('div');
        Object.assign(wrapper.style, { marginTop: depth === 0 ? '10px' : '6px' });

        const row = document.createElement('div');
        Object.assign(row.style, {
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 10px',
          borderRadius: '12px',
          cursor: 'pointer',
          userSelect: 'none'
        });

        row.addEventListener('mouseenter', () => {
          row.style.backgroundColor = hoverBg;
        });
        row.addEventListener('mouseleave', () => {
          row.style.backgroundColor = 'transparent';
        });

        const indent = document.createElement('div');
        Object.assign(indent.style, { width: `${depth * 16}px`, flexShrink: '0' });

        const hasChildren = folder.folders.length > 0 || folder.links.length > 0;
        const isExpanded = expandedFolderIds.has(folder.id);

        const expandIcon = document.createElement('span');
        expandIcon.textContent = hasChildren ? '▶' : '•';
        Object.assign(expandIcon.style, {
          fontSize: '10px',
          opacity: hasChildren ? '0.65' : '0.35',
          transform: hasChildren && isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease',
          width: '12px',
          display: 'inline-flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexShrink: '0'
        });

        const folderIcon = document.createElement('span');
        folderIcon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"></path></svg>`;
        Object.assign(folderIcon.style, { opacity: '0.8', flexShrink: '0' });

        const name = document.createElement('div');
        name.textContent = folder.name;
        Object.assign(name.style, {
          flex: '1',
          minWidth: '0',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: '13px',
          fontWeight: '600'
        });

        const actions = document.createElement('div');
        Object.assign(actions.style, {
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          flexShrink: '0'
        });

        const importBtn = createIconButton({
          title: this.t('favorites.archive.import'),
          svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
          onClick: () => openImportDialog(folder.id)
        });

        const addFolderBtn = createIconButton({
          title: this.t('favorites.archive.newSubfolder'),
          svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v2"></path><path d="M21 15v6"></path><path d="M18 18h6"></path><path d="M3 11v8a2 2 0 0 0 2 2h11"></path></svg>`,
          onClick: async () => {
            const folderName = await this.showInputDialog(
              this.t('favorites.archive.newSubfolder'),
              '',
              this.t('favorites.archive.folderNamePlaceholder')
            );
            if (!folderName) return;
            const created = createArchiveFolder(archiveState, folder.id, folderName);
            expandedFolderIds.add(folder.id);
            expandedFolderIds.add(created.id);
            await FavoriteArchiveStore.save(archiveState);
            renderArchiveTree();
          }
        });

        const renameBtn = createIconButton({
          title: this.t('favorites.archive.rename'),
          svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg>`,
          onClick: async () => {
            const folderName = await this.showInputDialog(
              this.t('favorites.archive.rename'),
              folder.name,
              this.t('favorites.archive.folderNamePlaceholder')
            );
            if (!folderName) return;
            renameArchiveFolder(archiveState, folder.id, folderName);
            await FavoriteArchiveStore.save(archiveState);
            renderArchiveTree();
          }
        });

        const deleteBtn = createIconButton({
          title: this.t('favorites.archive.deleteFolder'),
          svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>`,
          danger: true,
          onClick: async () => {
            const confirmed = await this.showConfirmDialog(
              this.t('favorites.archive.folderDeleteConfirm')
            );
            if (!confirmed) return;
            deleteArchiveFolder(archiveState, folder.id);
            expandedFolderIds.delete(folder.id);
            await FavoriteArchiveStore.save(archiveState);
            renderArchiveTree();
            renderImportList();
          }
        });

        actions.appendChild(importBtn);
        actions.appendChild(addFolderBtn);
        actions.appendChild(renameBtn);
        actions.appendChild(deleteBtn);

        row.appendChild(indent);
        row.appendChild(expandIcon);
        row.appendChild(folderIcon);
        row.appendChild(name);
        row.appendChild(actions);

        row.addEventListener('click', () => {
          if (!hasChildren) return;
          if (expandedFolderIds.has(folder.id)) {
            expandedFolderIds.delete(folder.id);
          } else {
            expandedFolderIds.add(folder.id);
          }
          renderArchiveTree();
        });

        wrapper.appendChild(row);

        if (hasChildren && expandedFolderIds.has(folder.id)) {
          const children = document.createElement('div');
          Object.assign(children.style, { marginLeft: '0' });

          folder.links.forEach((l) => children.appendChild(renderLinkRow(folder.id, l)));
          folder.folders.forEach((child) => children.appendChild(renderFolder(child, depth + 1)));

          wrapper.appendChild(children);
        }

        return wrapper;
      };

      archiveState.rootFolders.forEach((f) => treeContainer.appendChild(renderFolder(f, 0)));
    };

    // 创建弹窗（可翻转）
    const modal = document.createElement('div');
    modal.className = 'llm-favorites-modal';

    Object.assign(modal.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '800px',
      maxWidth: '90vw',
      height: '70vh',
      maxHeight: '70vh',
      minHeight: '400px',
      borderRadius: '12px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      zIndex: '2147483647',
      overflow: 'hidden',
      perspective: '1400px'
    });

    const card = document.createElement('div');
    Object.assign(card.style, {
      position: 'relative',
      width: '100%',
      height: '100%',
      transformStyle: 'preserve-3d',
      transition: 'transform 0.55s ease'
    });

    const front = document.createElement('div');
    Object.assign(front.style, {
      position: 'absolute',
      inset: '0',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: this.currentTheme.tooltipBackgroundColor,
      color: this.currentTheme.tooltipTextColor,
      backfaceVisibility: 'hidden'
    });

    const back = document.createElement('div');
    Object.assign(back.style, {
      position: 'absolute',
      inset: '0',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: this.currentTheme.tooltipBackgroundColor,
      color: this.currentTheme.tooltipTextColor,
      backfaceVisibility: 'hidden',
      transform: 'rotateY(180deg)'
    });

    let isArchiveView = initialView === 'back';
    const setArchiveView = async (value: boolean) => {
      isArchiveView = value;
      this.favoritesModalView = value ? 'back' : 'front';
      card.style.transform = isArchiveView ? 'rotateY(180deg)' : 'rotateY(0deg)';
      if (isArchiveView) {
        await refreshFavoritesCache();
        renderArchiveTree();
      }
    };

    const createCloseButton = () =>
      createIconButton({
        title: this.t('favorites.archive.close'),
        svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
        onClick: () => this.closeFavoritesModal()
      });

    const frontHeader = document.createElement('div');
    frontHeader.classList.add('llm-tutorial-favorites-header');
    Object.assign(frontHeader.style, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '16px 20px',
      borderBottom: '1px solid rgba(128,128,128,0.2)'
    });

    const frontTitleGroup = document.createElement('div');
    Object.assign(frontTitleGroup.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      minWidth: '0'
    });

    const frontTitle = document.createElement('h3');
    frontTitle.textContent = this.t('favorites.list');
    Object.assign(frontTitle.style, { margin: '0', fontSize: '16px', fontWeight: '600' });

    const flipToArchiveBtn = createIconButton({
      title: this.t('favorites.archive.open'),
      svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>`,
      onClick: async () => setArchiveView(true)
    });
    flipToArchiveBtn.classList.add('llm-tutorial-flip-archive');

    frontTitleGroup.appendChild(frontTitle);
    frontTitleGroup.appendChild(flipToArchiveBtn);

    const frontRight = document.createElement('div');
    Object.assign(frontRight.style, { display: 'flex', alignItems: 'center', gap: '6px' });
    frontRight.appendChild(createCloseButton());

    frontHeader.appendChild(frontTitleGroup);
    frontHeader.appendChild(frontRight);

    const frontContent = document.createElement('div');
    frontContent.classList.add('llm-tutorial-favorites-content');
    Object.assign(frontContent.style, {
      flex: '1',
      overflowY: 'auto',
      padding: '12px 20px',
      minHeight: '0'
    });
    renderFavoritesList(frontContent);

    front.appendChild(frontHeader);
    front.appendChild(frontContent);
    front.appendChild(this.createFavoritesModalFooter('front'));

    const backHeader = document.createElement('div');
    Object.assign(backHeader.style, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '16px 20px',
      borderBottom: '1px solid rgba(128,128,128,0.2)'
    });

    const backTitleGroup = document.createElement('div');
    Object.assign(backTitleGroup.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      minWidth: '0'
    });

    const backTitle = document.createElement('h3');
    backTitle.textContent = this.t('favorites.archive.title');
    Object.assign(backTitle.style, { margin: '0', fontSize: '16px', fontWeight: '600' });

    const flipToFavoritesBtn = createIconButton({
      title: this.t('favorites.archive.back'),
      svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 3 3 3 3 9"></polyline><polyline points="15 21 21 21 21 15"></polyline><line x1="3" y1="3" x2="10" y2="10"></line><line x1="21" y1="21" x2="14" y2="14"></line></svg>`,
      onClick: async () => setArchiveView(false)
    });

    backTitleGroup.appendChild(backTitle);
    backTitleGroup.appendChild(flipToFavoritesBtn);

    const backRight = document.createElement('div');
    Object.assign(backRight.style, { display: 'flex', alignItems: 'center', gap: '6px' });

    const newFolderBtn = createIconButton({
      title: this.t('favorites.archive.newFolder'),
      svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"></path><path d="M12 11v6"></path><path d="M9 14h6"></path></svg>`,
      onClick: async () => {
        const folderName = await this.showInputDialog(
          this.t('favorites.archive.newFolder'),
          '',
          this.t('favorites.archive.folderNamePlaceholder')
        );
        if (!folderName) return;
        const created = createArchiveFolder(archiveState, null, folderName);
        expandedFolderIds.add(created.id);
        await FavoriteArchiveStore.save(archiveState);
        renderArchiveTree();
      }
    });

    backRight.appendChild(newFolderBtn);
    backRight.appendChild(createCloseButton());

    backHeader.appendChild(backTitleGroup);
    backHeader.appendChild(backRight);

    const backContent = document.createElement('div');
    Object.assign(backContent.style, { flex: '1', overflowY: 'auto', padding: '12px 20px', minHeight: '0' });

    archiveContent = document.createElement('div');
    backContent.appendChild(archiveContent);
    renderArchiveTree();

    back.appendChild(backHeader);
    back.appendChild(backContent);
    back.appendChild(this.createFavoritesModalFooter('back'));

    card.appendChild(front);
    card.appendChild(back);
    modal.appendChild(card);

    // 添加遮罩层
    const overlay = document.createElement('div');
    overlay.className = 'llm-favorites-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      bottom: '0',
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: '2147483646'
    });
    overlay.addEventListener('click', () => this.closeFavoritesModal());

    document.body.appendChild(overlay);
    document.body.appendChild(modal);
    this.favoritesModal = modal;
    this.maybeContinueTutorialAfterFavoritesModalOpened();
    if (initialView === 'back') {
      await setArchiveView(true);
    }
  }

  private createFavoritesModalFooter(side: 'front' | 'back'): HTMLElement {
    const footer = document.createElement('div');
    Object.assign(footer.style, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 20px',
      borderTop: '1px solid rgba(128,128,128,0.2)',
      fontSize: '12px'
    });

    const openSourceLink = document.createElement('a');
    openSourceLink.href = 'https://www.aichatjump.click';
    openSourceLink.textContent = this.t('favorites.footer.openSource');
    openSourceLink.target = '_blank';
    openSourceLink.rel = 'noopener noreferrer';
    Object.assign(openSourceLink.style, {
      flex: '1',
      minWidth: '0',
      color: this.currentTheme.pinnedColor,
      textDecoration: 'underline',
      textUnderlineOffset: '2px',
      opacity: '0.8',
      cursor: 'pointer',
      whiteSpace: 'normal',
      wordBreak: 'break-word',
      lineHeight: '1.4'
    });
    openSourceLink.addEventListener('mouseenter', () => (openSourceLink.style.opacity = '1'));
    openSourceLink.addEventListener('mouseleave', () => (openSourceLink.style.opacity = '0.8'));

    const settingsBtn = document.createElement('button');
    settingsBtn.classList.add('llm-favorites-settings-btn');
    settingsBtn.dataset.tutorialSide = side;
    settingsBtn.type = 'button';
    settingsBtn.title = this.t('favorites.footer.settings');
    settingsBtn.setAttribute('aria-label', this.t('favorites.footer.settings'));
    settingsBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V22a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 20.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 3.6a1.65 1.65 0 0 0 1-1.51V2a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 20.4 9a1.65 1.65 0 0 0 1.51 1H22a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
    Object.assign(settingsBtn.style, {
      background: 'none',
      border: 'none',
      padding: '6px',
      cursor: 'pointer',
      color: this.currentTheme.tooltipTextColor,
      opacity: '0.6',
      borderRadius: '8px',
      transition: 'all 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: '0'
    });
    settingsBtn.addEventListener('mouseenter', () => {
      settingsBtn.style.opacity = '1';
      settingsBtn.style.backgroundColor = 'rgba(128,128,128,0.12)';
    });
    settingsBtn.addEventListener('mouseleave', () => {
      settingsBtn.style.opacity = '0.6';
      settingsBtn.style.backgroundColor = 'transparent';
    });
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openOptionsPage();
    });

    footer.appendChild(openSourceLink);
    footer.appendChild(settingsBtn);
    return footer;
  }

  private openOptionsPage(): void {
    try {
      chrome.runtime.sendMessage({ type: 'LLM_NAV_OPEN_OPTIONS' });
      return;
    } catch {
      // ignore
    }

    try {
      chrome.runtime.openOptionsPage?.();
      return;
    } catch {
      // ignore
    }

    try {
      window.open(chrome.runtime.getURL('options/index.html'), '_blank', 'noopener,noreferrer');
    } catch {
      // ignore
    }
  }

  private async isTutorialEnabled(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(RightSideTimelinejump.TUTORIAL_ENABLED_KEY, (result) => {
          if (chrome.runtime.lastError) {
            resolve(true);
            return;
          }

          const value = result[RightSideTimelinejump.TUTORIAL_ENABLED_KEY];
          resolve(value !== false);
        });
      } catch {
        resolve(true);
      }
    });
  }

  private async setTutorialEnabled(enabled: boolean): Promise<void> {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [RightSideTimelinejump.TUTORIAL_ENABLED_KEY]: enabled }, () => resolve());
      } catch {
        resolve();
      }
    });
  }

  private maybeStartTutorial(): void {
    if (this.tutorialStartRequested) return;
    if (this.nodes.length === 0) return;

    this.tutorialStartRequested = true;
    void (async () => {
      const enabled = await this.isTutorialEnabled();
      if (!enabled) return;

      // 触发后即标记为 false，确保仅出现一次
      await this.setTutorialEnabled(false);

      window.setTimeout(() => {
        if (!this.nodes[0] || !this.nodes[0].isConnected) return;
        this.startTutorialStep1();
      }, 250);
    })();
  }

  private addTutorialListener(
    target: EventTarget,
    type: string,
    handler: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean
  ): void {
    target.addEventListener(type, handler, options);
    this.tutorialListeners.push({ target, type, handler, options });
  }

  private clearTutorialListeners(): void {
    this.tutorialListeners.forEach(({ target, type, handler, options }) => {
      try {
        target.removeEventListener(type, handler, options as any);
      } catch {
        // ignore
      }
    });
    this.tutorialListeners = [];
  }

  private clearTutorialTimeouts(): void {
    this.tutorialTimeoutIds.forEach((id) => window.clearTimeout(id));
    this.tutorialTimeoutIds = [];
  }

  private endTutorial(): void {
    this.clearTutorialTimeouts();
    this.clearTutorialListeners();
    this.tutorialWaitingForFavoritesModal = false;
    this.tutorialSkipConfirming = false;
    this.tutorialStep = 0;
    this.tutorialAnchor = null;

    if (this.tutorialResizeHandler) {
      window.removeEventListener('resize', this.tutorialResizeHandler);
      this.tutorialResizeHandler = null;
    }

    if (this.tutorialBubble) {
      this.tutorialBubble.remove();
      this.tutorialBubble = null;
      this.tutorialBubbleArrow = null;
      this.tutorialBubbleTitle = null;
      this.tutorialBubbleText = null;
      this.tutorialBubblePrompt = null;
      this.tutorialBubbleActions = null;
    }
  }

  private showTutorialBubble(opts: {
    step: 1 | 2 | 3 | 4 | 5;
    target: HTMLElement;
    placement: 'left' | 'right' | 'top' | 'bottom';
    message: string;
  }): void {
    this.tutorialSkipConfirming = false;
    this.tutorialAnchor = opts.target;
    this.tutorialPlacement = opts.placement;

    if (!this.tutorialBubble) {
      const bubble = document.createElement('div');
      bubble.className = 'llm-tutorial-bubble';
      Object.assign(bubble.style, {
        position: 'fixed',
        zIndex: '2147483650',
        maxWidth: '320px',
        minWidth: '220px',
        padding: '12px 12px 10px 12px',
        borderRadius: '12px',
        backgroundColor: this.currentTheme.tooltipBackgroundColor,
        color: this.currentTheme.tooltipTextColor,
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

      this.tutorialBubble = bubble;
      this.tutorialBubbleArrow = arrow;
      this.tutorialBubbleTitle = title;
      this.tutorialBubbleText = text;
      this.tutorialBubblePrompt = prompt;
      this.tutorialBubbleActions = actions;

      this.tutorialResizeHandler = () => this.positionTutorialBubble();
      window.addEventListener('resize', this.tutorialResizeHandler);
    }

    if (!this.tutorialBubbleTitle || !this.tutorialBubbleText || !this.tutorialBubblePrompt) return;

    this.tutorialBubbleTitle.textContent = `${this.t('tutorial.title')} (${opts.step}/5)`;
    this.tutorialBubbleText.textContent = opts.message;
    this.tutorialBubblePrompt.style.display = 'none';
    this.tutorialBubblePrompt.textContent = '';

    this.renderTutorialActions();
    this.positionTutorialBubble();
    requestAnimationFrame(() => this.positionTutorialBubble());
  }

  private renderTutorialActions(): void {
    if (!this.tutorialBubbleActions || !this.tutorialBubblePrompt) return;
    const actions = this.tutorialBubbleActions;
    actions.innerHTML = '';
    this.tutorialBubblePrompt.textContent = '';
    this.tutorialBubblePrompt.style.display = 'none';

    const baseBtnStyle: Partial<CSSStyleDeclaration> = {
      padding: '6px 10px',
      borderRadius: '10px',
      border: '1px solid rgba(128,128,128,0.3)',
      backgroundColor: 'transparent',
      color: this.currentTheme.tooltipTextColor,
      cursor: 'pointer',
      fontSize: '12px',
      transition: 'all 0.2s ease'
    };

    const primaryBtnStyle: Partial<CSSStyleDeclaration> = {
      ...baseBtnStyle,
      border: 'none',
      backgroundColor: this.currentTheme.activeColor,
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

    if (!this.tutorialSkipConfirming) {
      const skipBtn = createBtn(this.t('tutorial.skip'), baseBtnStyle);
      skipBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.tutorialSkipConfirming = true;
        this.renderTutorialActions();
      });
      actions.appendChild(skipBtn);
      return;
    }

    this.tutorialBubblePrompt.textContent = this.t('tutorial.skipConfirm');
    this.tutorialBubblePrompt.style.display = 'block';

    const cancelBtn = createBtn(this.t('favorites.cancel'), baseBtnStyle);
    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.tutorialSkipConfirming = false;
      this.renderTutorialActions();
    });

    const confirmBtn = createBtn(this.t('favorites.confirm'), primaryBtnStyle);
    confirmBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.endTutorial();
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
  }

  private positionTutorialBubble(): void {
    if (!this.tutorialBubble || !this.tutorialBubbleArrow || !this.tutorialAnchor) return;
    if (!this.tutorialAnchor.isConnected) return;

    const targetRect = this.tutorialAnchor.getBoundingClientRect();
    const bubbleRect = this.tutorialBubble.getBoundingClientRect();
    const gap = 12;
    const margin = 10;

    let left = 0;
    let top = 0;

    const placement = this.tutorialPlacement;
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

    this.tutorialBubble.style.left = `${left}px`;
    this.tutorialBubble.style.top = `${top}px`;

    const bg = this.currentTheme.tooltipBackgroundColor;
    const arrow = this.tutorialBubbleArrow;
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

  private startTutorialStep1(): void {
    const firstNode = this.nodes[0];
    if (!firstNode) return;
    this.tutorialStep = 1;

    this.showTutorialBubble({
      step: 1,
      target: firstNode,
      placement: 'left',
      message: this.t('tutorial.step1')
    });

    const onHover = () => {
      if (this.tutorialStep !== 1) return;
      this.startTutorialStep2();
    };
    this.addTutorialListener(firstNode, 'mouseenter', onHover, { once: true });

    // 如果已在 hover 状态，视作完成
    this.tutorialTimeoutIds.push(
      window.setTimeout(() => {
        if (this.tutorialStep === 1 && firstNode.matches(':hover')) {
          this.startTutorialStep2();
        }
      }, 250)
    );
  }

  private startTutorialStep2(): void {
    const btn = this.bottomStarsButton;
    if (!btn) {
      this.endTutorial();
      return;
    }

    this.tutorialStep = 2;
    this.showTutorialBubble({
      step: 2,
      target: btn,
      placement: 'left',
      message: this.t('tutorial.step2')
    });

    const onClick = () => {
      if (this.tutorialStep !== 2) return;
      this.tutorialWaitingForFavoritesModal = true;
      this.tutorialStep = 3;
      // 等收藏弹窗打开后再显示下一步
      if (this.tutorialResizeHandler) {
        window.removeEventListener('resize', this.tutorialResizeHandler);
        this.tutorialResizeHandler = null;
      }
      if (this.tutorialBubble) {
        this.tutorialBubble.remove();
        this.tutorialBubble = null;
        this.tutorialBubbleArrow = null;
        this.tutorialBubbleTitle = null;
        this.tutorialBubbleText = null;
        this.tutorialBubblePrompt = null;
        this.tutorialBubbleActions = null;
      }
    };

    this.addTutorialListener(btn, 'click', onClick, { once: true, capture: true });
  }

  private maybeContinueTutorialAfterFavoritesModalOpened(): void {
    if (this.tutorialStep !== 3 || !this.tutorialWaitingForFavoritesModal) return;
    this.tutorialWaitingForFavoritesModal = false;

    const modal = this.favoritesModal;
    if (!modal) return;

    const header = modal.querySelector('.llm-tutorial-favorites-header') as HTMLElement | null;
    const content = modal.querySelector('.llm-tutorial-favorites-content') as HTMLElement | null;
    const target = header || content;
    if (!target) return;

    this.startTutorialStep3(target);
  }

  private startTutorialStep3(target: HTMLElement): void {
    this.tutorialStep = 3;
    this.showTutorialBubble({
      step: 3,
      target,
      placement: 'top',
      message: this.t('tutorial.step3')
    });

    // 给用户读一会儿，再提示归档入口
    this.tutorialTimeoutIds.push(
      window.setTimeout(() => {
        if (this.tutorialStep === 3) this.startTutorialStep4();
      }, 3000)
    );
  }

  private startTutorialStep4(): void {
    const modal = this.favoritesModal;
    if (!modal) {
      this.endTutorial();
      return;
    }

    const flipBtn = modal.querySelector('.llm-tutorial-flip-archive') as HTMLElement | null;
    if (!flipBtn) {
      this.endTutorial();
      return;
    }

    this.tutorialStep = 4;
    this.showTutorialBubble({
      step: 4,
      target: flipBtn,
      placement: 'bottom',
      message: this.t('tutorial.step4')
    });

    const onClick = () => {
      if (this.tutorialStep !== 4) return;
      // 等翻转动画结束再展示下一步
      this.tutorialTimeoutIds.push(
        window.setTimeout(() => {
          if (this.tutorialStep === 4) this.startTutorialStep5();
        }, 650)
      );
    };
    this.addTutorialListener(flipBtn, 'click', onClick, { once: true });
  }

  private startTutorialStep5(): void {
    const modal = this.favoritesModal;
    if (!modal) {
      this.endTutorial();
      return;
    }

    const settingsBtn =
      (modal.querySelector('.llm-favorites-settings-btn[data-tutorial-side="back"]') as HTMLElement | null) ||
      (modal.querySelector('.llm-favorites-settings-btn') as HTMLElement | null);
    if (!settingsBtn) {
      this.endTutorial();
      return;
    }

    this.tutorialStep = 5;
    this.showTutorialBubble({
      step: 5,
      target: settingsBtn,
      placement: 'top',
      message: this.t('tutorial.step5')
    });

    const onClick = () => {
      if (this.tutorialStep !== 5) return;
      this.endTutorial();
    };
    this.addTutorialListener(settingsBtn, 'click', onClick, { once: true, capture: true });
  }

  /**
   * 创建对话收藏项
   */
  private createConversationItem(conv: FavoriteConversation): HTMLElement {
    const theme = this.currentTheme;
    const item = document.createElement('div');
    item.className = 'favorite-conversation';

    // 根据主题计算背景色
    const itemBgColor = theme.name === '暗色'
      ? 'rgba(255,255,255,0.08)'
      : 'rgba(0,0,0,0.04)';
    const itemHoverBgColor = theme.name === '暗色'
      ? 'rgba(255,255,255,0.12)'
      : 'rgba(0,0,0,0.08)';

    Object.assign(item.style, {
      marginBottom: '12px',
      borderRadius: '8px',
      backgroundColor: itemBgColor,
      overflow: 'hidden',
      border: `1px solid ${theme.timelineBarColor}`
    });

    // 对话标题行（可展开）
    const titleRow = document.createElement('div');
    Object.assign(titleRow.style, {
      display: 'flex',
      alignItems: 'center',
      padding: '12px 14px',
      cursor: 'pointer',
      gap: '10px',
      transition: 'background-color 0.2s'
    });

    titleRow.addEventListener('mouseenter', () => {
      titleRow.style.backgroundColor = itemHoverBgColor;
    });
    titleRow.addEventListener('mouseleave', () => {
      titleRow.style.backgroundColor = 'transparent';
    });

    const expandIcon = document.createElement('span');
    expandIcon.textContent = '▶';
    Object.assign(expandIcon.style, {
      fontSize: '10px',
      transition: 'transform 0.2s',
      opacity: '0.6',
      color: theme.tooltipTextColor
    });

    const titleText = document.createElement('span');
    titleText.textContent = conv.title;
    titleText.title = this.t('favorites.clickToOpen');
    Object.assign(titleText.style, {
      flex: '1',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      fontSize: '14px',
      fontWeight: '500',
      color: theme.tooltipTextColor,
      cursor: 'pointer'
    });

    // 点击标题跳转到对话
    titleText.addEventListener('click', (e) => {
      e.stopPropagation();
      this.navigateToFavorite(conv, conv.items[0]?.nodeIndex || 0);
    });

    // 编辑按钮（简笔画铅笔图标）
    const editBtn = document.createElement('button');
    editBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
    editBtn.title = this.t('favorites.editTitle');
    Object.assign(editBtn.style, {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: '4px',
      opacity: '0.4',
      transition: 'opacity 0.2s',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: theme.tooltipTextColor
    });
    editBtn.addEventListener('mouseenter', () => {
      editBtn.style.opacity = '1';
    });
    editBtn.addEventListener('mouseleave', () => {
      editBtn.style.opacity = '0.4';
    });

    // 编辑标题的函数
    const startEditTitle = (e: Event) => {
      e.stopPropagation();

      // 创建输入框替换标题
      const input = document.createElement('input');
      input.type = 'text';
      input.value = conv.title;
      Object.assign(input.style, {
        flex: '1',
        fontSize: '14px',
        fontWeight: '500',
        color: theme.tooltipTextColor,
        backgroundColor: 'transparent',
        border: `1px solid ${theme.activeColor}`,
        borderRadius: '4px',
        padding: '2px 6px',
        outline: 'none',
        minWidth: '100px'
      });

      // 保存编辑
      const saveEdit = async () => {
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== conv.title) {
          await FavoriteStore.updateTitle(conv.conversationId, newTitle);
          conv.title = newTitle;
          titleText.textContent = newTitle;
        }
        // 恢复显示
        input.replaceWith(titleText);
      };

      // 取消编辑
      const cancelEdit = () => {
        input.replaceWith(titleText);
      };

      input.addEventListener('blur', saveEdit);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveEdit();
        } else if (e.key === 'Escape') {
          cancelEdit();
        }
      });

      titleText.replaceWith(input);
      input.focus();
      input.select();
    };

    // 点击编辑按钮编辑
    editBtn.addEventListener('click', startEditTitle);

    // 删除父项按钮（简笔画垃圾桶图标）
    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
    deleteBtn.title = this.t('favorites.delete');
    Object.assign(deleteBtn.style, {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: '4px',
      opacity: '0.4',
      transition: 'opacity 0.2s',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: theme.tooltipTextColor
    });
    deleteBtn.addEventListener('mouseenter', () => {
      deleteBtn.style.opacity = '1';
    });
    deleteBtn.addEventListener('mouseleave', () => {
      deleteBtn.style.opacity = '0.4';
    });
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const confirmed = await this.showConfirmDialog(this.t('favorites.confirmDelete'));
      if (confirmed) {
        await FavoriteStore.unfavoriteConversation(conv.conversationId);
        item.remove();
        // 如果删除的是当前对话，更新星星状态
        if (this.conversationId === conv.conversationId) {
          this.isFavorited = false;
          this.updateTopStarStyle();
        }
      }
    });

    // 网站图标
    const siteIcon = document.createElement('img');
    const iconUrl = this.getSiteIconUrl(conv.siteName);
    siteIcon.src = iconUrl;
    siteIcon.alt = conv.siteName;
    siteIcon.title = conv.siteName;
    Object.assign(siteIcon.style, {
      width: '20px',
      height: '20px',
      borderRadius: '4px',
      flexShrink: '0',
      objectFit: 'contain'
    });
    // 图标加载失败时显示文字
    siteIcon.onerror = () => {
      const textTag = document.createElement('span');
      textTag.textContent = conv.siteName;
      Object.assign(textTag.style, {
        fontSize: '11px',
        padding: '3px 8px',
        backgroundColor: theme.activeColor,
        color: '#fff',
        borderRadius: '4px',
        fontWeight: '500'
      });
      siteIcon.replaceWith(textTag);
    };

    titleRow.appendChild(expandIcon);
    titleRow.appendChild(titleText);
    titleRow.appendChild(editBtn);
    titleRow.appendChild(deleteBtn);
    titleRow.appendChild(siteIcon);

    // 子项容器（默认隐藏）
    const subItems = document.createElement('div');
    Object.assign(subItems.style, {
      display: 'none',
      padding: '0 14px 14px 32px'
    });

    conv.items.forEach(subItem => {
      const subItemEl = document.createElement('div');
      const subItemBgColor = theme.name === '暗色'
        ? 'rgba(255,255,255,0.05)'
        : 'rgba(0,0,0,0.03)';
      const subItemHoverBgColor = theme.name === '暗色'
        ? 'rgba(255,255,255,0.1)'
        : 'rgba(0,0,0,0.06)';

      Object.assign(subItemEl.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 14px',
        marginTop: '6px',
        backgroundColor: subItemBgColor,
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '13px',
        transition: 'all 0.2s',
        color: theme.tooltipTextColor,
        borderLeft: `3px solid ${theme.pinnedColor}`
      });

      // 文本内容
      const textSpan = document.createElement('span');
      Object.assign(textSpan.style, {
        flex: '1',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        cursor: 'pointer'
      });
      // 截取文本，确保一行显示
      const displayText = subItem.promptText.length > 50
        ? subItem.promptText.substring(0, 50) + '...'
        : subItem.promptText;
      textSpan.textContent = displayText;

      // 删除子项按钮（简笔画 X 图标）
      const subDeleteBtn = document.createElement('button');
      subDeleteBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
      subDeleteBtn.title = this.t('favorites.deleteSubItem');
      Object.assign(subDeleteBtn.style, {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '2px 4px',
        opacity: '0.4',
        transition: 'opacity 0.2s',
        color: theme.tooltipTextColor,
        flexShrink: '0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      });
      subDeleteBtn.addEventListener('mouseenter', () => {
        subDeleteBtn.style.opacity = '1';
      });
      subDeleteBtn.addEventListener('mouseleave', () => {
        subDeleteBtn.style.opacity = '0.4';
      });
      subDeleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const confirmed = await this.showConfirmDialog(this.t('favorites.confirmDelete'));
        if (confirmed) {
          await FavoriteStore.removeItem(conv.conversationId, subItem.nodeIndex);
          subItemEl.remove();
          // 删除所有子项后父项依然保留，用户可以点击父项跳转到对话
        }
      });

      subItemEl.appendChild(textSpan);
      subItemEl.appendChild(subDeleteBtn);

      subItemEl.addEventListener('mouseenter', () => {
        subItemEl.style.backgroundColor = subItemHoverBgColor;
        subItemEl.style.transform = 'translateX(4px)';
      });
      subItemEl.addEventListener('mouseleave', () => {
        subItemEl.style.backgroundColor = subItemBgColor;
        subItemEl.style.transform = 'translateX(0)';
      });

      // 点击文本部分跳转
      textSpan.addEventListener('click', (e) => {
        e.stopPropagation();
        this.navigateToFavorite(conv, subItem.nodeIndex);
      });

      subItems.appendChild(subItemEl);
    });

    // 展开/折叠逻辑 - 只有点击展开图标才触发
    let isExpanded = false;
    expandIcon.style.cursor = 'pointer';
    expandIcon.addEventListener('click', (e) => {
      e.stopPropagation();
      isExpanded = !isExpanded;
      subItems.style.display = isExpanded ? 'block' : 'none';
      expandIcon.style.transform = isExpanded ? 'rotate(90deg)' : 'rotate(0deg)';
    });

    item.appendChild(titleRow);
    item.appendChild(subItems);

    return item;
  }

  /**
   * 跳转到收藏的对话
   */
  private navigateToFavorite(conv: FavoriteConversation, nodeIndex: number): void {
    const currentUrl = window.location.href;
    const targetUrl = conv.url;

    // 如果是当前页面，直接跳转到节点
    if (currentUrl === targetUrl || this.conversationId === conv.conversationId) {
      this.closeFavoritesModal();

      // 触发点击回调跳转到指定节点
      if (this.onClickCallback) {
        this.onClickCallback(nodeIndex);
      }
    } else {
      // 跳转到其他页面
      // 在 URL 中添加节点索引参数，以便页面加载后跳转
      const url = new URL(targetUrl);
      url.searchParams.set('llm_nav_index', String(nodeIndex));
      window.open(url.toString(), '_blank');
      this.closeFavoritesModal();
    }
  }

  /**
   * 关闭收藏弹窗
   */
  private closeFavoritesModal(): void {
    if (this.tutorialStep >= 3) {
      this.endTutorial();
    }
    this.removeFavoritesModalElements();
  }

  private removeFavoritesModalElements(): void {
    if (this.favoritesModal) {
      this.favoritesModal.remove();
      this.favoritesModal = null;
    }

    // 移除遮罩层
    const overlay = document.querySelector('.llm-favorites-overlay');
    if (overlay) {
      overlay.remove();
    }

    // 移除导入弹窗（如果存在）
    document.querySelectorAll('.llm-favorites-import-overlay').forEach((el) => el.remove());
  }

  /**
   * 显示自定义确认对话框
   */
  private showConfirmDialog(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      const theme = this.currentTheme;

      // 创建遮罩层
      const overlay = document.createElement('div');
      Object.assign(overlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        backgroundColor: 'rgba(0,0,0,0.4)',
        zIndex: '2147483648',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      });

      // 创建对话框
      const dialog = document.createElement('div');
      Object.assign(dialog.style, {
        backgroundColor: theme.tooltipBackgroundColor,
        color: theme.tooltipTextColor,
        borderRadius: '10px',
        padding: '20px 24px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        maxWidth: '320px',
        textAlign: 'center'
      });

      // 消息文本
      const msgEl = document.createElement('p');
      msgEl.textContent = message;
      Object.assign(msgEl.style, {
        margin: '0 0 20px 0',
        fontSize: '14px',
        lineHeight: '1.5'
      });

      // 按钮容器
      const btnContainer = document.createElement('div');
      Object.assign(btnContainer.style, {
        display: 'flex',
        gap: '12px',
        justifyContent: 'center'
      });

      // 取消按钮
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = this.t('favorites.cancel');
      Object.assign(cancelBtn.style, {
        padding: '8px 20px',
        border: `1px solid ${theme.timelineBarColor}`,
        borderRadius: '6px',
        backgroundColor: 'transparent',
        color: theme.tooltipTextColor,
        cursor: 'pointer',
        fontSize: '13px',
        transition: 'all 0.2s'
      });
      cancelBtn.addEventListener('mouseenter', () => {
        cancelBtn.style.backgroundColor = theme.name === '暗色'
          ? 'rgba(255,255,255,0.1)'
          : 'rgba(0,0,0,0.05)';
      });
      cancelBtn.addEventListener('mouseleave', () => {
        cancelBtn.style.backgroundColor = 'transparent';
      });

      // 确认按钮
      const confirmBtn = document.createElement('button');
      confirmBtn.textContent = this.t('favorites.confirm');
      Object.assign(confirmBtn.style, {
        padding: '8px 20px',
        border: 'none',
        borderRadius: '6px',
        backgroundColor: '#e53935',
        color: '#fff',
        cursor: 'pointer',
        fontSize: '13px',
        transition: 'all 0.2s'
      });
      confirmBtn.addEventListener('mouseenter', () => {
        confirmBtn.style.backgroundColor = '#c62828';
      });
      confirmBtn.addEventListener('mouseleave', () => {
        confirmBtn.style.backgroundColor = '#e53935';
      });

      // 关闭对话框
      const closeDialog = (result: boolean) => {
        overlay.remove();
        resolve(result);
      };

      cancelBtn.addEventListener('click', () => closeDialog(false));
      confirmBtn.addEventListener('click', () => closeDialog(true));
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeDialog(false);
      });

      btnContainer.appendChild(cancelBtn);
      btnContainer.appendChild(confirmBtn);
      dialog.appendChild(msgEl);
      dialog.appendChild(btnContainer);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      // 聚焦确认按钮
      confirmBtn.focus();
    });
  }

  private showInputDialog(
    title: string,
    defaultValue: string,
    placeholder: string
  ): Promise<string | null> {
    return new Promise((resolve) => {
      const theme = this.currentTheme;

      const overlay = document.createElement('div');
      Object.assign(overlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        backgroundColor: 'rgba(0,0,0,0.4)',
        zIndex: '2147483649',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      });

      const dialog = document.createElement('div');
      Object.assign(dialog.style, {
        backgroundColor: theme.tooltipBackgroundColor,
        color: theme.tooltipTextColor,
        borderRadius: '12px',
        padding: '18px 20px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
        width: '360px',
        maxWidth: '86vw'
      });

      const titleEl = document.createElement('div');
      titleEl.textContent = title;
      Object.assign(titleEl.style, { fontSize: '14px', fontWeight: '600', marginBottom: '12px' });

      const input = document.createElement('input');
      input.type = 'text';
      input.value = defaultValue || '';
      input.placeholder = placeholder || '';
      Object.assign(input.style, {
        width: '100%',
        boxSizing: 'border-box',
        padding: '10px 12px',
        borderRadius: '8px',
        border: `1px solid ${theme.timelineBarColor}`,
        backgroundColor: theme.name === '暗色' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        color: theme.tooltipTextColor,
        outline: 'none',
        fontSize: '13px'
      });
      input.addEventListener('focus', () => {
        input.style.borderColor = theme.pinnedColor;
      });
      input.addEventListener('blur', () => {
        input.style.borderColor = theme.timelineBarColor;
      });

      const btnContainer = document.createElement('div');
      Object.assign(btnContainer.style, {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '10px',
        marginTop: '14px'
      });

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.textContent = this.t('favorites.cancel');
      Object.assign(cancelBtn.style, {
        padding: '8px 16px',
        border: `1px solid ${theme.timelineBarColor}`,
        borderRadius: '8px',
        backgroundColor: 'transparent',
        color: theme.tooltipTextColor,
        cursor: 'pointer',
        fontSize: '13px',
        transition: 'all 0.2s'
      });
      cancelBtn.addEventListener('mouseenter', () => {
        cancelBtn.style.backgroundColor =
          theme.name === '暗色' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
      });
      cancelBtn.addEventListener('mouseleave', () => {
        cancelBtn.style.backgroundColor = 'transparent';
      });

      const confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.textContent = this.t('favorites.confirm');
      Object.assign(confirmBtn.style, {
        padding: '8px 16px',
        border: 'none',
        borderRadius: '8px',
        backgroundColor: theme.activeColor,
        color: '#fff',
        cursor: 'pointer',
        fontSize: '13px',
        transition: 'all 0.2s'
      });
      confirmBtn.addEventListener('mouseenter', () => {
        confirmBtn.style.filter = 'brightness(0.95)';
      });
      confirmBtn.addEventListener('mouseleave', () => {
        confirmBtn.style.filter = 'none';
      });

      const close = (value: string | null) => {
        overlay.remove();
        resolve(value);
      };

      const submit = () => {
        const value = input.value.trim();
        if (!value) {
          input.style.borderColor = '#e53935';
          input.focus();
          return;
        }
        close(value);
      };

      cancelBtn.addEventListener('click', () => close(null));
      confirmBtn.addEventListener('click', submit);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close(null);
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit();
        if (e.key === 'Escape') close(null);
      });

      btnContainer.appendChild(cancelBtn);
      btnContainer.appendChild(confirmBtn);
      dialog.appendChild(titleEl);
      dialog.appendChild(input);
      dialog.appendChild(btnContainer);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      input.focus();
      input.select();
    });
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
   * 获取网站对应的图标 URL
   */
  private getSiteIconUrl(siteName: string): string {
    const iconMap: Record<string, string> = {
      'ChatGPT': 'icons/chatgpt.ico',
      'Claude': 'icons/claude-ai-icon.webp',
      'Gemini': 'icons/google-gemini-icon.webp',
      'DeepSeek': 'icons/deepseek.ico',
      'Grok': 'icons/grok.svg',
      'Kimi': 'icons/kimi-icon.png',
      'Qwen': 'icons/qwen.png',
      '豆包': 'icons/豆包icon.png'
    };

    const iconPath = iconMap[siteName] || 'icons/icon48.svg';
    return chrome.runtime.getURL(iconPath);
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
