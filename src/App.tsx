import { useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Toaster } from "@/components/ui/sonner";
import { useAutosave } from "@/hooks/useAutosave";
import { useCloseGuard } from "@/hooks/useCloseGuard";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useTheme } from "@/hooks/useTheme";
import { useZoom } from "@/hooks/useZoom";
import { useProblemStore } from "@/stores/problemStore";
import { useSettingsStore } from "@/stores/settingsStore";

function App() {
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const lastOpenedProblemId = useSettingsStore((s) => s.lastOpenedProblemId);
  const selectedId = useProblemStore((s) => s.selectedId);
  const selectProblem = useProblemStore((s) => s.selectProblem);
  const setLastOpenedProblemId = useSettingsStore((s) => s.setLastOpenedProblemId);

  useTheme();
  useZoom();
  useAutosave();
  useCloseGuard();
  useKeyboardShortcuts();

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    // Re-open the problem you had open last time, so the app comes back exactly
    // where you left it. Only fires when it's actually a different problem, so
    // it never reloads (and discards edits to) the one already on screen.
    if (lastOpenedProblemId && lastOpenedProblemId !== selectedId) {
      void selectProblem(lastOpenedProblemId);
    }
  }, [lastOpenedProblemId, selectedId, selectProblem]);

  useEffect(() => {
    if (selectedId) setLastOpenedProblemId(selectedId);
  }, [selectedId, setLastOpenedProblemId]);

  return (
    <>
      <AppLayout />
      <Toaster />
    </>
  );
}

export default App;
