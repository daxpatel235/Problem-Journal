import { useEffect } from "react";
import { useProblemStore } from "@/stores/problemStore";
import { useFolderStore } from "@/stores/folderStore";
import { useUiStore } from "@/stores/uiStore";
import { useZoom } from "@/hooks/useZoom";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function useKeyboardShortcuts() {
  const newProblem = useProblemStore((s) => s.newProblem);
  const saveDraft = useProblemStore((s) => s.saveDraft);
  const selectedId = useProblemStore((s) => s.selectedId);
  const duplicateProblem = useProblemStore((s) => s.duplicateProblem);
  const deleteProblem = useProblemStore((s) => s.deleteProblem);
  const openSearch = useUiStore((s) => s.openSearch);
  const openCommand = useUiStore((s) => s.openCommand);
  const requestConfirm = useUiStore((s) => s.requestConfirm);
  const { zoomIn, zoomOut, resetZoom } = useZoom();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const mod = event.ctrlKey || event.metaKey;
      const inFolders = useUiStore.getState().view === "folders";
      const folderState = useFolderStore.getState();
      // In the folder view the editor is only on screen while a problem is
      // open full screen; editor shortcuts must not act on a hidden problem.
      const editorVisible = !inFolders || folderState.focusOpen;

      if (!mod) {
        const isBack =
          (event.altKey && event.key === "ArrowLeft") ||
          (event.key === "Backspace" && !event.altKey && !isEditableTarget(event.target));
        if (inFolders && isBack && !document.querySelector('[data-slot="dialog-content"]')) {
          event.preventDefault();
          if (folderState.focusOpen) void folderState.closeProblem();
          else void folderState.goUp();
          return;
        }
        if (
          event.key === "Delete" &&
          selectedId &&
          editorVisible &&
          !isEditableTarget(event.target)
        ) {
          event.preventDefault();
          requestConfirm({
            title: "Move problem to trash?",
            description: "You can restore it later from Settings.",
            confirmLabel: "Move to Trash",
            destructive: true,
            onConfirm: () => void deleteProblem(selectedId),
          });
        }
        return;
      }

      switch (event.key) {
        case "n":
        case "N":
          event.preventDefault();
          // Inside a folder, a new problem is filed into that folder.
          if (inFolders && folderState.currentFolderId) void folderState.newProblemHere();
          else void newProblem();
          break;
        case "s":
        case "S":
          event.preventDefault();
          void saveDraft();
          break;
        case "f":
        case "F":
          event.preventDefault();
          openSearch();
          break;
        case "k":
        case "K":
          event.preventDefault();
          openCommand();
          break;
        case "d":
        case "D":
          event.preventDefault();
          if (selectedId && editorVisible) void duplicateProblem(selectedId);
          break;
        case "+":
        case "=":
          event.preventDefault();
          zoomIn();
          break;
        case "-":
        case "_":
          event.preventDefault();
          zoomOut();
          break;
        case "0":
          event.preventDefault();
          resetZoom();
          break;
        default:
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    newProblem,
    saveDraft,
    selectedId,
    duplicateProblem,
    deleteProblem,
    openSearch,
    openCommand,
    requestConfirm,
    zoomIn,
    zoomOut,
    resetZoom,
  ]);
}
