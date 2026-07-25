import { StarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProblemSummary } from "@/types/problem";

const DIFFICULTY_COLOR: Record<string, string> = {
  Easy: "text-success",
  Medium: "text-warning",
  Hard: "text-destructive",
};

interface TimelineItemProps {
  problem: ProblemSummary;
  selected: boolean;
  onSelect: () => void;
}

export function TimelineItem({ problem, selected, onSelect }: TimelineItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col gap-0.5 rounded-md px-2.5 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "bg-selection" : "hover:bg-hover",
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="flex-1 truncate text-sm text-foreground">
          {problem.problemName || "Untitled problem"}
        </span>
        {problem.favorite && (
          <StarIcon className="size-3 shrink-0 text-warning" fill="currentColor" />
        )}
      </div>
      <div className="flex items-center gap-1.5 overflow-hidden text-xs text-muted-foreground">
        <span className={cn("shrink-0 font-medium", DIFFICULTY_COLOR[problem.difficulty])}>
          {problem.difficulty}
        </span>
        {problem.topic && (
          <>
            <span className="shrink-0 opacity-40">&middot;</span>
            <span className="truncate">{problem.topic}</span>
          </>
        )}
      </div>

      {problem.tags.length > 0 && (
        <div className="flex items-center gap-1 overflow-hidden">
          {problem.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="shrink-0 truncate rounded-full border border-border/70 px-1.5 py-px text-[10px] leading-tight text-muted-foreground"
            >
              {tag}
            </span>
          ))}
          {problem.tags.length > 3 && (
            <span className="shrink-0 text-[10px] text-muted-foreground/70">
              +{problem.tags.length - 3}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
