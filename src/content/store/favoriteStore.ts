/**
 * 收藏数据存储
 * 用于保存和管理用户收藏的对话
 */

export interface FavoriteItem {
  /** 对话内的节点索引 */
  nodeIndex: number;
  /** 节点的预览文本 */
  promptText: string;
  /** 收藏时间 */
  timestamp: number;
}

export interface FavoriteConversation {
  /** 对话 ID */
  conversationId: string;
  /** 对话 URL */
  url: string;
  /** 对话标题（可选，取第一个收藏项的文本） */
  title: string;
  /** 收藏的节点列表 */
  items: FavoriteItem[];
  /** 最后更新时间 */
  updatedAt: number;
  /** 站点名称 */
  siteName: string;
}

const STORAGE_KEY = 'llm-nav-favorites';

export const FavoriteStore = {
  /**
   * 加载所有收藏
   */
  async loadAll(): Promise<FavoriteConversation[]> {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(STORAGE_KEY, (result) => {
          if (chrome.runtime.lastError) {
            resolve([]);
            return;
          }
          resolve(result[STORAGE_KEY] || []);
        });
      } catch (e) {
        resolve([]);
      }
    });
  },

  /**
   * 保存所有收藏
   */
  async saveAll(favorites: FavoriteConversation[]): Promise<void> {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [STORAGE_KEY]: favorites }, () => {
          resolve();
        });
      } catch (e) {
        resolve();
      }
    });
  },

  /**
   * 获取指定对话的收藏
   */
  async getConversation(conversationId: string): Promise<FavoriteConversation | null> {
    const all = await this.loadAll();
    return all.find(c => c.conversationId === conversationId) || null;
  },

  /**
   * 收藏当前对话
   * @param conversationId 对话 ID
   * @param url 当前页面 URL
   * @param siteName 站点名称
   * @param chatTitle 整个对话的标题（第一个问题的缩略）
   * @param pinnedItems 被标记的节点信息数组 [{index, promptText}]
   * @returns 是否成功收藏（如果已存在则更新）
   */
  async favoriteConversation(
    conversationId: string,
    url: string,
    siteName: string,
    chatTitle: string,
    pinnedItems: Array<{ index: number; promptText: string }>
  ): Promise<boolean> {
    const all = await this.loadAll();
    const now = Date.now();
    
    // 查找是否已存在
    const existingIndex = all.findIndex(c => c.conversationId === conversationId);
    
    const items: FavoriteItem[] = pinnedItems.map(item => ({
      nodeIndex: item.index,
      promptText: item.promptText,
      timestamp: now
    }));
    
    // 使用传入的 chatTitle，截取前40字符
    const title = chatTitle.length > 40 
      ? chatTitle.substring(0, 40) + '...' 
      : chatTitle;
    
    const conversation: FavoriteConversation = {
      conversationId,
      url,
      title: title || '未命名对话',
      items,
      updatedAt: now,
      siteName
    };
    
    if (existingIndex >= 0) {
      // 更新现有收藏
      all[existingIndex] = conversation;
    } else {
      // 添加新收藏
      all.push(conversation);
    }
    
    await this.saveAll(all);
    return true;
  },

  /**
   * 更新收藏的子项（同步标记节点）
   */
  async updateFavoriteItems(
    conversationId: string,
    pinnedItems: Array<{ index: number; promptText: string }>
  ): Promise<boolean> {
    const all = await this.loadAll();
    const conversation = all.find(c => c.conversationId === conversationId);
    
    if (!conversation) return false;
    
    const now = Date.now();
    conversation.items = pinnedItems.map(item => ({
      nodeIndex: item.index,
      promptText: item.promptText,
      timestamp: now
    }));
    conversation.updatedAt = now;
    
    await this.saveAll(all);
    return true;
  },

  /**
   * 取消收藏对话
   */
  async unfavoriteConversation(conversationId: string): Promise<boolean> {
    const all = await this.loadAll();
    const newAll = all.filter(c => c.conversationId !== conversationId);
    
    if (newAll.length !== all.length) {
      await this.saveAll(newAll);
      return true;
    }
    return false;
  },

  /**
   * 检查对话是否已收藏
   */
  async isFavorited(conversationId: string): Promise<boolean> {
    const conversation = await this.getConversation(conversationId);
    return conversation !== null;
  },

  /**
   * 更新收藏的标题
   */
  async updateTitle(conversationId: string, newTitle: string): Promise<boolean> {
    const all = await this.loadAll();
    const conversation = all.find(c => c.conversationId === conversationId);
    
    if (!conversation) return false;
    
    conversation.title = newTitle;
    conversation.updatedAt = Date.now();
    
    await this.saveAll(all);
    return true;
  },

  /**
   * 删除收藏中的单个节点
   * 删除所有子项后父项依然保留，用户可以点击父项跳转到对话
   */
  async removeItem(conversationId: string, nodeIndex: number): Promise<boolean> {
    const all = await this.loadAll();
    const conversation = all.find(c => c.conversationId === conversationId);
    
    if (!conversation) return false;
    
    conversation.items = conversation.items.filter(item => item.nodeIndex !== nodeIndex);
    conversation.updatedAt = Date.now();
    
    await this.saveAll(all);
    return true;
  }
};

