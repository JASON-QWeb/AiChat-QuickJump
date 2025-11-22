import type { SiteAdapter } from '../siteAdapters/index';

/**
 * 回答节点信息
 */
interface AnswerInfo {
  domNode: HTMLElement;
  topOffset: number;
}

/**
 * 回答索引管理器
 * 负责管理所有 AI 回答节点的索引和当前位置
 */
export class AnswerIndexManager {
  private answers: AnswerInfo[] = [];
  private currentIndex: number = 0;
  private adapter: SiteAdapter;
  private root: Document | HTMLElement;

  constructor(adapter: SiteAdapter, root: Document | HTMLElement) {
    this.adapter = adapter;
    this.root = root;
    this.refresh();
  }

  /**
   * 刷新回答列表
   * 重新查找所有回答节点并更新索引
   */
  refresh(): void {
    const nodes = this.adapter.findAllAnswers(this.root);
    
    this.answers = nodes.map(node => ({
      domNode: node,
      topOffset: this.getTopOffset(node)
    }));

    // 按 topOffset 排序
    this.answers.sort((a, b) => a.topOffset - b.topOffset);
  }

  /**
   * 计算元素相对于文档顶部的偏移量
   */
  private getTopOffset(element: HTMLElement): number {
    const rect = element.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    return rect.top + scrollTop;
  }

  /**
   * 获取回答总数
   */
  getTotalCount(): number {
    return this.answers.length;
  }

  /**
   * 获取当前索引（从 0 开始）
   */
  getCurrentIndex(): number {
    return this.currentIndex;
  }

  /**
   * 设置当前索引
   * @param index - 新的索引值（从 0 开始）
   */
  setCurrentIndex(index: number): void {
    if (this.answers.length === 0) {
      this.currentIndex = 0;
      return;
    }

    // 防止越界
    if (index < 0) {
      this.currentIndex = 0;
    } else if (index >= this.answers.length) {
      this.currentIndex = this.answers.length - 1;
    } else {
      this.currentIndex = index;
    }
  }

  /**
   * 获取指定索引的节点
   * @param index - 索引值（从 0 开始）
   * @returns 对应的节点，如果索引无效则返回 null
   */
  getNodeByIndex(index: number): HTMLElement | null {
    if (index < 0 || index >= this.answers.length) {
      return null;
    }
    return this.answers[index].domNode;
  }

  /**
   * 获取当前节点
   */
  getCurrentNode(): HTMLElement | null {
    return this.getNodeByIndex(this.currentIndex);
  }

  /**
   * 跳转到上一个回答
   * @returns 是否成功跳转（如果已经是第一个则返回 false）
   */
  moveToPrev(): boolean {
    if (this.currentIndex > 0) {
      this.setCurrentIndex(this.currentIndex - 1);
      return true;
    }
    return false;
  }

  /**
   * 跳转到下一个回答
   * @returns 是否成功跳转（如果已经是最后一个则返回 false）
   */
  moveToNext(): boolean {
    if (this.currentIndex < this.answers.length - 1) {
      this.setCurrentIndex(this.currentIndex + 1);
      return true;
    }
    return false;
  }

  /**
   * 根据当前滚动位置更新当前索引
   * @param scrollY - 当前滚动位置（window.scrollY）
   */
  updateCurrentIndexByScroll(scrollY: number): void {
    if (this.answers.length === 0) {
      return;
    }

    // 检查是否接近页面底部
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const scrollBottom = scrollY + windowHeight;
    const isNearBottom = documentHeight - scrollBottom < 200; // 距离底部小于 200px

    // 如果在底部，直接设置为最后一个
    if (isNearBottom) {
      this.currentIndex = this.answers.length - 1;
      return;
    }

    // 否则，找到最接近当前滚动位置的回答
    const viewportCenter = scrollY + windowHeight / 2;
    let closestIndex = 0;
    let minDistance = Math.abs(this.answers[0].topOffset - viewportCenter);

    for (let i = 1; i < this.answers.length; i++) {
      const distance = Math.abs(this.answers[i].topOffset - viewportCenter);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      } else if (this.answers[i].topOffset > viewportCenter) {
        // 如果当前回答已经在视口中心之后，停止搜索
        break;
      }
    }

    this.currentIndex = closestIndex;
  }

  /**
   * 检查是否需要刷新回答列表
   * 如果页面上的回答数量发生变化，返回 true
   */
  needsRefresh(): boolean {
    const currentNodes = this.adapter.findAllAnswers(this.root);
    return currentNodes.length !== this.answers.length;
  }
}

