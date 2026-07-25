export type SettingsMap = Record<string, string>;

export const SETTINGS_KEYS = {
  ZOOM_LEVEL: "zoom_level",
  SIDEBAR_WIDTH: "sidebar_width",
  TIMELINE_WIDTH: "timeline_width",
  LAST_OPENED_PROBLEM_ID: "last_opened_problem_id",
  BACKUP_DIR: "backup_dir",
  BACKUP_RETENTION: "backup_retention",
  AUTOSAVE_ENABLED: "autosave_enabled",
  THEME: "theme",
} as const;

export const ZOOM_LEVELS = [75, 80, 90, 100, 110, 125, 150, 175, 200] as const;
export type ZoomLevel = (typeof ZOOM_LEVELS)[number];

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export interface BackupInfo {
  fileName: string;
  path: string;
  sizeBytes: number;
  createdAt: string;
}
