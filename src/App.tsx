import { useEffect, useRef } from "react";
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
  const settingsLoaded = useSettingsStore((s) => s.loaded);
  const lastOpenedProblemId = useSettingsStore((s) => s.lastOpenedProblemId);
  const selectedId = useProblemStore((s) => s.selectedId);
  const selectProblem = useProblemStore((s) => s.selectProblem);
  const setLastOpenedProblemId = useSettingsStore((s) => s.setLastOpenedProblemId);
  const restoredRef = useRef(false);

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
    // where you left it. Startup-only: once the app is running, what's open is
    // whatever the user chose — a blank "New" entry, or nothing after a delete —
    // and re-running this would yank the previous problem back onto the screen.
    if (!settingsLoaded || restoredRef.current) return;
    restoredRef.current = true;
    // Settings load async, so the user may already have opened (or started) a
    // problem by now. Theirs wins.
    if (useProblemStore.getState().selectedProblem) return;
    if (lastOpenedProblemId) void selectProblem(lastOpenedProblemId);
  }, [settingsLoaded, lastOpenedProblemId, selectProblem]);

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
