import { create } from "zustand";
import { api } from "@/lib/tauri";
import { folderSubtreeIds } from "@/lib/folders";
import { useProblemStore } from "@/stores/problemStore";
import type { Folder } from "@/types/folder";
import type { ProblemSummary } from "@/types/problem";

interface FolderState {
  folders: Folder[];
  loaded: boolean;
  /** Folder the explorer is showing; `null` is the top level. */
  currentFolderId: string | null;
  /** Problems directly inside `currentFolderId`. */
  folderProblems: ProblemSummary[];
  /** True while a problem is open full-screen from the explorer. */
  focusOpen: boolean;
  /** Bumped whenever problem↔folder links change, so open views can re-read them. */
  linksVersion: number;

  fetchFolders: () => Promise<void>;
  refresh: () => Promise<void>;
  openFolder: (id: string | null) => Promise<void>;
  goUp: () => Promise<void>;

  createFolder: (name: string, parentId: string | null) => Promise<Folder>;
  renameFolder: (id: string, name: string) => Promise<void>;
  moveFolder: (id: string, parentId: string | null) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;

  addProblems: (folderId: string, problemIds: string[]) => Promise<number>;
  removeProblem: (folderId: string, problemId: string) => Promise<void>;
  moveProblem: (problemId: string, fromFolderId: string, toFolderId: string) => Promise<void>;

  openProblem: (id: string) => Promise<void>;
  newProblemHere: () => Promise<void>;
  setFocusOpen: (open: boolean) => void;
  closeProblem: () => Promise<void>;
}

export const useFolderStore = create<FolderState>((set, get) => ({
  folders: [],
  loaded: false,
  currentFolderId: null,
  folderProblems: [],
  focusOpen: false,
  linksVersion: 0,

  fetchFolders: async () => {
    try {
      const folders = await api.folders.list();
      set({ folders, loaded: true });
    } catch (err) {
      console.error("Failed to load folders", err);
      set({ loaded: true });
    }
  },

  refresh: async () => {
    await get().fetchFolders();
    const { currentFolderId, folders } = get();
    // The folder we were in may have been deleted (e.g. a parent was removed).
    if (currentFolderId && !folders.some((f) => f.id === currentFolderId)) {
      set({ currentFolderId: null, folderProblems: [] });
      return;
    }
    if (!currentFolderId) {
      set({ folderProblems: [] });
      return;
    }
    try {
      const folderProblems = await api.folders.listProblems(currentFolderId);
      // Ignore a stale response if the user navigated away meanwhile.
      if (get().currentFolderId === currentFolderId) set({ folderProblems });
    } catch (err) {
      console.error("Failed to load folder contents", err);
    }
  },

  openFolder: async (id) => {
    set({ currentFolderId: id, folderProblems: [] });
    await get().refresh();
  },

  goUp: async () => {
    const { currentFolderId, folders } = get();
    if (!currentFolderId) return;
    const current = folders.find((f) => f.id === currentFolderId);
    await get().openFolder(current?.parentId ?? null);
  },

  createFolder: async (name, parentId) => {
    const folder = await api.folders.create(name, parentId);
    await get().fetchFolders();
    return folder;
  },

  renameFolder: async (id, name) => {
    await api.folders.rename(id, name);
    await get().fetchFolders();
  },

  moveFolder: async (id, parentId) => {
    await api.folders.move(id, parentId);
    await get().fetchFolders();
  },

  deleteFolder: async (id) => {
    const { folders, currentFolderId } = get();
    const doomed = folderSubtreeIds(folders, id);
    const parentId = folders.find((f) => f.id === id)?.parentId ?? null;
    await api.folders.delete(id);
    set((s) => ({ linksVersion: s.linksVersion + 1 }));
    // If we were standing inside the deleted folder, step out to its parent.
    if (currentFolderId && doomed.has(currentFolderId)) {
      await get().openFolder(parentId);
    } else {
      await get().refresh();
    }
  },

  addProblems: async (folderId, problemIds) => {
    const added = await api.folders.addProblems(folderId, problemIds);
    set((s) => ({ linksVersion: s.linksVersion + 1 }));
    await get().refresh();
    return added;
  },

  removeProblem: async (folderId, problemId) => {
    await api.folders.removeProblem(folderId, problemId);
    set((s) => ({ linksVersion: s.linksVersion + 1 }));
    await get().refresh();
  },

  moveProblem: async (problemId, fromFolderId, toFolderId) => {
    await api.folders.moveProblem(problemId, fromFolderId, toFolderId);
    set((s) => ({ linksVersion: s.linksVersion + 1 }));
    await get().refresh();
  },

  openProblem: async (id) => {
    await useProblemStore.getState().selectProblem(id);
    if (useProblemStore.getState().selectedId === id) set({ focusOpen: true });
  },

  newProblemHere: async () => {
    const folderId = get().currentFolderId;
    if (!folderId) return;
    await useProblemStore.getState().newProblem({ folderId });
    set({ focusOpen: true });
  },

  setFocusOpen: (open) => set({ focusOpen: open }),

  closeProblem: async () => {
    await useProblemStore.getState().flushSave();
    set({ focusOpen: false });
    await get().refresh();
  },
}));
