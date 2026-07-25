import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RotateCcwIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/tauri";
import { useProblemStore } from "@/stores/problemStore";
import { useUiStore } from "@/stores/uiStore";
import type { ProblemSummary } from "@/types/problem";

export function TrashDialog() {
  const trashOpen = useUiStore((s) => s.trashOpen);
  const closeTrash = useUiStore((s) => s.closeTrash);
  const requestConfirm = useUiStore((s) => s.requestConfirm);
  const fetchProblems = useProblemStore((s) => s.fetchProblems);

  const [items, setItems] = useState<ProblemSummary[]>([]);

  useEffect(() => {
    if (trashOpen) void refresh();
  }, [trashOpen]);

  async function refresh() {
    try {
      setItems(await api.problems.listTrash());
    } catch (err) {
      console.error("Failed to list trash", err);
    }
  }

  async function handleRestore(id: string) {
    await api.problems.restore(id);
    await refresh();
    await fetchProblems();
    toast.success("Problem restored");
  }

  function handlePermanentDelete(id: string, name: string) {
    requestConfirm({
      title: `Permanently delete "${name || "this problem"}"?`,
      description: "This cannot be undone.",
      confirmLabel: "Delete Forever",
      destructive: true,
      onConfirm: async () => {
        await api.problems.permanentDelete(id);
        await refresh();
      },
    });
  }

  return (
    <Dialog open={trashOpen} onOpenChange={(open: boolean) => !open && closeTrash()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Trash</DialogTitle>
          <DialogDescription>
            Problems moved to trash. Restore them or delete permanently.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {items.length === 0 && (
            <p className="p-2 text-sm text-muted-foreground">Trash is empty.</p>
          )}
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-hover"
            >
              <span className="truncate text-sm">{item.problemName || "Untitled problem"}</span>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Restore"
                  onClick={() => void handleRestore(item.id)}
                >
                  <RotateCcwIcon className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Delete permanently"
                  onClick={() => handlePermanentDelete(item.id, item.problemName)}
                >
                  <Trash2Icon className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
