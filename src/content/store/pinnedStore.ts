/**
 * Pinned State Storage
 * Persists pinned nodes for each conversation
 */
export const PinnedStore = {
  /**
   * Storage Key Prefix
   */
  KEY_PREFIX: 'llm-nav-pinned:',

  /**
   * Load pinned nodes for a specific conversation
   * @param conversationId 
   * @returns Promise<Set<string>> Set of pinned node IDs
   */
  async loadPinned(conversationId: string): Promise<Set<string>> {
    if (!conversationId) return new Set();
    
    const key = this.KEY_PREFIX + conversationId;
    
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(key, (result) => {
          if (chrome.runtime.lastError) {
            console.error('Failed to load pinned state:', chrome.runtime.lastError);
            resolve(new Set());
            return;
          }
          
          const pinnedList = result[key] || [];
          resolve(new Set(pinnedList));
        });
      } catch (e) {
        console.error('Error loading pinned state:', e);
        resolve(new Set());
      }
    });
  },

  /**
   * Toggle pinned state for a node
   * @param conversationId 
   * @param nodeId 
   * @returns Promise<boolean> New pinned state (true=pinned, false=unpinned)
   */
  async togglePinned(conversationId: string, nodeId: string): Promise<boolean> {
    if (!conversationId || !nodeId) return false;

    const currentPinned = await this.loadPinned(conversationId);
    let isPinned = false;

    if (currentPinned.has(nodeId)) {
      currentPinned.delete(nodeId);
      isPinned = false;
    } else {
      currentPinned.add(nodeId);
      isPinned = true;
    }

    await this.savePinned(conversationId, currentPinned);
    return isPinned;
  },

  /**
   * Save pinned nodes
   */
  async savePinned(conversationId: string, pinnedSet: Set<string>): Promise<void> {
    const key = this.KEY_PREFIX + conversationId;
    const pinnedList = Array.from(pinnedSet);
    
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [key]: pinnedList }, () => {
          if (chrome.runtime.lastError) {
            console.error('Failed to save pinned state:', chrome.runtime.lastError);
          }
          resolve();
        });
      } catch (e) {
        console.error('Error saving pinned state:', e);
        resolve();
      }
    });
  }
};


