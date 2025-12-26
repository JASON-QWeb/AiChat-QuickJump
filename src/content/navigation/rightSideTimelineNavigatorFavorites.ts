import type { PromptAnswerItem } from './answerIndexManager';
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
import { ChristmasThemeEffects, SciFiThemeEffects } from './themeEffects';
import type { TimelineTheme } from './themes';

export type FavoritesContext = {
  container: HTMLElement;
  topStarButton: HTMLElement | null;
  bottomStarsButton: HTMLElement | null;
  favoritesModal: HTMLElement | null;
  favoritesModalView: 'front' | 'back';
  isFavorited: boolean;
  siteName: string;
  currentUrl: string;
  conversationId: string | null;
  pinnedNodes: Set<string>;
  items: PromptAnswerItem[];
  currentTheme: TimelineTheme;
  onClickCallback: ((index: number) => void) | null;
  tutorialStep: 0 | 1 | 2 | 3 | 4 | 5;
  t: (key: string) => string;
  updateTopStarStyle: () => void;
  handleFavoriteClick: () => Promise<void>;
  playStarBounceAnimation: () => void;
  syncPinnedToFavorites: () => Promise<void>;
  showFavoritesModal: (initialView?: 'front' | 'back') => Promise<void>;
  createConversationItem: (conv: FavoriteConversation) => HTMLElement;
  createFavoritesModalFooter: (side: 'front' | 'back') => HTMLElement;
  openOptionsPage: () => void;
  showConfirmDialog: (message: string) => Promise<boolean>;
  showInputDialog: (title: string, defaultValue: string, placeholder: string) => Promise<string | null>;
  navigateToFavorite: (conv: FavoriteConversation, nodeIndex: number) => void;
  closeFavoritesModal: () => void;
  removeFavoritesModalElements: () => void;
  getSiteIconUrl: (siteName: string) => string;
  maybeContinueTutorialAfterFavoritesModalOpened: () => void;
  endTutorial: () => void;
};

/**
 * 创建顶部单星按钮（收藏当前对话）
 */
export function createTopStarButton(ctx: FavoritesContext): void {
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
  button.title = ctx.t('favorites.add');

  button.addEventListener('mouseenter', () => {
    button.style.opacity = '1';
    button.style.transform = 'translateX(-50%) scale(1.2)';
  });

  button.addEventListener('mouseleave', () => {
    button.style.opacity = ctx.isFavorited ? '1' : '0.5';
    button.style.transform = 'translateX(-50%) scale(1)';
  });

  button.addEventListener('click', () => ctx.handleFavoriteClick());

  ctx.container.appendChild(button);
  ctx.topStarButton = button;
}

/**
 * 创建底部三星按钮（打开收藏列表）
 */
export function createBottomStarsButton(ctx: FavoritesContext): void {
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
    color: ctx.currentTheme.pinnedColor // 跟随主题颜色
  });

  // 三星重叠效果
  button.innerHTML = `
    <span style="position: relative;">
      <span style="position: absolute; left: -6px; top: 0; opacity: 0.7;">★</span>
      <span style="position: relative; z-index: 1;">★</span>
      <span style="position: absolute; left: 6px; top: 0; opacity: 0.7;">★</span>
    </span>
  `;
  button.title = ctx.t('favorites.viewAll');

  button.addEventListener('mouseenter', () => {
    button.style.transform = 'translateX(-50%) scale(1.2)';
  });

  button.addEventListener('mouseleave', () => {
    button.style.transform = 'translateX(-50%) scale(1)';
  });

  button.addEventListener('click', () => ctx.showFavoritesModal());

  ctx.container.appendChild(button);
  ctx.bottomStarsButton = button;
}

/**
 * 更新底部三星样式（主题变化时调用）
 */
export function updateBottomStarsStyle(ctx: FavoritesContext): void {
  if (!ctx.bottomStarsButton) return;

  const themeTypeFlag = ctx.currentTheme.themeType;

  // 首先彻底清除所有内容，防止重复元素
  while (ctx.bottomStarsButton.firstChild) {
    ctx.bottomStarsButton.removeChild(ctx.bottomStarsButton.firstChild);
  }
  ctx.bottomStarsButton.innerHTML = '';

  if (themeTypeFlag === 'christmas') {
    // 圣诞主题：礼物图片
    ctx.bottomStarsButton.innerHTML = ChristmasThemeEffects.createBottomGifts();
    ctx.bottomStarsButton.style.color = '';
    ctx.bottomStarsButton.style.width = '40px';
    ctx.bottomStarsButton.style.height = '32px';
  } else if (themeTypeFlag === 'scifi') {
    // 科幻主题：Love Death Robots 动画（5s周期）
    const ldrElement = SciFiThemeEffects.createLDRBottom();
    ctx.bottomStarsButton.appendChild(ldrElement);
    ctx.bottomStarsButton.style.color = '';
    ctx.bottomStarsButton.style.width = '65px';
    ctx.bottomStarsButton.style.height = '40px';
  } else {
    // 普通主题：三星
    ctx.bottomStarsButton.innerHTML = `
      <span style="position: relative;">
        <span style="position: absolute; left: -6px; top: 0; opacity: 0.7;">★</span>
        <span style="position: relative; z-index: 1;">★</span>
        <span style="position: absolute; left: 6px; top: 0; opacity: 0.7;">★</span>
      </span>
    `;
    ctx.bottomStarsButton.style.color = ctx.currentTheme.pinnedColor;
    ctx.bottomStarsButton.style.width = '36px';
    ctx.bottomStarsButton.style.height = '28px';
  }
}

/**
 * 处理收藏按钮点击
 */
export async function handleFavoriteClick(ctx: FavoritesContext): Promise<void> {
  if (!ctx.conversationId) return;

  ctx.currentUrl = window.location.href;

  if (ctx.isFavorited) {
    // 取消收藏
    await FavoriteStore.unfavoriteConversation(ctx.conversationId);
    ctx.isFavorited = false;
  } else {
    // 收藏当前对话
    // 收集所有被标记的节点
    const pinnedItems: Array<{ index: number; promptText: string }> = [];

    ctx.pinnedNodes.forEach(nodeId => {
      const index = parseInt(nodeId);
      if (ctx.items[index]) {
        pinnedItems.push({
          index,
          promptText: ctx.items[index].promptText
        });
      }
    });

    // 如果没有标记的节点，收藏整个对话（使用第一个节点作为代表）
    if (pinnedItems.length === 0 && ctx.items.length > 0) {
      pinnedItems.push({
        index: 0,
        promptText: ctx.items[0].promptText
      });
    }

    // 获取整个对话的标题（使用第一个问题的文本）
    const chatTitle = ctx.items.length > 0 ? ctx.items[0].promptText : ctx.t('favorites.unnamed');

    await FavoriteStore.favoriteConversation(
      ctx.conversationId,
      ctx.currentUrl,
      ctx.siteName || 'Unknown',
      chatTitle,
      pinnedItems
    );
    ctx.isFavorited = true;
  }

  ctx.updateTopStarStyle();

  // 添加跳跃动画反馈
  ctx.playStarBounceAnimation();
}

/**
 * 播放星星跳跃动画
 */
export function playStarBounceAnimation(ctx: FavoritesContext): void {
  if (!ctx.topStarButton) return;

  // 添加跳跃动画
  ctx.topStarButton.style.transition = 'transform 0.1s ease-out';
  ctx.topStarButton.style.transform = 'translateX(-50%) scale(1.4) translateY(-8px)';

  setTimeout(() => {
    if (ctx.topStarButton) {
      ctx.topStarButton.style.transform = 'translateX(-50%) scale(0.9) translateY(2px)';
    }
  }, 100);

  setTimeout(() => {
    if (ctx.topStarButton) {
      ctx.topStarButton.style.transform = 'translateX(-50%) scale(1.1) translateY(-3px)';
    }
  }, 200);

  setTimeout(() => {
    if (ctx.topStarButton) {
      ctx.topStarButton.style.transform = 'translateX(-50%) scale(1)';
      ctx.topStarButton.style.transition = 'all 0.2s ease';
    }
  }, 300);
}

/**
 * 同步标记节点到收藏（当标记状态变化时调用）
 * 如果有标记节点但尚未收藏，会自动创建收藏
 */
export async function syncPinnedToFavorites(ctx: FavoritesContext): Promise<void> {
  if (!ctx.conversationId) return;

  // 收集当前所有被标记的节点
  const pinnedItems: Array<{ index: number; promptText: string }> = [];

  ctx.pinnedNodes.forEach(nodeId => {
    const index = parseInt(nodeId);
    if (ctx.items[index]) {
      pinnedItems.push({
        index,
        promptText: ctx.items[index].promptText
      });
    }
  });

  // 如果有标记的节点但尚未收藏，自动创建收藏
  if (pinnedItems.length > 0 && !ctx.isFavorited) {
    ctx.currentUrl = window.location.href;
    const chatTitle = ctx.items.length > 0 ? ctx.items[0].promptText : ctx.t('favorites.unnamed');

    await FavoriteStore.favoriteConversation(
      ctx.conversationId,
      ctx.currentUrl,
      ctx.siteName || 'Unknown',
      chatTitle,
      pinnedItems
    );
    ctx.isFavorited = true;
    ctx.updateTopStarStyle();
    ctx.playStarBounceAnimation();
    return;
  }

  // 如果已收藏，更新收藏的子项
  if (ctx.isFavorited) {
    // 如果没有标记的节点了，保留第一个节点作为代表
    if (pinnedItems.length === 0 && ctx.items.length > 0) {
      pinnedItems.push({
        index: 0,
        promptText: ctx.items[0].promptText
      });
    }
    await FavoriteStore.updateFavoriteItems(ctx.conversationId, pinnedItems);
  }
}

/**
 * 更新顶部星星样式
 */
export function updateTopStarStyle(ctx: FavoritesContext): void {
  if (!ctx.topStarButton) return;

  const themeTypeFlag = ctx.currentTheme.themeType;

  if (themeTypeFlag === 'christmas') {
    // 圣诞主题：梦幻模糊星星，根据收藏状态显示不同亮度
    ctx.topStarButton.innerHTML = ChristmasThemeEffects.createTopStar(ctx.isFavorited);
    ctx.topStarButton.style.opacity = '1';
    ctx.topStarButton.style.color = '';
  } else if (themeTypeFlag === 'scifi') {
    // 科幻主题：红色骷髅头
    ctx.topStarButton.innerHTML = SciFiThemeEffects.createTopSkull(ctx.isFavorited);
    ctx.topStarButton.style.opacity = '1';
    ctx.topStarButton.style.color = '';
  } else {
    // 普通主题：星星
    if (ctx.isFavorited) {
      ctx.topStarButton.innerHTML = '★'; // 实心星星
      ctx.topStarButton.style.color = ctx.currentTheme.pinnedColor;
      ctx.topStarButton.style.opacity = '1';
    } else {
      ctx.topStarButton.innerHTML = '☆'; // 空心星星
      ctx.topStarButton.style.color = ctx.currentTheme.defaultNodeColor;
      ctx.topStarButton.style.opacity = '0.5';
    }
  }

  ctx.topStarButton.title = ctx.isFavorited ? ctx.t('favorites.remove') : ctx.t('favorites.add');
}

/**
 * 刷新收藏弹窗（保持当前视图）
 */
export async function refreshFavoritesModalIfOpen(ctx: FavoritesContext): Promise<void> {
  if (!ctx.favoritesModal) return;
  const currentView = ctx.favoritesModalView;
  await ctx.showFavoritesModal(currentView);
}

/**
 * 显示收藏列表弹窗
 */
export async function showFavoritesModal(
  ctx: FavoritesContext,
  initialView: 'front' | 'back' = 'front'
): Promise<void> {
  // 如果弹窗已存在，先移除
  ctx.removeFavoritesModalElements();
  ctx.favoritesModalView = initialView;

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
    ctx.currentTheme.name === '暗色' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

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
      color: opts.danger ? '#e53935' : ctx.currentTheme.tooltipTextColor,
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
      empty.textContent = ctx.t('favorites.archive.noImportable');
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
      siteIcon.src = ctx.getSiteIconUrl(info.conv.siteName);
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
        title: ctx.t('favorites.archive.addToFolder'),
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
      backgroundColor: ctx.currentTheme.tooltipBackgroundColor,
      color: ctx.currentTheme.tooltipTextColor,
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
    title.textContent = `${ctx.t('favorites.archive.importTo')}: ${folder.name}`;
    Object.assign(title.style, { fontSize: '14px', fontWeight: '600', overflow: 'hidden' });

    const closeBtn = createIconButton({
      title: ctx.t('favorites.archive.close'),
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
      emptyMsg.textContent = ctx.t('favorites.empty');
      Object.assign(emptyMsg.style, {
        textAlign: 'center',
        color: 'rgba(128,128,128,0.8)',
        padding: '40px 0'
      });
      container.appendChild(emptyMsg);
      return;
    }

    favorites.forEach((conv) => {
      const convItem = ctx.createConversationItem(conv);
      container.appendChild(convItem);
    });
  };

  const renderArchiveTree = (): void => {
    if (!archiveContent) return;
    const treeContainer = archiveContent;

    treeContainer.innerHTML = '';

    if (archiveState.rootFolders.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = ctx.t('favorites.archive.noFolders');
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
        siteIcon.src = ctx.getSiteIconUrl(info.conv.siteName);
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
        : ctx.t('favorites.archive.missingLink');
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
        title: ctx.t('favorites.archive.removeFromFolder'),
        svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
        onClick: async () => {
          removeArchiveLinkFromFolder(archiveState, folderId, link);
          await FavoriteArchiveStore.save(archiveState);
          renderArchiveTree();
          renderImportList();
        }
      });

      if (info) {
        row.addEventListener('click', () => ctx.navigateToFavorite(info.conv, info.link.nodeIndex));
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
        title: ctx.t('favorites.archive.import'),
        svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
        onClick: () => openImportDialog(folder.id)
      });

      const addFolderBtn = createIconButton({
        title: ctx.t('favorites.archive.newSubfolder'),
        svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v2"></path><path d="M21 15v6"></path><path d="M18 18h6"></path><path d="M3 11v8a2 2 0 0 0 2 2h11"></path></svg>`,
        onClick: async () => {
          const folderName = await ctx.showInputDialog(
            ctx.t('favorites.archive.newSubfolder'),
            '',
            ctx.t('favorites.archive.folderNamePlaceholder')
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
        title: ctx.t('favorites.archive.rename'),
        svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg>`,
        onClick: async () => {
          const folderName = await ctx.showInputDialog(
            ctx.t('favorites.archive.rename'),
            folder.name,
            ctx.t('favorites.archive.folderNamePlaceholder')
          );
          if (!folderName) return;
          renameArchiveFolder(archiveState, folder.id, folderName);
          await FavoriteArchiveStore.save(archiveState);
          renderArchiveTree();
        }
      });

      const deleteBtn = createIconButton({
        title: ctx.t('favorites.archive.deleteFolder'),
        svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>`,
        danger: true,
        onClick: async () => {
          const confirmed = await ctx.showConfirmDialog(
            ctx.t('favorites.archive.folderDeleteConfirm')
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
    backgroundColor: ctx.currentTheme.tooltipBackgroundColor,
    color: ctx.currentTheme.tooltipTextColor,
    backfaceVisibility: 'hidden'
  });

  const back = document.createElement('div');
  Object.assign(back.style, {
    position: 'absolute',
    inset: '0',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: ctx.currentTheme.tooltipBackgroundColor,
    color: ctx.currentTheme.tooltipTextColor,
    backfaceVisibility: 'hidden',
    transform: 'rotateY(180deg)'
  });

  let isArchiveView = initialView === 'back';
  const setArchiveView = async (value: boolean) => {
    isArchiveView = value;
    ctx.favoritesModalView = value ? 'back' : 'front';
    card.style.transform = isArchiveView ? 'rotateY(180deg)' : 'rotateY(0deg)';
    if (isArchiveView) {
      await refreshFavoritesCache();
      renderArchiveTree();
    }
  };

  const createCloseButton = () =>
    createIconButton({
      title: ctx.t('favorites.archive.close'),
      svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
      onClick: () => ctx.closeFavoritesModal()
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
  frontTitle.textContent = ctx.t('favorites.list');
  Object.assign(frontTitle.style, { margin: '0', fontSize: '16px', fontWeight: '600' });

  const flipToArchiveBtn = createIconButton({
    title: ctx.t('favorites.archive.open'),
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
  front.appendChild(ctx.createFavoritesModalFooter('front'));

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
  backTitle.textContent = ctx.t('favorites.archive.title');
  Object.assign(backTitle.style, { margin: '0', fontSize: '16px', fontWeight: '600' });

  const flipToFavoritesBtn = createIconButton({
    title: ctx.t('favorites.archive.back'),
    svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 3 3 3 3 9"></polyline><polyline points="15 21 21 21 21 15"></polyline><line x1="3" y1="3" x2="10" y2="10"></line><line x1="21" y1="21" x2="14" y2="14"></line></svg>`,
    onClick: async () => setArchiveView(false)
  });

  backTitleGroup.appendChild(backTitle);
  backTitleGroup.appendChild(flipToFavoritesBtn);

  const backRight = document.createElement('div');
  Object.assign(backRight.style, { display: 'flex', alignItems: 'center', gap: '6px' });

  const newFolderBtn = createIconButton({
    title: ctx.t('favorites.archive.newFolder'),
    svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"></path><path d="M12 11v6"></path><path d="M9 14h6"></path></svg>`,
    onClick: async () => {
      const folderName = await ctx.showInputDialog(
        ctx.t('favorites.archive.newFolder'),
        '',
        ctx.t('favorites.archive.folderNamePlaceholder')
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
  back.appendChild(ctx.createFavoritesModalFooter('back'));

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
  overlay.addEventListener('click', () => ctx.closeFavoritesModal());

  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  ctx.favoritesModal = modal;
  ctx.maybeContinueTutorialAfterFavoritesModalOpened();
  if (initialView === 'back') {
    await setArchiveView(true);
  }
}

export function createFavoritesModalFooter(
  ctx: FavoritesContext,
  side: 'front' | 'back'
): HTMLElement {
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
  openSourceLink.textContent = ctx.t('favorites.footer.openSource');
  openSourceLink.target = '_blank';
  openSourceLink.rel = 'noopener noreferrer';
  Object.assign(openSourceLink.style, {
    flex: '1',
    minWidth: '0',
    color: ctx.currentTheme.pinnedColor,
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
  settingsBtn.title = ctx.t('favorites.footer.settings');
  settingsBtn.setAttribute('aria-label', ctx.t('favorites.footer.settings'));
  settingsBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V22a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 20.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 3.6a1.65 1.65 0 0 0 1-1.51V2a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 20.4 9a1.65 1.65 0 0 0 1.51 1H22a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
  Object.assign(settingsBtn.style, {
    background: 'none',
    border: 'none',
    padding: '6px',
    cursor: 'pointer',
    color: ctx.currentTheme.tooltipTextColor,
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
    ctx.openOptionsPage();
  });

  footer.appendChild(openSourceLink);
  footer.appendChild(settingsBtn);
  return footer;
}

export function openOptionsPage(): void {
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

/**
 * 创建对话收藏项
 */
export function createConversationItem(ctx: FavoritesContext, conv: FavoriteConversation): HTMLElement {
  const theme = ctx.currentTheme;
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
  titleText.title = ctx.t('favorites.clickToOpen');
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
    ctx.navigateToFavorite(conv, conv.items[0]?.nodeIndex || 0);
  });

  // 编辑按钮（简笔画铅笔图标）
  const editBtn = document.createElement('button');
  editBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
  editBtn.title = ctx.t('favorites.editTitle');
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
  deleteBtn.title = ctx.t('favorites.delete');
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
    const confirmed = await ctx.showConfirmDialog(ctx.t('favorites.confirmDelete'));
    if (confirmed) {
      await FavoriteStore.unfavoriteConversation(conv.conversationId);
      item.remove();
      // 如果删除的是当前对话，更新星星状态
      if (ctx.conversationId === conv.conversationId) {
        ctx.isFavorited = false;
        ctx.updateTopStarStyle();
      }
    }
  });

  // 网站图标
  const siteIcon = document.createElement('img');
  const iconUrl = ctx.getSiteIconUrl(conv.siteName);
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
    subDeleteBtn.title = ctx.t('favorites.deleteSubItem');
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
      const confirmed = await ctx.showConfirmDialog(ctx.t('favorites.confirmDelete'));
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
      ctx.navigateToFavorite(conv, subItem.nodeIndex);
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
export function navigateToFavorite(
  ctx: FavoritesContext,
  conv: FavoriteConversation,
  nodeIndex: number
): void {
  const currentUrl = window.location.href;
  const targetUrl = conv.url;

  // 如果是当前页面，直接跳转到节点
  if (currentUrl === targetUrl || ctx.conversationId === conv.conversationId) {
    ctx.closeFavoritesModal();

    // 触发点击回调跳转到指定节点
    if (ctx.onClickCallback) {
      ctx.onClickCallback(nodeIndex);
    }
  } else {
    // 跳转到其他页面
    // 在 URL 中添加节点索引参数，以便页面加载后跳转
    const url = new URL(targetUrl);
    url.searchParams.set('llm_nav_index', String(nodeIndex));
    window.open(url.toString(), '_blank');
    ctx.closeFavoritesModal();
  }
}

/**
 * 关闭收藏弹窗
 */
export function closeFavoritesModal(ctx: FavoritesContext): void {
  if (ctx.tutorialStep >= 3) {
    ctx.endTutorial();
  }
  ctx.removeFavoritesModalElements();
}

export function removeFavoritesModalElements(ctx: FavoritesContext): void {
  if (ctx.favoritesModal) {
    ctx.favoritesModal.remove();
    ctx.favoritesModal = null;
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
export function showConfirmDialog(ctx: FavoritesContext, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const theme = ctx.currentTheme;

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
    cancelBtn.textContent = ctx.t('favorites.cancel');
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
    confirmBtn.textContent = ctx.t('favorites.confirm');
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

export function showInputDialog(
  ctx: FavoritesContext,
  title: string,
  defaultValue: string,
  placeholder: string
): Promise<string | null> {
  return new Promise((resolve) => {
    const theme = ctx.currentTheme;

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
    cancelBtn.textContent = ctx.t('favorites.cancel');
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
    confirmBtn.textContent = ctx.t('favorites.confirm');
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
 * 获取网站对应的图标 URL
 */
export function getSiteIconUrl(siteName: string): string {
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
 * 如果有标记节点但未收藏，自动创建收藏
 */
export async function autoFavoriteIfNeeded(ctx: FavoritesContext): Promise<void> {
  if (!ctx.conversationId || ctx.items.length === 0) return;

  const isExplicitlyFavorited = await FavoriteStore.isFavorited(ctx.conversationId);
  if (isExplicitlyFavorited) return;

  if (ctx.pinnedNodes.size > 0) {
    const pinnedItems: Array<{ index: number; promptText: string }> = [];
    ctx.pinnedNodes.forEach(nodeId => {
      const index = parseInt(nodeId);
      if (ctx.items[index]) {
        pinnedItems.push({
          index,
          promptText: ctx.items[index].promptText
        });
      }
    });

    if (pinnedItems.length > 0) {
      const chatTitle = ctx.items.length > 0 ? ctx.items[0].promptText : ctx.t('favorites.unnamed');
      await FavoriteStore.favoriteConversation(
        ctx.conversationId,
        ctx.currentUrl,
        ctx.siteName || 'Unknown',
        chatTitle,
        pinnedItems
      );
      ctx.isFavorited = true;
      ctx.updateTopStarStyle();
    }
  }
}
