import { useEffect, useRef } from "react";
import { useProblemStore } from "@/stores/problemStore";
import { useSettingsStore } from "@/stores/settingsStore";

const AUTOSAVE_DELAY_MS = 2500;

export function useAutosave() {
  const selectedProblem = useProblemStore((s) => s.selectedProblem);
  const isDirty = useProblemStore((s) => s.isDirty);
  const saveDraft = useProblemStore((s) => s.saveDraft);
  const enabled = useSettingsStore((s) => s.autosaveEnabled);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !isDirty) return;

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      void saveDraft();
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [selectedProblem, isDirty, saveDraft, enabled]);
}
