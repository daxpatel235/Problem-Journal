import { invoke } from "@tauri-apps/api/core";
import type {
  CreateProblemInput,
  Problem,
  ProblemFilters,
  ProblemSummary,
  UpdateProblemInput,
} from "@/types/problem";
import type { BackupInfo, SettingsMap } from "@/types/settings";

export const api = {
  problems: {
    create: (input: CreateProblemInput) =>
      invoke<Problem>("create_problem", { input }),
    update: (input: UpdateProblemInput) =>
      invoke<Problem>("update_problem", { input }),
    get: (id: string) => invoke<Problem | null>("get_problem", { id }),
    list: () => invoke<ProblemSummary[]>("list_problems"),
    listTrash: () => invoke<ProblemSummary[]>("list_trash"),
    filter: (filters: ProblemFilters) =>
      invoke<ProblemSummary[]>("get_filtered_problems", { filters }),
    toggleFavorite: (id: string) => invoke<Problem>("toggle_favorite", { id }),
    softDelete: (id: string) => invoke<void>("delete_problem", { id }),
    restore: (id: string) => invoke<void>("restore_problem", { id }),
    permanentDelete: (id: string) =>
      invoke<void>("permanent_delete_problem", { id }),
    duplicate: (id: string) => invoke<Problem>("duplicate_problem", { id }),
    importJson: (json: string) =>
      invoke<number>("import_problems_json", { json }),
  },
  settings: {
    get: (key: string) => invoke<string | null>("get_setting", { key }),
    set: (key: string, value: string) =>
      invoke<void>("set_setting", { key, value }),
    getAll: () => invoke<SettingsMap>("get_all_settings"),
  },
  backups: {
    create: () => invoke<BackupInfo>("create_backup"),
    list: () => invoke<BackupInfo[]>("list_backups"),
    restore: (path: string) => invoke<void>("restore_backup", { path }),
  },
  export: {
    problemMarkdown: (id: string) =>
      invoke<string>("export_problem_markdown", { id }),
    problemJson: (id: string) => invoke<string>("export_problem_json", { id }),
    problemPdfHtml: (id: string) =>
      invoke<string>("export_problem_pdf_html", { id }),
    allJson: () => invoke<string>("export_all_json"),
  },
};
