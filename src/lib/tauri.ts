import { invoke } from "@tauri-apps/api/core";
import type {
  CreateProblemInput,
  Problem,
  ProblemFilters,
  ProblemSummary,
  UpdateProblemInput,
} from "@/types/problem";
import type { BackupInfo, SettingsMap } from "@/types/settings";
import type { Folder } from "@/types/folder";

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
  folders: {
    list: () => invoke<Folder[]>("list_folders"),
    create: (name: string, parentId: string | null) =>
      invoke<Folder>("create_folder", { name, parentId }),
    rename: (id: string, name: string) => invoke<Folder>("rename_folder", { id, name }),
    move: (id: string, parentId: string | null) =>
      invoke<Folder>("move_folder", { id, parentId }),
    delete: (id: string) => invoke<void>("delete_folder", { id }),
    listProblems: (folderId: string) =>
      invoke<ProblemSummary[]>("list_folder_problems", { folderId }),
    addProblems: (folderId: string, problemIds: string[]) =>
      invoke<number>("add_problems_to_folder", { folderId, problemIds }),
    removeProblem: (folderId: string, problemId: string) =>
      invoke<void>("remove_problem_from_folder", { folderId, problemId }),
    moveProblem: (problemId: string, fromFolderId: string, toFolderId: string) =>
      invoke<void>("move_problem_to_folder", { problemId, fromFolderId, toFolderId }),
    folderIdsForProblem: (problemId: string) =>
      invoke<string[]>("get_problem_folder_ids", { problemId }),
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
