import { useEffect, useMemo, useState } from "react";
import { ChevronRightIcon, FolderIcon, FolderOpenIcon, HomeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { childFolders } from "@/lib/folders";
import { cn } from "@/lib/utils";
import type { Folder } from "@/types/folder";

/** Sentinel for "the top level" so it can be told apart from "nothing picked". */
export const ROOT_TARGET = "__root__";

interface FolderPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: Folder[];
  title: string;
  description?: string;
  confirmLabel: string;
  /** Folders that can't be picked, with the reason shown next to them. */
  disabled?: Map<string, string>;
  /** Offer the top level ("Folders") as a destination — used when moving folders. */
  allowRoot?: boolean;
  rootDisabledReason?: string;
  onPick: (folderId: string | null) => void | Promise<void>;
}

export function FolderPickerDialog({
  open,
  onOpenChange,
  folders,
  title,
  description,
  confirmLabel,
  disabled,
  allowRoot = false,
  rootDisabledReason,
  onPick,
}: FolderPickerDialogProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected(null);
      setCollapsed(new Set());
      setBusy(false);
    }
  }, [open]);

  const hasChildren = useMemo(() => {
    const set = new Set<string>();
    for (const f of folders) if (f.parentId) set.add(f.parentId);
    return set;
  }, [folders]);

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function confirm(target: string | null = selected) {
    if (!target || busy) return;
    setBusy(true);
    try {
      await onPick(target === ROOT_TARGET ? null : target);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  function renderLevel(parentId: string | null, depth: number) {
    return childFolders(folders, parentId).map((folder) => {
      const reason = disabled?.get(folder.id);
      const isOpen = !collapsed.has(folder.id);
      const expandable = hasChildren.has(folder.id);
      return (
        <div key={folder.id}>
          <div
            className={cn(
              "flex items-center gap-1 rounded-md pr-2 text-sm",
              selected === folder.id ? "bg-selection" : !reason && "hover:bg-hover",
            )}
            style={{ paddingLeft: depth * 16 + 4 }}
          >
            <button
              type="button"
              aria-label={isOpen ? "Collapse" : "Expand"}
              onClick={() => toggle(folder.id)}
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground",
                !expandable && "invisible",
              )}
            >
              <ChevronRightIcon
                className={cn("size-3.5 transition-transform", isOpen && "rotate-90")}
              />
            </button>
            <button
              type="button"
              disabled={!!reason}
              onClick={() => setSelected(folder.id)}
              onDoubleClick={() => {
                setSelected(folder.id);
                void confirm(folder.id);
              }}
              className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left disabled:cursor-not-allowed disabled:opacity-50"
            >
              {selected === folder.id ? (
                <FolderOpenIcon className="size-4 shrink-0 text-folder" />
              ) : (
                <FolderIcon className="size-4 shrink-0 text-folder" />
              )}
              <span className="truncate">{folder.name}</span>
              {reason && (
                <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{reason}</span>
              )}
            </button>
          </div>
          {expandable && isOpen && renderLevel(folder.id, depth + 1)}
        </div>
      );
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="flex max-h-80 min-h-32 flex-col overflow-y-auto rounded-md border border-border p-1">
          {allowRoot && (
            <button
              type="button"
              disabled={!!rootDisabledReason}
              onClick={() => setSelected(ROOT_TARGET)}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50",
                selected === ROOT_TARGET ? "bg-selection" : !rootDisabledReason && "hover:bg-hover",
              )}
            >
              <HomeIcon className="size-4 shrink-0 text-muted-foreground" />
              <span>Folders (top level)</span>
              {rootDisabledReason && (
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {rootDisabledReason}
                </span>
              )}
            </button>
          )}
          {folders.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No folders yet.</p>
          ) : (
            renderLevel(null, allowRoot ? 1 : 0)
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!selected || busy} onClick={() => void confirm()}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
