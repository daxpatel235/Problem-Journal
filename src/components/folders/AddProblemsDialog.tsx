import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useFolderStore } from "@/stores/folderStore";
import type { Folder } from "@/types/folder";
import type { ProblemSummary } from "@/types/problem";

const DIFFICULTY_COLOR: Record<string, string> = {
  Easy: "text-success",
  Medium: "text-warning",
  Hard: "text-destructive",
};

interface AddProblemsDialogProps {
  folder: Folder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Pick any number of existing problems (from all of them) to put in a folder. */
export function AddProblemsDialog({ folder, open, onOpenChange }: AddProblemsDialogProps) {
  const addProblems = useFolderStore((s) => s.addProblems);

  const [all, setAll] = useState<ProblemSummary[]>([]);
  const [alreadyIn, setAlreadyIn] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !folder) return;
    setPicked(new Set());
    setQuery("");
    setLoading(true);
    let cancelled = false;
    void Promise.all([api.problems.list(), api.folders.listProblems(folder.id)])
      .then(([problems, inFolder]) => {
        if (cancelled) return;
        setAll(
          [...problems].sort((a, b) =>
            a.problemName.localeCompare(b.problemName, undefined, { sensitivity: "base" }),
          ),
        );
        setAlreadyIn(new Set(inFolder.map((p) => p.id)));
      })
      .catch((err) => {
        console.error("Failed to load problems", err);
        toast.error("Couldn't load your problems.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, folder]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (p) =>
        p.problemName.toLowerCase().includes(q) ||
        p.topic.toLowerCase().includes(q) ||
        p.patternCategory.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [all, query]);

  const selectable = visible.filter((p) => !alreadyIn.has(p.id));
  const allVisiblePicked = selectable.length > 0 && selectable.every((p) => picked.has(p.id));

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setPicked((prev) => {
      const next = new Set(prev);
      if (allVisiblePicked) for (const p of selectable) next.delete(p.id);
      else for (const p of selectable) next.add(p.id);
      return next;
    });
  }

  async function handleAdd() {
    if (!folder || picked.size === 0) return;
    setBusy(true);
    try {
      const added = await addProblems(folder.id, [...picked]);
      toast.success(`Added ${added} problem${added === 1 ? "" : "s"} to "${folder.name}"`);
      onOpenChange(false);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add problems to "{folder?.name}"</DialogTitle>
          <DialogDescription>
            Pick from all your problems. A problem can be in more than one folder.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, topic, pattern or tag…"
              className="h-8 bg-input/30 pl-7 text-sm"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={selectable.length === 0}
            onClick={toggleAllVisible}
          >
            {allVisiblePicked ? "Clear" : "Select all"}
          </Button>
        </div>

        <div className="flex max-h-80 min-h-40 flex-col overflow-y-auto rounded-md border border-border p-1">
          {loading ? (
            <p className="p-3 text-sm text-muted-foreground">Loading…</p>
          ) : all.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">
              You haven't logged any problems yet. Use "New Problem" to create one.
            </p>
          ) : visible.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No problems match "{query}".</p>
          ) : (
            visible.map((p) => {
              const here = alreadyIn.has(p.id);
              const checked = here || picked.has(p.id);
              return (
                <button
                  type="button"
                  key={p.id}
                  role="checkbox"
                  aria-checked={checked}
                  disabled={here}
                  onClick={() => toggle(p.id)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    here ? "cursor-not-allowed opacity-60" : "hover:bg-hover",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input dark:bg-input/30",
                    )}
                  >
                    {checked && <CheckIcon className="size-3" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {p.problemName || "Untitled problem"}
                    </span>
                    <span className="flex gap-1.5 text-xs text-muted-foreground">
                      <span className={DIFFICULTY_COLOR[p.difficulty]}>{p.difficulty}</span>
                      {p.topic && (
                        <>
                          <span className="opacity-40">&middot;</span>
                          <span className="truncate">{p.topic}</span>
                        </>
                      )}
                    </span>
                  </span>
                  {here && (
                    <span className="shrink-0 text-[11px] text-muted-foreground">Already here</span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={picked.size === 0 || busy} onClick={() => void handleAdd()}>
            {picked.size === 0
              ? "Add problems"
              : `Add ${picked.size} problem${picked.size === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
