import { create } from "zustand";
import { api } from "@/lib/tauri";
import {
  EMPTY_PROBLEM_FORM,
  type Problem,
  type ProblemFilters,
  type ProblemFormData,
  type ProblemSummary,
} from "@/types/problem";

export type SaveResult = "saved" | "noop" | "error";

interface ProblemState {
  problems: ProblemSummary[];
  isLoading: boolean;
  filters: ProblemFilters;
  selectedId: string | null;
  selectedProblem: Problem | null;
  isNew: boolean;
  isDirty: boolean;
  isSaving: boolean;

  fetchProblems: () => Promise<void>;
  setFilters: (filters: ProblemFilters) => Promise<void>;
  selectProblem: (id: string) => Promise<void>;
  newProblem: () => Promise<void>;
  updateDraft: (patch: Partial<ProblemFormData>) => void;
  saveDraft: () => Promise<SaveResult>;
  flushSave: () => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  deleteProblem: (id: string) => Promise<void>;
  restoreProblem: (id: string) => Promise<void>;
  duplicateProblem: (id: string) => Promise<void>;
  clearSelection: () => void;
}

function toDraft(problem: Problem): ProblemFormData {
  const { id: _id, isDeleted: _isDeleted, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = problem;
  return rest;
}

export const useProblemStore = create<ProblemState>((set, get) => ({
  problems: [],
  isLoading: false,
  filters: {},
  selectedId: null,
  selectedProblem: null,
  isNew: false,
  isDirty: false,
  isSaving: false,

  fetchProblems: async () => {
    set({ isLoading: true });
    try {
      const filters = get().filters;
      const hasFilters = Object.values(filters).some(
        (v) => v !== undefined && v !== "" && v !== false,
      );
      const problems = hasFilters
        ? await api.problems.filter(filters)
        : await api.problems.list();
      set({ problems, isLoading: false });
    } catch (err) {
      console.error("Failed to fetch problems", err);
      set({ isLoading: false });
    }
  },

  setFilters: async (filters) => {
    set({ filters });
    await get().fetchProblems();
  },

  selectProblem: async (id) => {
    // Persist any pending edits before we replace the current draft, so
    // switching problems never silently drops unsaved changes.
    await get().flushSave();
    if (get().selectedId === id) return;
    const problem = await api.problems.get(id);
    if (problem) {
      set({
        selectedId: id,
        selectedProblem: problem,
        isNew: false,
        isDirty: false,
      });
    }
  },

  newProblem: async () => {
    await get().flushSave();
    const draft: Problem = {
      id: "",
      isDeleted: false,
      createdAt: "",
      updatedAt: "",
      ...EMPTY_PROBLEM_FORM,
    };
    set({ selectedId: null, selectedProblem: draft, isNew: true, isDirty: false });
  },

  updateDraft: (patch) => {
    const current = get().selectedProblem;
    if (!current) return;
    set({ selectedProblem: { ...current, ...patch }, isDirty: true });
  },

  saveDraft: async () => {
    const { selectedProblem, isNew, isDirty, isSaving } = get();
    if (!selectedProblem || !isDirty || isSaving) return "noop";
    if (!selectedProblem.problemName.trim()) return "noop";

    // Snapshot exactly what we're persisting. If the user keeps typing while
    // the request is in flight, `selectedProblem` becomes a new object and we
    // must NOT clobber those keystrokes with the server response.
    const snapshot = selectedProblem;
    set({ isSaving: true });
    try {
      const draft = toDraft(snapshot);
      const saved = isNew
        ? await api.problems.create(draft)
        : await api.problems.update({ id: snapshot.id, ...draft });

      const current = get().selectedProblem;
      const editedDuringSave = current !== null && current !== snapshot;

      set({
        // Keep the user's in-flight edits, but adopt the server-assigned
        // identity/timestamps so the next save updates the right row.
        selectedProblem: editedDuringSave
          ? {
              ...current,
              id: saved.id,
              isDeleted: saved.isDeleted,
              createdAt: saved.createdAt,
              updatedAt: saved.updatedAt,
            }
          : saved,
        selectedId: saved.id,
        isNew: false,
        isDirty: editedDuringSave,
        isSaving: false,
      });
      await get().fetchProblems();
      return "saved";
    } catch (err) {
      console.error("Failed to save problem", err);
      set({ isSaving: false });
      return "error";
    }
  },

  // Drains all pending work: waits out any in-flight save, then keeps saving
  // until nothing is dirty. Used before switching problems and on app close so
  // nothing is ever lost. Bounded so a persistent failure can't hang forever.
  flushSave: async () => {
    for (let i = 0; i < 50; i++) {
      const state = get();
      if (state.isSaving) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        continue;
      }
      if (!state.isDirty) return;
      const result = await state.saveDraft();
      if (result !== "saved") return;
    }
  },

  toggleFavorite: async (id) => {
    const updated = await api.problems.toggleFavorite(id);
    if (get().selectedId === id) {
      set({ selectedProblem: updated });
    }
    await get().fetchProblems();
  },

  deleteProblem: async (id) => {
    await api.problems.softDelete(id);
    if (get().selectedId === id) {
      get().clearSelection();
    }
    await get().fetchProblems();
  },

  restoreProblem: async (id) => {
    await api.problems.restore(id);
    await get().fetchProblems();
  },

  duplicateProblem: async (id) => {
    await get().flushSave();
    const copy = await api.problems.duplicate(id);
    await get().fetchProblems();
    set({ selectedId: copy.id, selectedProblem: copy, isNew: false, isDirty: false });
  },

  clearSelection: () => {
    set({ selectedId: null, selectedProblem: null, isNew: false, isDirty: false });
  },
}));
