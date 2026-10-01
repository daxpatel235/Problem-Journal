import { ArrowLeftIcon, ChevronRightIcon, FolderIcon, HomeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditorPanel } from "@/components/editor/EditorPanel";
import { folderPath } from "@/lib/folders";
import { useFolderStore } from "@/stores/folderStore";
import { useProblemStore } from "@/stores/problemStore";

/**
 * A single problem opened from a folder, filling the whole main area. The
 * back arrow returns to the folder it was opened from.
 */
export function FocusedProblemView() {
  const folders = useFolderStore((s) => s.folders);
  const currentFolderId = useFolderStore((s) => s.currentFolderId);
  const closeProblem = useFolderStore((s) => s.closeProblem);
  const openFolder = useFolderStore((s) => s.openFolder);
  const setFocusOpen = useFolderStore((s) => s.setFocusOpen);
  const flushSave = useProblemStore((s) => s.flushSave);
  const problem = useProblemStore((s) => s.selectedProblem);

  const path = folderPath(folders, currentFolderId);
  const backLabel = path.length > 0 ? `Back to ${path[path.length - 1].name}` : "Back to Folders";

  async function jumpTo(folderId: string | null) {
    await flushSave();
    setFocusOpen(false);
    await openFolder(folderId);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5"
          title={`${backLabel} (Alt+←)`}
          onClick={() => void closeProblem()}
        >
          <ArrowLeftIcon className="size-4" />
          <span className="max-w-48 truncate">{backLabel}</span>
        </Button>

        <nav
          aria-label="Location"
          className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden text-xs text-muted-foreground"
        >
          <button
            type="button"
            onClick={() => void jumpTo(null)}
            className="flex shrink-0 items-center gap-1 rounded px-1 py-0.5 hover:bg-hover hover:text-foreground"
          >
            <HomeIcon className="size-3" />
            Folders
          </button>
          {path.map((f) => (
            <span key={f.id} className="flex min-w-0 shrink items-center gap-0.5">
              <ChevronRightIcon className="size-3 shrink-0 opacity-60" />
              <button
                type="button"
                onClick={() => void jumpTo(f.id)}
                className="flex min-w-0 items-center gap-1 rounded px-1 py-0.5 hover:bg-hover hover:text-foreground"
              >
                <FolderIcon className="size-3 shrink-0 text-folder" />
                <span className="truncate">{f.name}</span>
              </button>
            </span>
          ))}
          <ChevronRightIcon className="size-3 shrink-0 opacity-60" />
          <span className="truncate font-medium text-foreground">
            {problem?.problemName.trim() || "Untitled problem"}
          </span>
        </nav>
      </div>

      <EditorPanel />
    </div>
  );
}
