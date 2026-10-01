import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  FileCodeIcon,
  FilePlusIcon,
  FolderIcon,
  FolderInputIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  FolderSymlinkIcon,
  HomeIcon,
  ListPlusIcon,
  MoreHorizontalIcon,
  PencilIcon,
  SearchIcon,
  SearchXIcon,
  StarIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { AddProblemsDialog } from "@/components/folders/AddProblemsDialog";
import { FolderPickerDialog } from "@/components/folders/FolderPickerDialog";
import { childFolders, folderContentsLabel, folderPath, folderSubtreeIds } from "@/lib/folders";
import { api } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useFolderStore } from "@/stores/folderStore";
import { useProblemStore } from "@/stores/problemStore";
import { useUiStore } from "@/stores/uiStore";
import type { Folder } from "@/types/folder";
import type { ProblemSummary } from "@/types/problem";

const DIFFICULTY_COLOR: Record<string, string> = {
  Easy: "text-success",
  Medium: "text-warning",
  Hard: "text-destructive",
};

/** Rows drawn at first; more are added as you scroll, so huge folders open instantly. */
const PAGE_SIZE = 150;

const ROW_GRID = "grid grid-cols-[minmax(0,1fr)_minmax(0,220px)_110px_32px] items-center gap-3";

function formatDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

function errorMessage(err: unknown): string {
  return typeof err === "string" ? err : err instanceof Error ? err.message : String(err);
}

/** Inline text box used for both "new folder" and "rename". */
function NameInput({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: string;
  onSubmit: (name: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const busy = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    // Wait a frame: when opened from a menu, the menu hands focus back to its
    // trigger as it closes, which would otherwise steal it from this box.
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function submit() {
    if (busy.current) return;
    const name = value.trim();
    if (!name || name === initial) {
      onCancel();
      return;
    }
    busy.current = true;
    const ok = await onSubmit(name);
    busy.current = false;
    if (!ok) inputRef.current?.focus();
  }

  return (
    <Input
      ref={inputRef}
      value={value}
      maxLength={100}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          void submit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
      onBlur={() => {
        // A blur right after mounting is the closing menu grabbing focus back.
        if (Date.now() - mountedAt.current < 400) {
          window.setTimeout(() => inputRef.current?.focus(), 0);
          return;
        }
        void submit();
      }}
      placeholder="Folder name"
      className="h-7 bg-input/30 text-sm"
    />
  );
}

type PickerState =
  | { kind: "move-folder"; folder: Folder }
  | { kind: "add-problem"; problem: ProblemSummary; inFolders: string[] }
  | { kind: "move-problem"; problem: ProblemSummary; inFolders: string[] };

export function FolderExplorer() {
  const folders = useFolderStore((s) => s.folders);
  const loaded = useFolderStore((s) => s.loaded);
  const currentFolderId = useFolderStore((s) => s.currentFolderId);
  const folderProblems = useFolderStore((s) => s.folderProblems);
  const refresh = useFolderStore((s) => s.refresh);
  const openFolder = useFolderStore((s) => s.openFolder);
  const goUp = useFolderStore((s) => s.goUp);
  const createFolder = useFolderStore((s) => s.createFolder);
  const renameFolder = useFolderStore((s) => s.renameFolder);
  const moveFolder = useFolderStore((s) => s.moveFolder);
  const deleteFolder = useFolderStore((s) => s.deleteFolder);
  const addProblems = useFolderStore((s) => s.addProblems);
  const removeProblem = useFolderStore((s) => s.removeProblem);
  const moveProblem = useFolderStore((s) => s.moveProblem);
  const openProblem = useFolderStore((s) => s.openProblem);
  const newProblemHere = useFolderStore((s) => s.newProblemHere);

  // Every save / trash / restore re-fetches the problem list; use that as the
  // signal to re-read folder contents so names and counts stay current.
  const allProblems = useProblemStore((s) => s.problems);
  const deleteProblem = useProblemStore((s) => s.deleteProblem);
  const requestConfirm = useUiStore((s) => s.requestConfirm);

  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void refresh();
  }, [allProblems, refresh]);

  // Leaving a folder resets the transient UI.
  useEffect(() => {
    setCreating(false);
    setRenamingId(null);
    setFilter("");
  }, [currentFolderId]);

  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [currentFolderId, filter]);

  const current = folders.find((f) => f.id === currentFolderId) ?? null;
  const path = useMemo(() => folderPath(folders, currentFolderId), [folders, currentFolderId]);
  const subfolders = useMemo(
    () => childFolders(folders, currentFolderId),
    [folders, currentFolderId],
  );

  const q = filter.trim().toLowerCase();
  const shownFolders = q ? subfolders.filter((f) => f.name.toLowerCase().includes(q)) : subfolders;
  const shownProblems = q
    ? folderProblems.filter(
        (p) =>
          p.problemName.toLowerCase().includes(q) ||
          p.topic.toLowerCase().includes(q) ||
          p.patternCategory.toLowerCase().includes(q),
      )
    : folderProblems;

  const visibleProblems = shownProblems.slice(0, limit);
  const hasMore = shownProblems.length > visibleProblems.length;

  // Draw the next page of rows when the end of the list scrolls into view.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setLimit((l) => l + PAGE_SIZE);
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, limit]);

  const isEmpty = subfolders.length === 0 && folderProblems.length === 0;
  const noFoldersAtAll = loaded && folders.length === 0;

  async function handleCreate(name: string): Promise<boolean> {
    try {
      await createFolder(name, currentFolderId);
      setCreating(false);
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    }
  }

  async function handleRename(id: string, name: string): Promise<boolean> {
    try {
      await renameFolder(id, name);
      setRenamingId(null);
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    }
  }

  function confirmDeleteFolder(folder: Folder) {
    const nested = folderSubtreeIds(folders, folder.id).size - 1;
    requestConfirm({
      title: `Delete folder "${folder.name}"?`,
      description:
        (nested > 0
          ? `Its ${nested} subfolder${nested === 1 ? "" : "s"} will be deleted too. `
          : "") + "The problems inside are NOT deleted — they stay in All Problems.",
      confirmLabel: "Delete Folder",
      destructive: true,
      onConfirm: () => {
        deleteFolder(folder.id)
          .then(() => toast.success(`Deleted "${folder.name}"`))
          .catch((err) => toast.error(errorMessage(err)));
      },
    });
  }

  function confirmTrashProblem(problem: ProblemSummary) {
    requestConfirm({
      title: `Move "${problem.problemName || "this problem"}" to trash?`,
      description: "It's removed from every folder until you restore it from Trash.",
      confirmLabel: "Move to Trash",
      destructive: true,
      onConfirm: () => void deleteProblem(problem.id),
    });
  }

  async function openProblemPicker(kind: "add-problem" | "move-problem", problem: ProblemSummary) {
    try {
      const inFolders = await api.folders.folderIdsForProblem(problem.id);
      setPicker({ kind, problem, inFolders });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function handleRemoveFromFolder(problem: ProblemSummary) {
    if (!current) return;
    try {
      await removeProblem(current.id, problem.id);
      toast(`Removed from "${current.name}"`, {
        action: {
          label: "Undo",
          onClick: () => void addProblems(current.id, [problem.id]),
        },
      });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  // ---- picker wiring -------------------------------------------------------
  const pickerDisabled = useMemo(() => {
    const map = new Map<string, string>();
    if (!picker) return map;
    if (picker.kind === "move-folder") {
      for (const id of folderSubtreeIds(folders, picker.folder.id))
        map.set(id, "Inside this folder");
      map.set(picker.folder.id, "This folder");
      if (picker.folder.parentId) map.set(picker.folder.parentId, "Current location");
    } else {
      for (const id of picker.inFolders) map.set(id, "Already here");
      if (picker.kind === "move-problem" && currentFolderId)
        map.set(currentFolderId, "Current folder");
    }
    return map;
  }, [picker, folders, currentFolderId]);

  async function handlePick(target: string | null) {
    if (!picker) return;
    try {
      if (picker.kind === "move-folder") {
        await moveFolder(picker.folder.id, target);
        toast.success(`Moved "${picker.folder.name}"`);
      } else if (target) {
        const targetName = folders.find((f) => f.id === target)?.name ?? "folder";
        if (picker.kind === "add-problem") {
          await addProblems(target, [picker.problem.id]);
          toast.success(`Also added to "${targetName}"`);
        } else if (currentFolderId) {
          await moveProblem(picker.problem.id, currentFolderId, target);
          toast.success(`Moved to "${targetName}"`);
        }
      }
    } catch (err) {
      toast.error(errorMessage(err));
      throw err;
    }
  }

  const pickerTitle =
    picker?.kind === "move-folder"
      ? `Move folder "${picker.folder.name}"`
      : picker?.kind === "add-problem"
        ? `Add "${picker.problem.problemName}" to another folder`
        : picker
          ? `Move "${picker.problem.problemName}"`
          : "";

  // ---- render --------------------------------------------------------------
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* Toolbar: back, breadcrumb, actions */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Back"
          title="Back (Alt+←)"
          disabled={!currentFolderId}
          onClick={() => void goUp()}
        >
          <ArrowLeftIcon className="size-4" />
        </Button>

        <nav aria-label="Folder path" className="flex min-w-0 flex-1 items-center gap-0.5 text-sm">
          <button
            type="button"
            onClick={() => void openFolder(null)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded px-1.5 py-0.5 hover:bg-hover",
              currentFolderId ? "text-muted-foreground" : "font-medium text-foreground",
            )}
          >
            <HomeIcon className="size-3.5" />
            Folders
          </button>
          {path.map((f, i) => (
            <span key={f.id} className="flex min-w-0 items-center gap-0.5">
              <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground/60" />
              <button
                type="button"
                onClick={() => void openFolder(f.id)}
                className={cn(
                  "truncate rounded px-1.5 py-0.5 hover:bg-hover",
                  i === path.length - 1 ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {f.name}
              </button>
            </span>
          ))}
        </nav>

        {!noFoldersAtAll && (
          <div className="relative w-48 shrink-0">
            <SearchIcon className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={current ? `Search in ${current.name}…` : "Search folders…"}
              className="h-7 bg-input/30 pl-7 text-xs"
            />
          </div>
        )}

        <Button
          type="button"
          size="sm"
          variant={current ? "outline" : "default"}
          className="gap-1"
          onClick={() => {
            setFilter("");
            setCreating(true);
          }}
        >
          <FolderPlusIcon className="size-3.5" />
          New Folder
        </Button>
        {current && (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => void newProblemHere()}
            >
              <FilePlusIcon className="size-3.5" />
              New Problem
            </Button>
            <Button type="button" size="sm" className="gap-1" onClick={() => setAddOpen(true)}>
              <ListPlusIcon className="size-3.5" />
              Add Problems
            </Button>
          </>
        )}
      </div>

      {/* Title */}
      <div className="flex items-end justify-between gap-4 px-5 pt-5 pb-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 truncate text-lg font-semibold">
            {current ? (
              <FolderOpenIcon className="size-5 shrink-0 text-folder" />
            ) : (
              <HomeIcon className="size-5 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">{current ? current.name : "Folders"}</span>
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {current
              ? folderContentsLabel(folders, current)
              : noFoldersAtAll
                ? "Organize your problems into folders, like Arrays or Graphs."
                : `${subfolders.length} folder${subfolders.length === 1 ? "" : "s"} · open one to add problems`}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-6">
        {noFoldersAtAll && !creating ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <div className="flex size-14 items-center justify-center rounded-xl bg-hover">
              <FolderIcon className="size-7 text-folder" />
            </div>
            <p className="text-sm font-medium text-foreground">No folders yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Create a folder first — name it anything (Arrays, Graphs, "Revise before interview"…).
              Then open it and add problems from all your problems.
            </p>
            <Button type="button" size="sm" className="gap-1" onClick={() => setCreating(true)}>
              <FolderPlusIcon className="size-3.5" />
              Create your first folder
            </Button>
          </div>
        ) : (
          <>
            {/* Column headers */}
            {(!isEmpty || creating) && (
              <div
                className={cn(
                  ROW_GRID,
                  "border-b border-border px-2.5 pb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase",
                )}
              >
                <span>Name</span>
                <span>Details</span>
                <span>Updated</span>
                <span />
              </div>
            )}

            <div className="flex flex-col py-1">
              {creating && (
                <div className={cn(ROW_GRID, "rounded-md bg-hover/60 px-2.5 py-1.5")}>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <FolderIcon className="size-4 shrink-0 text-folder" />
                    <NameInput
                      initial=""
                      onSubmit={handleCreate}
                      onCancel={() => setCreating(false)}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Enter to create · Esc to cancel
                  </span>
                  <span />
                  <span />
                </div>
              )}

              {shownFolders.map((folder) => (
                <div
                  key={folder.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open folder ${folder.name}`}
                  onClick={() => renamingId !== folder.id && void openFolder(folder.id)}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === "Enter") void openFolder(folder.id);
                    if (e.key === "F2") setRenamingId(folder.id);
                  }}
                  className={cn(
                    ROW_GRID,
                    "group cursor-pointer rounded-md px-2.5 py-1.5 transition-colors hover:bg-hover focus-visible:bg-hover focus-visible:outline-none",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <FolderIcon
                      className="size-4 shrink-0 text-folder"
                      fill="currentColor"
                      fillOpacity={0.25}
                    />
                    {renamingId === folder.id ? (
                      <NameInput
                        initial={folder.name}
                        onSubmit={(name) => handleRename(folder.id, name)}
                        onCancel={() => setRenamingId(null)}
                      />
                    ) : (
                      <span className="truncate text-sm">{folder.name}</span>
                    )}
                  </div>
                  <span className="truncate text-xs text-muted-foreground">
                    {folderContentsLabel(folders, folder)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(folder.updatedAt)}
                  </span>
                  <RowMenu label={`Actions for ${folder.name}`}>
                    <DropdownMenuItem onClick={() => void openFolder(folder.id)}>
                      <FolderOpenIcon /> Open
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setRenamingId(folder.id)}>
                      <PencilIcon /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setPicker({ kind: "move-folder", folder })}>
                      <FolderInputIcon /> Move to…
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => confirmDeleteFolder(folder)}
                    >
                      <Trash2Icon /> Delete folder
                    </DropdownMenuItem>
                  </RowMenu>
                </div>
              ))}

              {visibleProblems.map((problem) => (
                <div
                  key={problem.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${problem.problemName || "Untitled problem"}`}
                  onClick={() => void openProblem(problem.id)}
                  onKeyDown={(e) => {
                    if (e.target === e.currentTarget && e.key === "Enter")
                      void openProblem(problem.id);
                  }}
                  className={cn(
                    ROW_GRID,
                    "group cursor-pointer rounded-md px-2.5 py-1.5 transition-colors hover:bg-hover focus-visible:bg-hover focus-visible:outline-none",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <FileCodeIcon className="size-4 shrink-0 text-primary" />
                    <span className="truncate text-sm">
                      {problem.problemName || "Untitled problem"}
                    </span>
                    {problem.favorite && (
                      <StarIcon className="size-3 shrink-0 text-warning" fill="currentColor" />
                    )}
                  </div>
                  <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      className={cn("shrink-0 font-medium", DIFFICULTY_COLOR[problem.difficulty])}
                    >
                      {problem.difficulty}
                    </span>
                    {problem.topic && (
                      <>
                        <span className="shrink-0 opacity-40">&middot;</span>
                        <span className="truncate">{problem.topic}</span>
                      </>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(problem.updatedAt)}
                  </span>
                  <RowMenu label={`Actions for ${problem.problemName}`}>
                    <DropdownMenuItem onClick={() => void openProblem(problem.id)}>
                      <FileCodeIcon /> Open
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => void openProblemPicker("add-problem", problem)}
                    >
                      <FolderSymlinkIcon /> Add to another folder…
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => void openProblemPicker("move-problem", problem)}
                    >
                      <FolderInputIcon /> Move to…
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void handleRemoveFromFolder(problem)}>
                      <XIcon /> Remove from this folder
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => confirmTrashProblem(problem)}
                    >
                      <Trash2Icon /> Move to Trash
                    </DropdownMenuItem>
                  </RowMenu>
                </div>
              ))}
            </div>

            {hasMore && (
              <div ref={sentinelRef} className="p-3 text-center text-xs text-muted-foreground">
                Showing {visibleProblems.length} of {shownProblems.length}…
              </div>
            )}

            {/* Empty / no-match states */}
            {!creating && current && isEmpty && (
              <div className="flex flex-col items-center gap-3 p-10 text-center">
                <FolderOpenIcon className="size-8 text-folder opacity-70" />
                <p className="text-sm font-medium">This folder is empty</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Add problems you've already logged, start a new one here, or make a subfolder.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1"
                    onClick={() => setAddOpen(true)}
                  >
                    <ListPlusIcon className="size-3.5" />
                    Add Problems
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => void newProblemHere()}
                  >
                    <FilePlusIcon className="size-3.5" />
                    New Problem
                  </Button>
                </div>
              </div>
            )}
            {q && !isEmpty && shownFolders.length === 0 && shownProblems.length === 0 && (
              <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
                <SearchXIcon className="size-6 opacity-60" />
                Nothing here matches "{filter}".
              </div>
            )}
          </>
        )}
      </div>

      <AddProblemsDialog folder={current} open={addOpen} onOpenChange={setAddOpen} />
      <FolderPickerDialog
        open={picker !== null}
        onOpenChange={(open) => !open && setPicker(null)}
        folders={folders}
        title={pickerTitle}
        description={
          picker?.kind === "add-problem"
            ? "It stays in this folder too."
            : picker?.kind === "move-problem"
              ? "It's taken out of this folder and put in the one you pick."
              : "Pick where this folder should go."
        }
        confirmLabel={picker?.kind === "add-problem" ? "Add here" : "Move here"}
        disabled={pickerDisabled}
        allowRoot={picker?.kind === "move-folder"}
        rootDisabledReason={
          picker?.kind === "move-folder" && !picker.folder.parentId ? "Current location" : undefined
        }
        onPick={handlePick}
      />
    </div>
  );
}

/**
 * The "⋯" menu on each row. Rows can number in the thousands, so the real menu
 * is only created the first time it's clicked; until then it's a plain button.
 */
function RowMenu({ label, children }: { label: string; children: ReactNode }) {
  const [armed, setArmed] = useState(false);
  const [open, setOpen] = useState(false);
  const buttonClass =
    "opacity-40 group-hover:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100";

  return (
    <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {armed ? (
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={label}
                className={buttonClass}
              >
                <MoreHorizontalIcon className="size-3.5" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-52">
            {children}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={label}
          aria-haspopup="menu"
          className={buttonClass}
          onClick={() => {
            setArmed(true);
            setOpen(true);
          }}
        >
          <MoreHorizontalIcon className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
