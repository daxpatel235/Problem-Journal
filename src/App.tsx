import { useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Toaster } from "@/components/ui/sonner";
import { useAutosave } from "@/hooks/useAutosave";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useZoom } from "@/hooks/useZoom";
import { useProblemStore } from "@/stores/problemStore";
import { useSettingsStore } from "@/stores/settingsStore";

function App() {
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const lastOpenedProblemId = useSettingsStore((s) => s.lastOpenedProblemId);
  const selectedId = useProblemStore((s) => s.selectedId);
  const selectProblem = useProblemStore((s) => s.selectProblem);
  const setLastOpenedProblemId = useSettingsStore((s) => s.setLastOpenedProblemId);

  useZoom();
  useAutosave();
  useKeyboardShortcuts();

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (lastOpenedProblemId) {
      void selectProblem(lastOpenedProblemId);
    }
    // Runs once when settings finish loading and supply the last-opened id.
  }, [lastOpenedProblemId, selectProblem]);

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
