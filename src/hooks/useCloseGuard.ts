import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useProblemStore } from "@/stores/problemStore";

/**
 * Guarantees no edits are lost when the window is closed. When a close is
 * requested with unsaved (or still-saving) work, we hold the close, drain every
 * pending save into the database, then destroy the window. This is the rare
 * last-resort net for the gap between your last keystroke and the debounced
 * autosave — under normal use everything is already saved by the time you quit.
 */
export function useCloseGuard() {
  useEffect(() => {
    const appWindow = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    let closing = false;

    void appWindow
      .onCloseRequested(async (event) => {
        if (closing) return;
        const { isDirty, isSaving } = useProblemStore.getState();
        if (!isDirty && !isSaving) return; // nothing pending — let it close

        event.preventDefault();
        closing = true;
        try {
          await useProblemStore.getState().flushSave();
        } finally {
          await appWindow.destroy();
        }
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => unlisten?.();
  }, []);
}
