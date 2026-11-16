import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import {
  api,
  PDF_PROGRESS_EVENT,
  type PdfExportProgress,
  type PdfExportReport,
  type PdfExportRequest,
} from "@/lib/tauri";
import { buildExportIndex, subtreeProblemIds, type ExportIndex } from "@/lib/exportPlan";
import { useFolderStore } from "@/stores/folderStore";
import { useProblemStore } from "@/stores/problemStore";
import { useUiStore, type MainView } from "@/stores/uiStore";

/** The five ways to start an export (step 1 of the export page). */
export type ExportMode = "one" | "selected" | "folder" | "filtered" | "all";
export type ExportStep = "mode" | "pick" | "review";

/** Opening the export page already knowing what to export (editor menu, folder menu…). */
export interface ExportPreset {
  mode: ExportMode;
  problemIds?: string[];
  folderId?: string;
}

/** The PDF being written, if any. */
export type ExportJob =
  | { status: "idle" }
  | { status: "running"; phase: PdfExportProgress["phase"]; done: number; total: number; cancelling: boolean }
  | { status: "done"; report: PdfExportReport }
  | { status: "error"; message: string }
  | { status: "cancelled" };

interface ExportState {
  job: ExportJob;
  /** Last request, so "Try again" can repeat it. */
  lastRequest: PdfExportRequest | null;
  runExport: (request: PdfExportRequest) => Promise<void>;
  cancelExport: () => Promise<void>;
  resetJob: () => void;

  step: ExportStep;
  mode: ExportMode | null;
  selected: Set<string>;
  /** Folder the picker should open expanded and scrolled to. */
  focusFolderId: string | null;
  /** Where the close button goes back to. */
  returnView: Exclude<MainView, "export">;

  index: ExportIndex | null;
  loading: boolean;
  loadError: string | null;

  openExport: (preset?: ExportPreset) => Promise<void>;
  closeExport: () => void;
  loadData: () => Promise<void>;
  chooseMode: (mode: ExportMode) => void;
  goTo: (step: ExportStep) => void;
  toggle: (id: string) => void;
  /** Single-select (mode "one"): replaces the selection. */
  selectOnly: (id: string) => void;
  setMany: (ids: string[], on: boolean) => void;
  clearSelection: () => void;
}

/** Ids a mode starts with ticked (empty for "selected", or "folder" with no folder given). */
function presetSelection(
  mode: ExportMode,
  index: ExportIndex,
  folderId: string | null | undefined,
): Set<string> {
  switch (mode) {
    case "all":
      return new Set(index.problemById.keys());
    case "filtered":
      // Whatever the problem list is currently showing with its filters.
      return new Set(
        useProblemStore
          .getState()
          .problems.map((p) => p.id)
          .filter((id) => index.problemById.has(id)),
      );
    case "folder":
      return folderId
        ? new Set(subtreeProblemIds(useFolderStore.getState().folders, index, folderId))
        : new Set();
    case "one": {
      // Start from the problem that's open, if any.
      const open = useProblemStore.getState().selectedId;
      return open && index.problemById.has(open) ? new Set([open]) : new Set();
    }
    case "selected":
      return new Set();
  }
}

export const useExportStore = create<ExportState>((set, get) => ({
  job: { status: "idle" },
  lastRequest: null,

  runExport: async (request) => {
    if (get().job.status === "running") return;
    set({
      lastRequest: request,
      job: { status: "running", phase: "layout", done: 0, total: request.problemIds.length, cancelling: false },
    });
    const unlisten = await listen<PdfExportProgress>(PDF_PROGRESS_EVENT, (event) => {
      const job = get().job;
      if (job.status !== "running") return;
      set({ job: { ...job, ...event.payload } });
    });
    try {
      const report = await api.export.pdf(request);
      set({ job: { status: "done", report } });
    } catch (err) {
      const message = typeof err === "string" ? err : err instanceof Error ? err.message : String(err);
      set({ job: message === "cancelled" ? { status: "cancelled" } : { status: "error", message } });
    } finally {
      unlisten();
    }
  },

  cancelExport: async () => {
    const job = get().job;
    if (job.status !== "running") return;
    set({ job: { ...job, cancelling: true } });
    await api.export.cancelPdf();
  },

  resetJob: () => {
    if (get().job.status !== "running") set({ job: { status: "idle" } });
  },

  step: "mode",
  mode: null,
  selected: new Set(),
  focusFolderId: null,
  returnView: "timeline",
  index: null,
  loading: false,
  loadError: null,

  loadData: async () => {
    set({ loading: true, loadError: null });
    try {
      const [problems, links] = await Promise.all([
        api.problems.list(),
        api.folders.listLinks(),
        useFolderStore.getState().fetchFolders(),
      ]);
      const index = buildExportIndex(problems, links);
      // Drop selected ids that no longer exist (trashed since last time).
      const selected = new Set([...get().selected].filter((id) => index.problemById.has(id)));
      set({ index, selected, loading: false });
    } catch (err) {
      set({ loading: false, loadError: String(err) });
    }
  },

  openExport: async (preset) => {
    const ui = useUiStore.getState();
    if (ui.view !== "export") set({ returnView: ui.view });
    // A PDF is still being written: show its progress instead of starting over.
    if (get().job.status === "running") {
      ui.setView("export");
      set({ step: "review" });
      return;
    }
    set({ job: { status: "idle" } });
    // Unsaved edits should be in the export. Leaving the folder view's
    // full-screen editor saves and closes it, like its own close button.
    const folderState = useFolderStore.getState();
    if (ui.view === "folders" && folderState.focusOpen) await folderState.closeProblem();
    else await useProblemStore.getState().flushSave();
    ui.setView("export");

    set({
      step: "mode",
      mode: preset?.mode ?? null,
      selected: new Set(),
      focusFolderId: preset?.folderId ?? null,
    });
    await get().loadData();
    const index = get().index;
    if (!preset || !index) return;

    const selected = preset.problemIds
      ? new Set(preset.problemIds.filter((id) => index.problemById.has(id)))
      : presetSelection(preset.mode, index, preset.folderId);
    // With something already chosen, jump straight to the review step; the
    // user can still step back to change it.
    set({ selected, step: selected.size > 0 ? "review" : "pick" });
  },

  closeExport: () => {
    useUiStore.getState().setView(get().returnView);
  },

  chooseMode: (mode) => {
    const index = get().index;
    const keepCurrent = mode === get().mode && get().selected.size > 0;
    get().resetJob();
    set({
      mode,
      step: "pick",
      selected: keepCurrent || !index ? get().selected : presetSelection(mode, index, null),
    });
  },

  goTo: (step) => {
    // Going back to change the selection clears the last result.
    if (step !== "review") get().resetJob();
    set({ step });
  },

  toggle: (id) =>
    set((s) => {
      const selected = new Set(s.selected);
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
      return { selected };
    }),

  selectOnly: (id) => set({ selected: new Set([id]) }),

  setMany: (ids, on) =>
    set((s) => {
      const selected = new Set(s.selected);
      for (const id of ids) {
        if (on) selected.add(id);
        else selected.delete(id);
      }
      return { selected };
    }),

  clearSelection: () => set({ selected: new Set() }),
}));
