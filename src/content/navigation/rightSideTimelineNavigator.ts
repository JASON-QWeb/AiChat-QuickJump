import type { PromptAnswerItem } from './answerIndexManager';
import { PinnedStore } from '../store/pinnedStore';
import { themes, resolveTheme, type ThemeMode, type TimelineTheme } from './themes';

/**
 * 右侧时间线导航器
 * 在页面右侧显示纵向时间线，每个节点代表一个对话
 */
export class RightSideTimelineNavigator {
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

  private readonly handleNodesScroll = () => {
    if (this.sliderDragging) {
      return;
    }
    this.syncSliderToScroll();
  };

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

    this.createSlider();
    this.nodesWrapper.addEventListener('scroll', this.handleNodesScroll, { passive: true });
    
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
  }

  /**
   * 设置当前对话 ID 并加载标记状态
   */
  async setConversationId(id: string) {
    this.conversationId = id;
    this.pinnedNodes = await PinnedStore.loadPinned(id);
    // 重新应用样式
    this.nodes.forEach((node, index) => {
      this.updateNodeStyle(node, index);
    });
  }

  /**
   * 创建主容器
   */
  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.id = 'llm-timeline-navigator';
    
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
      transition: 'background-color 0.3s ease',
      zIndex: '1'
    });

    return bar;
  }

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
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
      pointerEvents: 'auto',
      zIndex: '2'
    });
    wrapper.addEventListener('wheel', (event) => {
      // 阻止冒泡，避免影响页面主体滚动
      event.stopPropagation();
    });
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
    // 截断文本（最多 80 字符）
    const displayText = text.length > 80 ? text.substring(0, 80) + '...' : text;
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
          
          // 震动反馈 (如果支持)
          if (navigator.vibrate) navigator.vibrate(50);
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
        this.nodesContent.style.height = '100%';
        this.nodesWrapper.scrollTop = 0;
        this.contentHeight = 0;
        this.sliderVisible = false;
        if (this.slider) {
          this.slider.style.display = 'none';
        }
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

      const wrapperHeight = this.nodesWrapper.clientHeight;
      if (wrapperHeight === 0) return;

      const padding = this.NODE_PADDING;
      const desiredHeight = padding * 2 + Math.max(0, (count - 1)) * this.MIN_NODE_GAP;
      this.contentHeight = Math.max(wrapperHeight, desiredHeight);
      this.nodesContent.style.height = `${this.contentHeight}px`;

      const usableHeight = this.contentHeight - padding * 2;

      this.items.forEach((item, index) => {
        const node = this.nodes[index];
        if (!node) return;

        let ratio: number;
        if (typeof item.relativePosition === 'number' && !isNaN(item.relativePosition)) {
          ratio = Math.max(0, Math.min(1, item.relativePosition));
        } else if (count === 1) {
          ratio = 0;
        } else {
          ratio = index / (count - 1);
        }

        const topPosition = padding + ratio * usableHeight;
        node.style.top = `${topPosition}px`;
        node.dataset.timelineTop = String(topPosition);
      });

      this.updateSliderVisibility();
      this.syncSliderToScroll();
      this.ensureActiveNodeVisible();
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
    const wrapperHeight = this.nodesWrapper.clientHeight || 0;
    if (wrapperHeight === 0) return;
    const activeNode = this.nodes[this.activeIndex];
    if (!activeNode) return;

    const top = parseFloat(activeNode.dataset.timelineTop || activeNode.style.top || '0');
    const bottom = top + activeNode.offsetHeight;
    const visibleTop = this.nodesWrapper.scrollTop;
    const visibleBottom = visibleTop + wrapperHeight;
    const padding = 40;

    let targetScroll = visibleTop;
    if (top < visibleTop + padding) {
      targetScroll = Math.max(0, top - padding);
    } else if (bottom > visibleBottom - padding) {
      targetScroll = Math.min(this.contentHeight - wrapperHeight, bottom - wrapperHeight + padding);
    }

    if (isFinite(targetScroll) && targetScroll !== visibleTop) {
      this.nodesWrapper.scrollTop = targetScroll;
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
    
    // 震动反馈
    if (navigator.vibrate) navigator.vibrate(50);
  }

  /**
   * 销毁时间线
   */
  destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    this.nodesWrapper.removeEventListener('scroll', this.handleNodesScroll);
    this.detachSliderEvents();
    this.container.remove();
    this.tooltip.remove();
    this.slider?.remove();
  }

  /**
   * 构建可拖动的滚动条（置于节点列左侧）
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

    slider.appendChild(handle);
    this.container.appendChild(slider);

    handle.addEventListener('pointerdown', (event) => this.startSliderDrag(event));

    this.slider = slider;
    this.sliderHandle = handle;
  }

  private updateSliderVisibility(): void {
    if (!this.slider || !this.sliderHandle) return;

    const wrapperHeight = this.nodesWrapper.clientHeight || 0;
    if (wrapperHeight === 0 || this.contentHeight <= wrapperHeight + 1) {
      this.slider.style.display = 'none';
      this.sliderVisible = false;
      this.sliderHandle.style.top = '0px';
      return;
    }

    this.sliderVisible = true;
    const sliderHeight = Math.max(100, Math.min(wrapperHeight, 240));
    this.slider.style.display = 'flex';
    this.slider.style.height = `${sliderHeight}px`;
    this.slider.style.top = `calc(50% - ${sliderHeight / 2}px)`;

    const ratio = wrapperHeight / this.contentHeight;
    const handleHeight = Math.max(24, Math.min(sliderHeight - 12, sliderHeight * ratio));
    this.sliderHandle.style.height = `${handleHeight}px`;
    this.sliderDragMaxTop = Math.max(1, sliderHeight - handleHeight);
  }

  private syncSliderToScroll(): void {
    if (!this.slider || !this.sliderHandle || !this.sliderVisible) return;

    const wrapperHeight = this.nodesWrapper.clientHeight || 0;
    const maxScroll = Math.max(1, this.contentHeight - wrapperHeight);
    const ratio = maxScroll > 0 ? this.nodesWrapper.scrollTop / maxScroll : 0;
    const sliderHeight = this.slider.clientHeight || 1;
    const handleHeight = this.sliderHandle.clientHeight || 1;
    const maxTop = Math.max(1, sliderHeight - handleHeight);
    this.sliderHandle.style.top = `${ratio * maxTop}px`;
  }

  private startSliderDrag(event: PointerEvent): void {
    if (!this.sliderHandle || !this.slider || !this.sliderVisible) return;
    event.preventDefault();

    this.sliderDragging = true;
    this.sliderPointerId = event.pointerId;
    this.sliderHandle.setPointerCapture(event.pointerId);
    this.sliderHandle.style.cursor = 'grabbing';
    this.sliderDragStartY = event.clientY;
    this.sliderDragStartHandleTop = this.sliderHandle.offsetTop || 0;

    const sliderHeight = this.slider.clientHeight || 1;
    const handleHeight = this.sliderHandle.clientHeight || 1;
    this.sliderDragMaxTop = Math.max(1, sliderHeight - handleHeight);

    this.sliderPointerMoveHandler = (e) => this.handleSliderDrag(e);
    this.sliderPointerUpHandler = (e) => this.endSliderDrag(e);
    window.addEventListener('pointermove', this.sliderPointerMoveHandler, { passive: false });
    window.addEventListener('pointerup', this.sliderPointerUpHandler);
  }

  private handleSliderDrag(event: PointerEvent): void {
    if (!this.sliderDragging || !this.sliderHandle || !this.sliderVisible) return;

    const deltaY = event.clientY - this.sliderDragStartY;
    let nextTop = this.sliderDragStartHandleTop + deltaY;
    nextTop = Math.max(0, Math.min(nextTop, this.sliderDragMaxTop));
    this.sliderHandle.style.top = `${nextTop}px`;

    const wrapperHeight = this.nodesWrapper.clientHeight || 0;
    const maxScroll = Math.max(1, this.contentHeight - wrapperHeight);
    const ratio = this.sliderDragMaxTop > 0 ? nextTop / this.sliderDragMaxTop : 0;
    this.nodesWrapper.scrollTop = ratio * maxScroll;
    event.preventDefault();
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
    this.sliderHandle?.style.setProperty('cursor', 'grab');
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
