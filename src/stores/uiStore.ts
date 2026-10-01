import { create } from "zustand";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

/** Which main screen is showing: the timeline + editor split, or the folder explorer. */
export type MainView = "timeline" | "folders";

interface UiState {
  view: MainView;
  setView: (view: MainView) => void;
  searchOpen: boolean;
  settingsOpen: boolean;
  trashOpen: boolean;
  statsOpen: boolean;
  reviewOpen: boolean;
  commandOpen: boolean;
  confirm: ConfirmOptions | null;
  openSearch: () => void;
  closeSearch: () => void;
  openCommand: () => void;
  closeCommand: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  openTrash: () => void;
  closeTrash: () => void;
  openStats: () => void;
  closeStats: () => void;
  openReview: () => void;
  closeReview: () => void;
  requestConfirm: (options: ConfirmOptions) => void;
  clearConfirm: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  view: "timeline",
  setView: (view) => set({ view }),
  searchOpen: false,
  settingsOpen: false,
  trashOpen: false,
  statsOpen: false,
  reviewOpen: false,
  commandOpen: false,
  confirm: null,
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
  openCommand: () => set({ commandOpen: true }),
  closeCommand: () => set({ commandOpen: false }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  openTrash: () => set({ trashOpen: true }),
  closeTrash: () => set({ trashOpen: false }),
  openStats: () => set({ statsOpen: true }),
  closeStats: () => set({ statsOpen: false }),
  openReview: () => set({ reviewOpen: true }),
  closeReview: () => set({ reviewOpen: false }),
  requestConfirm: (options) => set({ confirm: options }),
  clearConfirm: () => set({ confirm: null }),
}));
