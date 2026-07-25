import type { ReactNode } from "react";
import { toast } from "sonner";
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  FileTextIcon,
  Loader2Icon,
  PlusIcon,
  PrinterIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProblemInfo } from "@/components/editor/ProblemInfo";
import { DynamicList } from "@/components/editor/DynamicList";
import { CodeEditor } from "@/components/editor/CodeEditor";
import { TagInput } from "@/components/editor/TagInput";
import { COMPANY_PRESETS } from "@/lib/presets";
import { api } from "@/lib/tauri";
import { openHtmlForPrint, saveTextToFile } from "@/lib/exportFile";
import { useProblemStore } from "@/stores/problemStore";
import { useUiStore } from "@/stores/uiStore";

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-hover px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground">
      {children}
    </kbd>
  );
}

export function EditorPanel() {
  const problem = useProblemStore((s) => s.selectedProblem);
  const isNew = useProblemStore((s) => s.isNew);
  const isSaving = useProblemStore((s) => s.isSaving);
  const isDirty = useProblemStore((s) => s.isDirty);
  const updateDraft = useProblemStore((s) => s.updateDraft);
  const saveDraft = useProblemStore((s) => s.saveDraft);
  const newProblem = useProblemStore((s) => s.newProblem);
  const duplicateProblem = useProblemStore((s) => s.duplicateProblem);
  const requestConfirm = useUiStore((s) => s.requestConfirm);
  const deleteProblem = useProblemStore((s) => s.deleteProblem);

  if (!problem) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center text-muted-foreground">
        <div className="flex size-14 items-center justify-center rounded-xl bg-hover">
          <FileTextIcon className="size-7 opacity-50" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">No problem open</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Pick a problem from the timeline, or start a fresh entry to log what you
            just solved.
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => void newProblem()} className="gap-1">
          <PlusIcon className="size-3.5" />
          New Problem
        </Button>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground/80">
          <span className="flex items-center gap-1.5">
            <Kbd>Ctrl</Kbd>
            <Kbd>N</Kbd>
            new
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>Ctrl</Kbd>
            <Kbd>F</Kbd>
            search
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>Ctrl</Kbd>
            <Kbd>S</Kbd>
            save
          </span>
        </div>
      </div>
    );
  }

  const canAct = !isNew && problem.id;

  async function handleSave() {
    if (!problem) return;
    if (!problem.problemName.trim()) {
      toast.error("Add a problem name before saving.");
      return;
    }
    if (!isDirty) {
      toast("Already saved");
      return;
    }
    const result = await saveDraft();
    if (result === "saved") toast.success("Saved");
    else if (result === "error") toast.error("Save failed");
  }

  async function handleExport(kind: "markdown" | "json" | "pdf") {
    if (!problem?.id) return;
    try {
      if (kind === "markdown") {
        const md = await api.export.problemMarkdown(problem.id);
        await saveTextToFile(md, `${problem.problemName || "problem"}.md`, ["md"]);
      } else if (kind === "json") {
        const json = await api.export.problemJson(problem.id);
        await saveTextToFile(json, `${problem.problemName || "problem"}.json`, ["json"]);
      } else {
        const html = await api.export.problemPdfHtml(problem.id);
        openHtmlForPrint(html);
      }
    } catch (err) {
      toast.error(`Export failed: ${String(err)}`);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex h-8 items-center gap-2 border-b border-border px-4 text-xs text-muted-foreground">
        <span className="shrink-0">
          {isSaving ? (
            <span className="flex items-center gap-1">
              <Loader2Icon className="size-3 animate-spin" /> Saving…
            </span>
          ) : isDirty ? (
            <span className="flex items-center gap-1.5 text-warning">
              <span className="size-1.5 rounded-full bg-warning" />
              Unsaved changes
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <CheckIcon className="size-3 text-success" />
              Saved
            </span>
          )}
        </span>

        <div className="ml-auto flex min-w-0 items-center gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TagInput
            tags={problem.tags}
            onChange={(tags) => updateDraft({ tags })}
            presets={COMPANY_PRESETS}
          />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-xs"
            aria-label="Save"
            title="Save (Ctrl+S)"
            disabled={isSaving || !isDirty}
            onClick={() => void handleSave()}
          >
            <SaveIcon className="size-3.5" />
            Save
          </Button>
          {canAct && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Duplicate problem"
                onClick={() => void duplicateProblem(problem.id)}
              >
                <CopyIcon className="size-3.5" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button type="button" variant="ghost" size="icon-xs" aria-label="Export">
                      <DownloadIcon className="size-3.5" />
                    </Button>
                  }
                />
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => void handleExport("markdown")}>
                    Export as Markdown
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void handleExport("json")}>
                    Export as JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void handleExport("pdf")}>
                    <PrinterIcon className="size-3.5" />
                    Print / Save as PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Move to trash"
                onClick={() =>
                  requestConfirm({
                    title: "Move problem to trash?",
                    description: "You can restore it later from Settings.",
                    confirmLabel: "Move to Trash",
                    destructive: true,
                    onConfirm: () => void deleteProblem(problem.id),
                  })
                }
              >
                <Trash2Icon className="size-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto">
        <ProblemInfo />
        <DynamicList
          title="Pattern"
          items={problem.pattern}
          onChange={(items) => updateDraft({ pattern: items })}
        />
        <DynamicList
          title="Thinking"
          items={problem.thinking}
          onChange={(items) => updateDraft({ thinking: items })}
        />
        <DynamicList
          title="Mistakes"
          items={problem.mistakes}
          onChange={(items) => updateDraft({ mistakes: items })}
        />
        <DynamicList
          title="Takeaways"
          items={problem.takeaways}
          onChange={(items) => updateDraft({ takeaways: items })}
        />
        <CodeEditor />
      </div>
    </div>
  );
}
