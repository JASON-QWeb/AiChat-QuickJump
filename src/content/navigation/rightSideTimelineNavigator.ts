import type { PromptAnswerItem } from './answerIndexManager';
import { PinnedStore } from '../store/pinnedStore';
import { FavoriteStore, type FavoriteConversation } from '../store/favoriteStore';
import { themes, resolveTheme, type ThemeMode, type TimelineTheme } from './themes';

/**
 * 右侧时间线导航器
 * 在页面右侧显示纵向时间线，每个节点代表一个对话
 */
export class RightSideTimelinejump {
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
  private isFavorited: boolean = false;
  private siteName: string = '';
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
  
  // 防止 ResizeObserver 无限循环的标志
  private isUpdatingPositions: boolean = false;

  constructor() {
    // 确保主题已初始化
    const savedTheme = localStorage.getItem('llm_nav_theme_cache');
    if (savedTheme && themes[savedTheme]) {
       this.currentTheme = themes[savedTheme];
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
    // 缓存主题，防止构造函数加载时闪烁
    localStorage.setItem('llm_nav_theme_cache', themeType);
    
    // 更新时间线主干颜色
    this.timelineBar.style.backgroundColor = this.currentTheme.timelineBarColor;

    if (this.slider) {
      this.slider.style.borderColor = this.currentTheme.timelineBarColor;
    }
    if (this.sliderHandle) {
      this.sliderHandle.style.backgroundColor = this.currentTheme.activeColor;
      this.sliderHandle.style.boxShadow = `0 0 8px ${this.currentTheme.activeShadow}`;
    }

    // 更新 Tooltip 样式
    this.tooltip.style.backgroundColor = this.currentTheme.tooltipBackgroundColor;
    this.tooltip.style.color = this.currentTheme.tooltipTextColor;

    // 刷新所有节点样式
    this.nodes.forEach((node, index) => {
      this.updateNodeStyle(node, index);
    });
    
    // 更新星星按钮样式
    this.updateTopStarStyle();
    if (this.bottomStarsButton) {
      this.bottomStarsButton.style.color = this.currentTheme.defaultNodeColor;
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
        const chatTitle = this.items.length > 0 ? this.items[0].promptText : '未命名对话';
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
    button.title = '收藏当前对话';
    
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
      opacity: '0.5',
      transition: 'all 0.2s ease',
      zIndex: '10'
    });
    
    // 三星重叠效果
    button.innerHTML = `
      <span style="position: relative;">
        <span style="position: absolute; left: -6px; top: 0; opacity: 0.6;">★</span>
        <span style="position: relative; z-index: 1;">★</span>
        <span style="position: absolute; left: 6px; top: 0; opacity: 0.6;">★</span>
      </span>
    `;
    button.title = '查看所有收藏';
    
    button.addEventListener('mouseenter', () => {
      button.style.opacity = '1';
      button.style.transform = 'translateX(-50%) scale(1.2)';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.opacity = '0.5';
      button.style.transform = 'translateX(-50%) scale(1)';
    });
    
    button.addEventListener('click', () => this.showFavoritesModal());
    
    this.container.appendChild(button);
    this.bottomStarsButton = button;
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
      const chatTitle = this.items.length > 0 ? this.items[0].promptText : '未命名对话';
      
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
  }

  /**
   * 同步标记节点到收藏（当标记状态变化时调用）
   */
  async syncPinnedToFavorites(): Promise<void> {
    if (!this.conversationId || !this.isFavorited) return;
    
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
    
    // 如果没有标记的节点了，保留第一个节点作为代表
    if (pinnedItems.length === 0 && this.items.length > 0) {
      pinnedItems.push({
        index: 0,
        promptText: this.items[0].promptText
      });
    }
    
    await FavoriteStore.updateFavoriteItems(this.conversationId, pinnedItems);
  }

  /**
   * 更新顶部星星样式
   */
  private updateTopStarStyle(): void {
    if (!this.topStarButton) return;
    
    if (this.isFavorited) {
      this.topStarButton.innerHTML = '★'; // 实心星星
      this.topStarButton.style.color = this.currentTheme.pinnedColor;
      this.topStarButton.style.opacity = '1';
      this.topStarButton.title = '取消收藏';
    } else {
      this.topStarButton.innerHTML = '☆'; // 空心星星
      this.topStarButton.style.color = this.currentTheme.defaultNodeColor;
      this.topStarButton.style.opacity = '0.5';
      this.topStarButton.title = '收藏当前对话';
    }
  }

  /**
   * 显示收藏列表弹窗
   */
  private async showFavoritesModal(): Promise<void> {
    // 如果弹窗已存在，先移除
    if (this.favoritesModal) {
      this.favoritesModal.remove();
      this.favoritesModal = null;
    }
    
    const favorites = await FavoriteStore.loadAll();
    
    // 创建弹窗
    const modal = document.createElement('div');
    modal.className = 'llm-favorites-modal';
    
    Object.assign(modal.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '800px',
      maxWidth: '90vw',
      maxHeight: '70vh',
      minHeight: '400px',
      backgroundColor: this.currentTheme.tooltipBackgroundColor,
      color: this.currentTheme.tooltipTextColor,
      borderRadius: '12px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      zIndex: '2147483647',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    });
    
    // 标题栏
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '16px 20px',
      borderBottom: '1px solid rgba(128,128,128,0.2)'
    });
    
    const title = document.createElement('h3');
    title.textContent = '收藏列表';
    Object.assign(title.style, {
      margin: '0',
      fontSize: '16px',
      fontWeight: '600'
    });
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    Object.assign(closeBtn.style, {
      background: 'none',
      border: 'none',
      fontSize: '18px',
      cursor: 'pointer',
      color: this.currentTheme.tooltipTextColor,
      opacity: '0.6',
      padding: '4px 8px'
    });
    closeBtn.addEventListener('mouseenter', () => closeBtn.style.opacity = '1');
    closeBtn.addEventListener('mouseleave', () => closeBtn.style.opacity = '0.6');
    closeBtn.addEventListener('click', () => this.closeFavoritesModal());
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    modal.appendChild(header);
    
    // 内容区域
    const content = document.createElement('div');
    Object.assign(content.style, {
      flex: '1',
      overflowY: 'auto',
      padding: '12px 20px'
    });
    
    if (favorites.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.textContent = '暂无收藏';
      Object.assign(emptyMsg.style, {
        textAlign: 'center',
        color: 'rgba(128,128,128,0.8)',
        padding: '40px 0'
      });
      content.appendChild(emptyMsg);
    } else {
      favorites.forEach(conv => {
        const convItem = this.createConversationItem(conv);
        content.appendChild(convItem);
      });
    }
    
    modal.appendChild(content);
    
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
    titleText.title = '点击进入对话';
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
    editBtn.title = '编辑标题';
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
    deleteBtn.title = '删除此收藏';
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
      const confirmed = await this.showConfirmDialog('确定要删除这个收藏吗？');
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
    
    const siteTag = document.createElement('span');
    siteTag.textContent = conv.siteName;
    Object.assign(siteTag.style, {
      fontSize: '11px',
      padding: '3px 8px',
      backgroundColor: theme.activeColor,
      color: '#fff',
      borderRadius: '4px',
      fontWeight: '500'
    });
    
    titleRow.appendChild(expandIcon);
    titleRow.appendChild(titleText);
    titleRow.appendChild(editBtn);
    titleRow.appendChild(deleteBtn);
    titleRow.appendChild(siteTag);
    
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
      subDeleteBtn.title = '删除此子项';
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
        const confirmed = await this.showConfirmDialog('确定要删除这个子项吗？');
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
    if (this.favoritesModal) {
      this.favoritesModal.remove();
      this.favoritesModal = null;
    }
    
    // 移除遮罩层
    const overlay = document.querySelector('.llm-favorites-overlay');
    if (overlay) {
      overlay.remove();
    }
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
      cancelBtn.textContent = '取消';
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
      confirmBtn.textContent = '确定';
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
    tooltip.style.display = 'none';
    
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
      // 限制显示两行
      display: '-webkit-box',
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

    // 截断文本（最多 80 字符）
    let displayText = text.length > 80 ? text.substring(0, 80) + '...' : text;

    // 如果被标记，添加星号
    if (isPinned) {
      displayText = '🌟 ' + displayText;
    }

    this.tooltip.textContent = displayText;
    this.tooltip.style.display = 'block';

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
    this.tooltip.style.display = 'none';
  }

  /**
   * 更新单个节点的样式（包含 Active 和 Pinned 状态）
   */
  private updateNodeStyle(node: HTMLElement, index: number) {
    const isActive = index === this.activeIndex;
    const isPinned = this.pinnedNodes.has(String(index));
    
    // 基础样式
    node.style.transition = 'all 0.2s ease';
    
    if (isActive) {
      // 激活状态
      node.style.transform = 'translate(-50%, -50%) scale(1.4)';
      node.style.zIndex = '10';
      node.style.boxShadow = `0 0 10px ${this.currentTheme.activeShadow}`;
      node.style.border = '3px solid #fff'; // 白色边框
      
      // 如果也被标记了，内部用重点色，否则用当前主题 Active 色
      if (isPinned) {
        node.style.backgroundColor = this.currentTheme.pinnedColor; // 使用主题重点色
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
        // 标记状态
        node.style.backgroundColor = this.currentTheme.pinnedColor; // 使用主题重点色
        // 标记的节点比普通节点稍大
        node.style.transform = 'translate(-50%, -50%) scale(1.2)';
      } else {
        // 普通状态 (未选中)
        node.style.backgroundColor = this.currentTheme.defaultNodeColor; // 使用主题默认色
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
            try { navigator.vibrate(50); } catch (e) {}
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
      try { navigator.vibrate(50); } catch (e) {}
    }
  }

  /**
   * 销毁时间线
   */
  destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.nodesWrapper) {
      this.nodesWrapper.removeEventListener('scroll', this.handleWrapperScroll);
    }
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
