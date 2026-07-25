import { create } from "zustand";
import { api } from "@/lib/tauri";
import {
  SETTINGS_KEYS,
  type ResolvedTheme,
  type ThemeMode,
  type ZoomLevel,
} from "@/types/settings";

interface SettingsState {
  loaded: boolean;
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  zoomLevel: ZoomLevel;
  sidebarWidth: number;
  timelineWidth: number;
  lastOpenedProblemId: string | null;
  backupDir: string;
  backupRetention: number;
  autosaveEnabled: boolean;

  loadSettings: () => Promise<void>;
  setTheme: (theme: ThemeMode) => void;
  setResolvedTheme: (theme: ResolvedTheme) => void;
  setZoom: (level: ZoomLevel) => void;
  setSidebarWidth: (width: number) => void;
  setTimelineWidth: (width: number) => void;
  setLastOpenedProblemId: (id: string | null) => void;
  setBackupDir: (dir: string) => void;
  setBackupRetention: (retention: number) => void;
  setAutosaveEnabled: (enabled: boolean) => void;
}

function persist(key: string, value: string) {
  void api.settings.set(key, value);
}

export const useSettingsStore = create<SettingsState>((set) => ({
  loaded: false,
  theme: "dark",
  resolvedTheme: "dark",
  zoomLevel: 100,
  sidebarWidth: 56,
  timelineWidth: 30,
  lastOpenedProblemId: null,
  backupDir: "",
  backupRetention: 10,
  autosaveEnabled: true,

  loadSettings: async () => {
    const all = await api.settings.getAll();
    const storedTheme = all[SETTINGS_KEYS.THEME];
    set({
      loaded: true,
      theme:
        storedTheme === "light" || storedTheme === "dark" || storedTheme === "system"
          ? storedTheme
          : "dark",
      zoomLevel: (Number(all[SETTINGS_KEYS.ZOOM_LEVEL]) || 100) as ZoomLevel,
      sidebarWidth: Number(all[SETTINGS_KEYS.SIDEBAR_WIDTH]) || 56,
      timelineWidth: Number(all[SETTINGS_KEYS.TIMELINE_WIDTH]) || 30,
      lastOpenedProblemId: all[SETTINGS_KEYS.LAST_OPENED_PROBLEM_ID] || null,
      backupDir: all[SETTINGS_KEYS.BACKUP_DIR] || "",
      backupRetention: Number(all[SETTINGS_KEYS.BACKUP_RETENTION]) || 10,
      // Autosave defaults ON; only an explicit "false" disables it.
      autosaveEnabled: all[SETTINGS_KEYS.AUTOSAVE_ENABLED] !== "false",
    });
  },

  setTheme: (theme) => {
    set({ theme });
    persist(SETTINGS_KEYS.THEME, theme);
  },

  setResolvedTheme: (resolvedTheme) => {
    set({ resolvedTheme });
  },

  setZoom: (level) => {
    set({ zoomLevel: level });
    persist(SETTINGS_KEYS.ZOOM_LEVEL, String(level));
  },

  setSidebarWidth: (width) => {
    set({ sidebarWidth: width });
    persist(SETTINGS_KEYS.SIDEBAR_WIDTH, String(width));
  },

  setTimelineWidth: (width) => {
    set({ timelineWidth: width });
    persist(SETTINGS_KEYS.TIMELINE_WIDTH, String(width));
  },

  setLastOpenedProblemId: (id) => {
    set({ lastOpenedProblemId: id });
    persist(SETTINGS_KEYS.LAST_OPENED_PROBLEM_ID, id ?? "");
  },

  setBackupDir: (dir) => {
    set({ backupDir: dir });
    persist(SETTINGS_KEYS.BACKUP_DIR, dir);
  },

  setBackupRetention: (retention) => {
    set({ backupRetention: retention });
    persist(SETTINGS_KEYS.BACKUP_RETENTION, String(retention));
  },

  setAutosaveEnabled: (enabled) => {
    set({ autosaveEnabled: enabled });
    persist(SETTINGS_KEYS.AUTOSAVE_ENABLED, String(enabled));
  },
}));
