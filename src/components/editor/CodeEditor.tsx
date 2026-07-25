import { lazy, Suspense } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LANGUAGE_PRESETS } from "@/lib/presets";
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

  if (!problem) return null;

  return (
    <div className="flex min-h-[320px] flex-1 flex-col p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Code
        </h3>
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

      <div className="min-h-[280px] flex-1 overflow-hidden rounded-md border border-border">
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
            options={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 13,
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
