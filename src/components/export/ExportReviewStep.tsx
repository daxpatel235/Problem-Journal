import { useEffect, useMemo, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import {
  TriangleAlertIcon,
  ArrowLeftIcon,
  CircleCheckIcon,
  ExternalLinkIcon,
  FolderOpenIcon,
  Loader2Icon,
  RotateCcwIcon,
  OctagonXIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ensurePdfExtension,
  folderMatchingSelection,
  orderSelection,
  suggestFileName,
} from "@/lib/exportPlan";
import { api, type PdfExportReport, type PdfExportRequest } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useExportStore, type ExportMode } from "@/stores/exportStore";
import { useFolderStore } from "@/stores/folderStore";

/** Rows listed in the preview before "…and N more". */
const PREVIEW_LIMIT = 200;

const DIFFICULTY_COLOR: Record<string, string> = {
  Easy: "text-success",
  Medium: "text-warning",
  Hard: "text-destructive",
};

const MODE_TITLE: Record<ExportMode, string> = {
  one: "Problem Journal",
  selected: "Selected Problems",
  folder: "Selected Folders",
  filtered: "Filtered Problems",
  all: "All Problems",
};

/** Strips only what Windows can't store in a file name; keeps the user's spaces. */
function cleanTypedName(name: string): string {
  // eslint-disable-next-line no-control-regex
  return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").trim().replace(/[. ]+$/, "");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function errorText(err: unknown): string {
  return typeof err === "string" ? err : err instanceof Error ? err.message : String(err);
}

async function openPdf(path: string) {
  try {
    await api.export.openPdf(path);
  } catch (err) {
    toast.error(errorText(err));
  }
}

async function revealPdf(path: string) {
  try {
    await api.export.revealPdf(path);
  } catch (err) {
    toast.error(errorText(err));
  }
}

export function ExportReviewStep() {
  const index = useExportStore((s) => s.index)!;
  const selected = useExportStore((s) => s.selected);
  const mode = useExportStore((s) => s.mode) ?? "selected";
  const goTo = useExportStore((s) => s.goTo);
  const job = useExportStore((s) => s.job);
  const lastRequest = useExportStore((s) => s.lastRequest);
  const runExport = useExportStore((s) => s.runExport);
  const cancelExport = useExportStore((s) => s.cancelExport);
  const resetJob = useExportStore((s) => s.resetJob);
  const folders = useFolderStore((s) => s.folders);

  const ordered = useMemo(() => orderSelection(folders, index, selected), [folders, index, selected]);
  const suggestion = useMemo(
    () => suggestFileName(folders, index, selected),
    [folders, index, selected],
  );
  const [fileName, setFileName] = useState(suggestion);

  // A different selection gets a fresh suggestion.
  useEffect(() => {
    setFileName(suggestion);
  }, [suggestion]);

  const counts = useMemo(() => {
    const c = { Easy: 0, Medium: 0, Hard: 0 } as Record<string, number>;
    for (const id of ordered) {
      const d = index.problemById.get(id)?.difficulty ?? "";
      if (d in c) c[d] += 1;
    }
    return c;
  }, [ordered, index]);

  const n = ordered.length;

  /** Title-page heading and subtitle for this selection. */
  function coverText(): { title: string; subtitle: string } {
    const folder = folderMatchingSelection(folders, index, selected);
    const kind = folder ? "Folder export" : mode === "all" ? "Complete journal" : "Export";
    const title = folder?.name ?? MODE_TITLE[mode];
    return { title, subtitle: `${plural(n, "problem")} · ${kind}` };
  }

  async function chooseLocationAndExport() {
    const typed = cleanTypedName(fileName.replace(/\.pdf$/i, ""));
    const name = ensurePdfExtension(typed || suggestion);
    let path: string | null;
    try {
      path = await save({
        title: "Problem Journal — Export PDF",
        defaultPath: name,
        filters: [{ name: "PDF document", extensions: ["pdf"] }],
      });
    } catch (err) {
      toast.error(`Couldn't open the save window: ${errorText(err)}`);
      return;
    }
    if (!path) return; // cancelled
    const finalPath = /\.pdf$/i.test(path) ? path : `${path}.pdf`;
    const { title, subtitle } = coverText();
    await startExport({
      problemIds: ordered,
      path: finalPath,
      title,
      subtitle,
      exportedOn: new Date().toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    });
  }

  async function startExport(request: PdfExportRequest) {
    await runExport(request);
    const result = useExportStore.getState().job;
    if (result.status === "done") {
      const { report } = result;
      const failed = report.failed.length;
      const message = failed
        ? `Exported ${report.exported} of ${report.exported + failed} problems`
        : `Exported ${plural(report.exported, "problem")}`;
      const notify = failed ? toast.warning : toast.success;
      notify(message, {
        description: `${plural(report.pages, "page")} · ${formatBytes(report.bytes)}`,
        action: { label: "Open PDF", onClick: () => void openPdf(report.path) },
      });
    } else if (result.status === "error") {
      toast.error("Export failed", { description: result.message });
    }
  }

  const running = job.status === "running";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* What's going in, in PDF order */}
          <section className="flex min-w-0 flex-col gap-3">
            <div>
              <h2 className="text-base font-semibold">
                {plural(n, "problem")} in this PDF
              </h2>
              <p className="text-sm text-muted-foreground">
                <span className={DIFFICULTY_COLOR.Easy}>{counts.Easy} Easy</span>
                {" · "}
                <span className={DIFFICULTY_COLOR.Medium}>{counts.Medium} Medium</span>
                {" · "}
                <span className={DIFFICULTY_COLOR.Hard}>{counts.Hard} Hard</span>
              </p>
            </div>

            <ol className="flex flex-col rounded-lg border border-border bg-surface py-1">
              {ordered.slice(0, PREVIEW_LIMIT).map((id, i) => {
                const p = index.problemById.get(id);
                if (!p) return null;
                return (
                  <li key={id} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                    <span className="w-7 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                      {i + 1}.
                    </span>
                    <span className="truncate">{p.problemName || "Untitled problem"}</span>
                    <span className="ml-auto flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <span className={cn("font-medium", DIFFICULTY_COLOR[p.difficulty])}>
                        {p.difficulty}
                      </span>
                      {p.topic && (
                        <>
                          <span className="opacity-40">&middot;</span>
                          <span className="max-w-40 truncate">{p.topic}</span>
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
              {n > PREVIEW_LIMIT && (
                <li className="px-3 py-1.5 text-xs text-muted-foreground">
                  …and {n - PREVIEW_LIMIT} more
                </li>
              )}
            </ol>
          </section>

          {/* Where it goes, and how it's going */}
          <aside className="flex flex-col gap-4">
            {job.status === "running" ? (
              <ProgressCard
                phase={job.phase}
                done={job.done}
                total={job.total}
                cancelling={job.cancelling}
                onCancel={() => void cancelExport()}
              />
            ) : job.status === "done" ? (
              <DoneCard
                report={job.report}
                onRetry={lastRequest ? () => void startExport(lastRequest) : undefined}
                onAgain={resetJob}
              />
            ) : job.status === "error" ? (
              <div className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  <OctagonXIcon className="size-4 text-destructive" />
                  The PDF wasn't saved
                </p>
                <p className="text-xs text-muted-foreground">{job.message}</p>
                <div className="flex gap-2">
                  {lastRequest && (
                    <Button type="button" size="sm" className="gap-1" onClick={() => void startExport(lastRequest)}>
                      <RotateCcwIcon className="size-3.5" />
                      Try again
                    </Button>
                  )}
                  <Button type="button" size="sm" variant="outline" onClick={resetJob}>
                    Choose another location
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {job.status === "cancelled" && (
                  <p className="rounded-lg border border-border bg-surface p-3 text-xs text-muted-foreground">
                    Export cancelled. Nothing was saved.
                  </p>
                )}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="export-file-name" className="text-xs font-medium text-muted-foreground">
                    File name
                  </label>
                  <Input
                    id="export-file-name"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    className="h-8 text-sm"
                    spellCheck={false}
                  />
                </div>

                <div className="rounded-lg border border-border bg-surface p-3 text-xs text-muted-foreground">
                  <p className="mb-1.5 font-medium text-foreground">What the PDF will look like</p>
                  <ul className="flex list-disc flex-col gap-0.5 pl-4">
                    <li>A4, light theme</li>
                    {n > 1 && <li>Title page and clickable contents</li>}
                    <li>Each problem starts on a new page</li>
                    <li>Page numbers on every page</li>
                    <li>Only the fields you filled in, with code last</li>
                  </ul>
                </div>

                <Button
                  type="button"
                  className="h-9 gap-1.5"
                  disabled={n === 0}
                  onClick={() => void chooseLocationAndExport()}
                >
                  <FolderOpenIcon className="size-4" />
                  Choose where to save…
                </Button>
              </>
            )}
          </aside>
        </div>
      </div>

      <div className="flex shrink-0 items-center border-t border-border px-4 py-2.5">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="gap-1"
          disabled={running}
          onClick={() => goTo("pick")}
        >
          <ArrowLeftIcon className="size-3.5" />
          Back to picking
        </Button>
      </div>
    </div>
  );
}

function ProgressCard({
  phase,
  done,
  total,
  cancelling,
  onCancel,
}: {
  phase: "layout" | "writing";
  done: number;
  total: number;
  cancelling: boolean;
  onCancel: () => void;
}) {
  // Layout is most of the work; writing fills the last 10%.
  const pct =
    phase === "layout"
      ? Math.round((total > 0 ? done / total : 0) * 90)
      : 90 + Math.round((total > 0 ? done / total : 0) * 10);
  const label =
    phase === "layout" ? `Laying out ${done} / ${total} problems…` : "Writing the PDF…";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4" aria-live="polite">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Loader2Icon className="size-4 animate-spin text-primary" />
        {cancelling ? "Cancelling…" : label}
      </p>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-hover"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="tabular-nums">{pct}%</span>
        <Button type="button" size="sm" variant="outline" disabled={cancelling} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function DoneCard({
  report,
  onRetry,
  onAgain,
}: {
  report: PdfExportReport;
  onRetry?: () => void;
  onAgain: () => void;
}) {
  const failed = report.failed;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 rounded-lg border border-success/40 bg-success/5 p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <CircleCheckIcon className="size-4 text-success" />
          PDF saved
        </p>
        <p className="text-xs text-muted-foreground">
          {plural(report.exported, "problem")} · {plural(report.pages, "page")} · {formatBytes(report.bytes)}
        </p>
        <p className="break-all font-mono text-[11px] text-muted-foreground">{report.path}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" className="gap-1" onClick={() => void openPdf(report.path)}>
            <ExternalLinkIcon className="size-3.5" />
            Open PDF
          </Button>
          <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => void revealPdf(report.path)}>
            <FolderOpenIcon className="size-3.5" />
            Show in folder
          </Button>
        </div>
      </div>

      {failed.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <TriangleAlertIcon className="size-4 text-warning" />
            {failed.length} of {report.exported + failed.length} problems were left out
          </p>
          <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto text-xs text-muted-foreground">
            {failed.map((f) => (
              <li key={f.id}>
                <span className="text-foreground">{f.name}</span>: {f.reason}
              </li>
            ))}
          </ul>
          {onRetry && (
            <Button type="button" size="sm" variant="outline" className="w-fit gap-1" onClick={onRetry}>
              <RotateCcwIcon className="size-3.5" />
              Try again
            </Button>
          )}
        </div>
      )}

      <Button type="button" size="sm" variant="ghost" className="w-fit" onClick={onAgain}>
        Export again with a different name
      </Button>
    </div>
  );
}
