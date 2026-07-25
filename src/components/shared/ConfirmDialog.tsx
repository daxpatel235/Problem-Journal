import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUiStore } from "@/stores/uiStore";

export function ConfirmDialog() {
  const confirm = useUiStore((s) => s.confirm);
  const clearConfirm = useUiStore((s) => s.clearConfirm);

  return (
    <Dialog open={confirm !== null} onOpenChange={(open: boolean) => !open && clearConfirm()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{confirm?.title}</DialogTitle>
          {confirm?.description && (
            <DialogDescription>{confirm.description}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={clearConfirm}>
            Cancel
          </Button>
          <Button
            variant={confirm?.destructive ? "destructive" : "default"}
            onClick={() => {
              confirm?.onConfirm();
              clearConfirm();
            }}
          >
            {confirm?.confirmLabel ?? "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
