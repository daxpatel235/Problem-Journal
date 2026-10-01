import { StarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ComboField } from "@/components/editor/ComboField";
import { ProblemFolders } from "@/components/editor/ProblemFolders";
import { useProblemStore } from "@/stores/problemStore";
import { DIFFICULTY_PRESETS, PATTERN_CATEGORY_PRESETS, PLATFORM_PRESETS, TOPIC_PRESETS } from "@/lib/presets";

function formatTimestamp(iso: string): string {
  if (!iso) return "Not yet saved";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ProblemInfo() {
  const problem = useProblemStore((s) => s.selectedProblem);
  const updateDraft = useProblemStore((s) => s.updateDraft);

  if (!problem) return null;

  return (
    <div className="flex flex-col gap-3 border-b border-border p-4">
      <div className="flex items-center gap-2">
        <Input
          value={problem.problemName}
          onChange={(e) => updateDraft({ problemName: e.target.value })}
          placeholder="Problem name"
          className="h-9 flex-1 text-base font-medium bg-transparent border-transparent px-0 focus-visible:border-border focus-visible:px-2.5"
        />
        <button
          type="button"
          aria-label={problem.favorite ? "Unfavorite" : "Add to favorites"}
          aria-pressed={problem.favorite}
          onClick={() => updateDraft({ favorite: !problem.favorite })}
          className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-hover hover:text-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <StarIcon
            className="size-4"
            fill={problem.favorite ? "currentColor" : "none"}
            color={problem.favorite ? "var(--warning)" : "currentColor"}
          />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Difficulty</Label>
          <Select
            value={problem.difficulty}
            onValueChange={(value) => updateDraft({ difficulty: value as string })}
          >
            <SelectTrigger className="h-8 w-full bg-input/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIFFICULTY_PRESETS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ComboField
          label="Topic"
          value={problem.topic}
          onChange={(value) => updateDraft({ topic: value })}
          presets={TOPIC_PRESETS}
          placeholder="e.g. Arrays"
        />

        <ComboField
          label="Platform"
          value={problem.platform}
          onChange={(value) => updateDraft({ platform: value })}
          presets={PLATFORM_PRESETS}
          placeholder="e.g. LeetCode"
        />

        <ComboField
          label="Pattern Category"
          value={problem.patternCategory}
          onChange={(value) => updateDraft({ patternCategory: value })}
          presets={PATTERN_CATEGORY_PRESETS}
          placeholder="e.g. Two Pointer"
        />

        <div className="flex flex-col gap-1 sm:col-span-2">
          <Label className="text-xs text-muted-foreground">URL</Label>
          <Input
            value={problem.url}
            onChange={(e) => updateDraft({ url: e.target.value })}
            placeholder="https://..."
            className="h-8 bg-input/30"
          />
        </div>
      </div>

      <ProblemFolders />

      <div className="flex flex-wrap justify-end gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground/70">
        <span>Created {formatTimestamp(problem.createdAt)}</span>
        <span>Updated {formatTimestamp(problem.updatedAt)}</span>
      </div>
    </div>
  );
}
