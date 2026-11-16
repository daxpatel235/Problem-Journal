import { useEffect } from "react";
import { CheckIcon, Loader2Icon, ShareIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportModeStep } from "@/components/export/ExportModeStep";
import { ExportPickStep } from "@/components/export/ExportPickStep";
import { ExportReviewStep } from "@/components/export/ExportReviewStep";
import { cn } from "@/lib/utils";
import { useExportStore, type ExportStep } from "@/stores/exportStore";

const STEPS: { key: ExportStep; label: string }[] = [
  { key: "mode", label: "What to export" },
  { key: "pick", label: "Pick problems" },
  { key: "review", label: "Export" },
];

/** Full-screen export page: choose a way → pick problems → choose where to save. */
export function ExportView() {
  const step = useExportStore((s) => s.step);
  const mode = useExportStore((s) => s.mode);
  const selectedCount = useExportStore((s) => s.selected.size);
  const index = useExportStore((s) => s.index);
  const loading = useExportStore((s) => s.loading);
  const loadError = useExportStore((s) => s.loadError);
  const goTo = useExportStore((s) => s.goTo);
  const loadData = useExportStore((s) => s.loadData);
  const closeExport = useExportStore((s) => s.closeExport);

  // Esc closes the page, unless you're typing or a dialog/menu is open.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (document.querySelector('[data-slot="dialog-content"], [role="menu"], [role="listbox"]'))
        return;
      closeExport();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeExport]);

  const currentIndex = STEPS.findIndex((s) => s.key === step);
  const reachable = (key: ExportStep) =>
    key === "mode" || (key === "pick" && mode !== null) || (key === "review" && selectedCount > 0);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      <header className="flex h-12 shrink-0 items-center gap-4 border-b border-border px-4">
        <div className="flex items-center gap-2">
          <ShareIcon className="size-4 text-primary" />
          <h1 className="text-sm font-semibold">Export</h1>
          <span className="rounded bg-hover px-1.5 py-0.5 text-[11px] text-muted-foreground">
            PDF · A4
          </span>
        </div>

        <ol className="mx-auto flex items-center gap-1" aria-label="Export steps">
          {STEPS.map((s, i) => {
            const done = i < currentIndex;
            const active = s.key === step;
            const canGo = reachable(s.key) && !active;
            return (
              <li key={s.key} className="flex items-center gap-1">
                {i > 0 && <span className="h-px w-6 bg-border" aria-hidden />}
                <button
                  type="button"
                  disabled={!canGo}
                  onClick={() => goTo(s.key)}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
                    active ? "text-foreground" : "text-muted-foreground",
                    canGo && "hover:bg-hover hover:text-foreground",
                    !canGo && !active && "cursor-default opacity-60",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full border text-[10px] font-semibold",
                      active && "border-primary bg-primary text-primary-foreground",
                      done && "border-primary text-primary",
                      !active && !done && "border-border",
                    )}
                  >
                    {done ? <CheckIcon className="size-3" /> : i + 1}
                  </span>
                  {s.label}
                </button>
              </li>
            );
          })}
        </ol>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Close export"
          title="Close (Esc)"
          onClick={closeExport}
        >
          <XIcon className="size-4" />
        </Button>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden">
        {loadError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
            <p className="text-sm font-medium">Couldn't load your problems</p>
            <p className="max-w-md text-xs text-muted-foreground">{loadError}</p>
            <Button type="button" size="sm" onClick={() => void loadData()}>
              Try again
            </Button>
          </div>
        ) : !index || (loading && step !== "mode") ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Loading problems…
          </div>
        ) : step === "mode" ? (
          <ExportModeStep />
        ) : step === "pick" ? (
          <ExportPickStep />
        ) : (
          <ExportReviewStep />
        )}
      </div>
    </div>
  );
}
