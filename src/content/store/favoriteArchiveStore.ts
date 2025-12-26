export interface FavoriteArchiveLink {
  conversationId: string;
  nodeIndex: number;
}

export interface FavoriteArchiveFolder {
  id: string;
  name: string;
  folders: FavoriteArchiveFolder[];
  links: FavoriteArchiveLink[];
  createdAt: number;
  updatedAt: number;
}

export interface FavoriteArchiveState {
  version: 1;
  rootFolders: FavoriteArchiveFolder[];
}

const STORAGE_KEY = 'llm-nav-favorites-archive';

function now(): number {
  return Date.now();
}

export function toFavoriteLinkKey(link: FavoriteArchiveLink): string {
  return `${link.conversationId}#${link.nodeIndex}`;
}

function createEmptyState(): FavoriteArchiveState {
  return { version: 1, rootFolders: [] };
}

function normalizeFolder(raw: any): FavoriteArchiveFolder | null {
  if (!raw || typeof raw !== 'object') return null;

  const id = typeof raw.id === 'string' && raw.id ? raw.id : `folder_${now()}_${Math.random().toString(16).slice(2)}`;
  const name = typeof raw.name === 'string' && raw.name ? raw.name : 'Untitled';
  const createdAt = typeof raw.createdAt === 'number' ? raw.createdAt : now();
  const updatedAt = typeof raw.updatedAt === 'number' ? raw.updatedAt : createdAt;

  const foldersRaw = Array.isArray(raw.folders) ? raw.folders : [];
  const linksRaw = Array.isArray(raw.links) ? raw.links : [];

  const folders = foldersRaw.map(normalizeFolder).filter(Boolean) as FavoriteArchiveFolder[];
  const links: FavoriteArchiveLink[] = linksRaw
    .map((l: any) => {
      if (!l || typeof l !== 'object') return null;
      if (typeof l.conversationId !== 'string' || !l.conversationId) return null;
      const nodeIndex = typeof l.nodeIndex === 'number' ? l.nodeIndex : Number(l.nodeIndex);
      if (!Number.isFinite(nodeIndex)) return null;
      return { conversationId: l.conversationId, nodeIndex };
    })
    .filter(Boolean) as FavoriteArchiveLink[];

  return { id, name, folders, links, createdAt, updatedAt };
}

function normalizeState(raw: any): FavoriteArchiveState {
  if (!raw || typeof raw !== 'object') return createEmptyState();

  const rootFoldersRaw =
    Array.isArray(raw.rootFolders) ? raw.rootFolders : Array.isArray(raw.roots) ? raw.roots : [];
  const rootFolders = rootFoldersRaw.map(normalizeFolder).filter(Boolean) as FavoriteArchiveFolder[];
  return { version: 1, rootFolders };
}

function findFolderInList(
  folders: FavoriteArchiveFolder[],
  folderId: string
): FavoriteArchiveFolder | null {
  for (const folder of folders) {
    if (folder.id === folderId) return folder;
    const found = findFolderInList(folder.folders, folderId);
    if (found) return found;
  }
  return null;
}

function deleteFolderFromList(folders: FavoriteArchiveFolder[], folderId: string): boolean {
  const index = folders.findIndex((f) => f.id === folderId);
  if (index >= 0) {
    folders.splice(index, 1);
    return true;
  }
  for (const folder of folders) {
    if (deleteFolderFromList(folder.folders, folderId)) return true;
  }
  return false;
}

function removeLinkFromList(folders: FavoriteArchiveFolder[], linkKey: string): boolean {
  let changed = false;
  for (const folder of folders) {
    const before = folder.links.length;
    folder.links = folder.links.filter((l) => toFavoriteLinkKey(l) !== linkKey);
    if (folder.links.length !== before) {
      folder.updatedAt = now();
      changed = true;
    }
    if (removeLinkFromList(folder.folders, linkKey)) changed = true;
  }
  return changed;
}

export const FavoriteArchiveStore = {
  async load(): Promise<FavoriteArchiveState> {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(STORAGE_KEY, (result) => {
          if (chrome.runtime.lastError) {
            resolve(createEmptyState());
            return;
          }
          resolve(normalizeState(result[STORAGE_KEY]));
        });
      } catch {
        resolve(createEmptyState());
      }
    });
  },

  async save(state: FavoriteArchiveState): Promise<void> {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [STORAGE_KEY]: state }, () => resolve());
      } catch {
        resolve();
      }
    });
  }
};

export function createArchiveFolder(
  state: FavoriteArchiveState,
  parentFolderId: string | null,
  name: string
): FavoriteArchiveFolder {
  const folder: FavoriteArchiveFolder = {
    id: `folder_${now()}_${Math.random().toString(16).slice(2)}`,
    name: name || 'Untitled',
    folders: [],
    links: [],
    createdAt: now(),
    updatedAt: now()
  };

  if (!parentFolderId) {
    state.rootFolders.push(folder);
    return folder;
  }

  const parent = findFolderInList(state.rootFolders, parentFolderId);
  if (!parent) {
    state.rootFolders.push(folder);
    return folder;
  }

  parent.folders.push(folder);
  parent.updatedAt = now();
  return folder;
}

export function renameArchiveFolder(
  state: FavoriteArchiveState,
  folderId: string,
  newName: string
): boolean {
  const folder = findFolderInList(state.rootFolders, folderId);
  if (!folder) return false;
  folder.name = newName || folder.name;
  folder.updatedAt = now();
  return true;
}

export function deleteArchiveFolder(state: FavoriteArchiveState, folderId: string): boolean {
  return deleteFolderFromList(state.rootFolders, folderId);
}

export function addArchiveLinkToFolder(
  state: FavoriteArchiveState,
  folderId: string,
  link: FavoriteArchiveLink
): boolean {
  const folder = findFolderInList(state.rootFolders, folderId);
  if (!folder) return false;

  const linkKey = toFavoriteLinkKey(link);

  // 保证 link 在任一文件夹中只出现一次
  removeLinkFromList(state.rootFolders, linkKey);

  if (folder.links.some((l) => toFavoriteLinkKey(l) === linkKey)) return false;
  folder.links.push({ conversationId: link.conversationId, nodeIndex: link.nodeIndex });
  folder.updatedAt = now();
  return true;
}

export function removeArchiveLinkFromFolder(
  state: FavoriteArchiveState,
  folderId: string,
  link: FavoriteArchiveLink
): boolean {
  const folder = findFolderInList(state.rootFolders, folderId);
  if (!folder) return false;

  const linkKey = toFavoriteLinkKey(link);
  const before = folder.links.length;
  folder.links = folder.links.filter((l) => toFavoriteLinkKey(l) !== linkKey);
  if (folder.links.length === before) return false;
  folder.updatedAt = now();
  return true;
}

export function getAllArchivedLinkKeys(state: FavoriteArchiveState): Set<string> {
  const keys = new Set<string>();
  const walk = (folders: FavoriteArchiveFolder[]) => {
    folders.forEach((folder) => {
      folder.links.forEach((l) => keys.add(toFavoriteLinkKey(l)));
      walk(folder.folders);
    });
  };
  walk(state.rootFolders);
  return keys;
}

export function cleanupArchivedLinks(
  state: FavoriteArchiveState,
  existingLinkKeys: Set<string>
): boolean {
  let changed = false;
  const walk = (folders: FavoriteArchiveFolder[]) => {
    folders.forEach((folder) => {
      const before = folder.links.length;
      folder.links = folder.links.filter((l) => existingLinkKeys.has(toFavoriteLinkKey(l)));
      if (folder.links.length !== before) {
        folder.updatedAt = now();
        changed = true;
      }
      walk(folder.folders);
    });
  };
  walk(state.rootFolders);
  return changed;
}

export function findArchiveFolder(
  state: FavoriteArchiveState,
  folderId: string
): FavoriteArchiveFolder | null {
  return findFolderInList(state.rootFolders, folderId);
}
