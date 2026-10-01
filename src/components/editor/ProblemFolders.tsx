import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FolderIcon, FolderPlusIcon, PlusIcon, XIcon } from "lucide-react";
import { FolderPickerDialog } from "@/components/folders/FolderPickerDialog";
import { folderPathLabel } from "@/lib/folders";
import { api } from "@/lib/tauri";
import { useFolderStore } from "@/stores/folderStore";
import { useProblemStore } from "@/stores/problemStore";
import { useUiStore } from "@/stores/uiStore";

/** The "Folders" row in the editor: which folders this problem is in, plus add/remove. */
export function ProblemFolders() {
  const problemId = useProblemStore((s) => s.selectedProblem?.id ?? "");
  const isNew = useProblemStore((s) => s.isNew);
  const pendingFolderId = useProblemStore((s) => s.pendingFolderId);

  const folders = useFolderStore((s) => s.folders);
  const loaded = useFolderStore((s) => s.loaded);
  const linksVersion = useFolderStore((s) => s.linksVersion);
  const fetchFolders = useFolderStore((s) => s.fetchFolders);
  const addProblems = useFolderStore((s) => s.addProblems);
  const removeProblem = useFolderStore((s) => s.removeProblem);
  const openFolder = useFolderStore((s) => s.openFolder);
  const setView = useUiStore((s) => s.setView);

  const [folderIds, setFolderIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!loaded) void fetchFolders();
  }, [loaded, fetchFolders]);

  useEffect(() => {
    if (!problemId || isNew) {
      setFolderIds([]);
      return;
    }
    let cancelled = false;
    api.folders
      .folderIdsForProblem(problemId)
      .then((ids) => !cancelled && setFolderIds(ids))
      .catch((err) => console.error("Failed to load problem folders", err));
    return () => {
      cancelled = true;
    };
  }, [problemId, isNew, linksVersion]);

  const chips = useMemo(
    () =>
      folderIds
        .filter((id) => folders.some((f) => f.id === id))
        .map((id) => ({ id, label: folderPathLabel(folders, id) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [folderIds, folders],
  );

  const disabled = useMemo(
    () => new Map(folderIds.map((id) => [id, "Already here"] as const)),
    [folderIds],
  );

  function goToFolders() {
    setView("folders");
    void openFolder(null);
  }

  if (isNew) {
    if (!pendingFolderId) return null;
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="shrink-0">Folders</span>
        <span className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5">
          <FolderIcon className="size-3 text-folder" />
          {folderPathLabel(folders, pendingFolderId)}
        </span>
        <span className="opacity-70">— added when you save</span>
      </div>
    );
  }
  if (!problemId) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <span className="mr-0.5 shrink-0">Folders</span>
      {chips.map((chip) => (
        <span
          key={chip.id}
          className="group flex max-w-64 items-center gap-1 rounded-full border border-border py-0.5 pr-1 pl-2 text-foreground/90"
        >
          <FolderIcon className="size-3 shrink-0 text-folder" />
          <span className="truncate">{chip.label}</span>
          <button
            type="button"
            aria-label={`Remove from ${chip.label}`}
            onClick={() =>
              void removeProblem(chip.id, problemId).catch((err) => toast.error(String(err)))
            }
            className="rounded-full p-0.5 text-muted-foreground hover:bg-hover hover:text-foreground"
          >
            <XIcon className="size-2.5" />
          </button>
        </span>
      ))}

      {folders.length === 0 ? (
        <button
          type="button"
          onClick={goToFolders}
          className="flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 hover:bg-hover hover:text-foreground"
        >
          <FolderPlusIcon className="size-3" />
          Create a folder first
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 hover:bg-hover hover:text-foreground"
        >
          <PlusIcon className="size-3" />
          {chips.length === 0 ? "Add to folder" : "Add"}
        </button>
      )}

      <FolderPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        folders={folders}
        title="Add to folder"
        description="A problem can be in more than one folder."
        confirmLabel="Add here"
        disabled={disabled}
        onPick={async (folderId) => {
          if (!folderId) return;
          try {
            await addProblems(folderId, [problemId]);
            toast.success(`Added to "${folderPathLabel(folders, folderId)}"`);
          } catch (err) {
            toast.error(String(err));
            throw err;
          }
        }}
      />
    </div>
  );
}
