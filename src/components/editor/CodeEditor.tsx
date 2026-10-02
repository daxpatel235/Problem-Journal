import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { OnMount } from "@monaco-editor/react";
import { ArrowLeftIcon, Maximize2Icon, Minimize2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LANGUAGE_PRESETS } from "@/lib/presets";
import { cn } from "@/lib/utils";
import { useProblemStore } from "@/stores/problemStore";
import { useSettingsStore } from "@/stores/settingsStore";

const MonacoEditor = lazy(async () => {
  const [{ configureMonaco }, mod] = await Promise.all([
    import("@/lib/monacoSetup"),
    import("@monaco-editor/react"),
  ]);
  configureMonaco();
  return { default: mod.default };
});

export function CodeEditor() {
  const problem = useProblemStore((s) => s.selectedProblem);
  const updateDraft = useProblemStore((s) => s.updateDraft);
  const resolvedTheme = useSettingsStore((s) => s.resolvedTheme);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const lastFullscreen = useRef(isFullscreen);

  // Put the cursor back in the editor after entering or leaving full screen,
  // so you can keep typing without clicking into it again.
  useEffect(() => {
    if (lastFullscreen.current === isFullscreen) return;
    lastFullscreen.current = isFullscreen;
    const frame = requestAnimationFrame(() => editorRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [isFullscreen]);

  // Esc leaves full screen. Monaco consumes Esc itself (calls preventDefault)
  // when it is closing a widget such as find or autocomplete, so those keep
  // working; only an "unused" Esc exits. Open dialogs and dropdowns get Esc
  // first as well.
  useEffect(() => {
    if (!isFullscreen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector('[data-slot="dialog-content"], [data-slot="select-content"]')) {
        return;
      }
      event.preventDefault();
      setIsFullscreen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  if (!problem) return null;

  const problemTitle = problem.problemName.trim() || "Untitled problem";

  // The same element tree is used in both modes and only the classes change,
  // so the Monaco instance is never remounted: cursor, selection, scroll
  // position and undo history all survive entering and leaving full screen.
  return (
    <div
      className={cn(
        "flex flex-col",
        isFullscreen ? "fixed inset-0 z-40 bg-background" : "min-h-[320px] flex-1 p-4",
      )}
      role={isFullscreen ? "dialog" : undefined}
      aria-modal={isFullscreen ? true : undefined}
      aria-label={isFullscreen ? "Code editor, full screen" : undefined}
    >
      <div
        className={cn(
          "flex items-center gap-2",
          isFullscreen ? "h-11 shrink-0 border-b border-border bg-surface px-3" : "mb-2",
        )}
      >
        {isFullscreen ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5"
              title="Back to problem (Esc)"
              onClick={() => setIsFullscreen(false)}
            >
              <ArrowLeftIcon className="size-4" />
              Back to problem
            </Button>
            <span className="min-w-0 truncate text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{problemTitle}</span>
              <span className="mx-1.5 opacity-60">/</span>
              Code
            </span>
          </>
        ) : (
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Code
          </h3>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
            title={isFullscreen ? "Exit full screen (Esc)" : "Full screen"}
            onClick={() => setIsFullscreen((v) => !v)}
          >
            {isFullscreen ? (
              <Minimize2Icon className="size-3.5" />
            ) : (
              <Maximize2Icon className="size-3.5" />
            )}
          </Button>
          <Select
            value={problem.language}
            onValueChange={(value) => updateDraft({ language: value as string })}
          >
            <SelectTrigger className="h-7 bg-input/30 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGE_PRESETS.map((lang) => (
                <SelectItem key={lang.value} value={lang.value}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div
        className={cn(
          "flex-1 overflow-hidden",
          isFullscreen ? "min-h-0" : "min-h-[280px] rounded-md border border-border",
        )}
      >
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading editor…
            </div>
          }
        >
          <MonacoEditor
            height="100%"
            theme={resolvedTheme === "light" ? "vs" : "vs-dark"}
            language={problem.language}
            value={problem.code}
            onChange={(value) => updateDraft({ code: value ?? "" })}
            onMount={(editor) => {
              editorRef.current = editor;
            }}
            options={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: isFullscreen ? 14 : 13,
              minimap: { enabled: true },
              wordWrap: "on",
              automaticLayout: true,
              scrollBeyondLastLine: false,
              tabSize: 2,
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}
