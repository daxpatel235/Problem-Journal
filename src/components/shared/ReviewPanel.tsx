import { useEffect, useMemo, useState } from "react";
import { GraduationCapIcon, StarIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { api } from "@/lib/tauri";
import { useProblemStore } from "@/stores/problemStore";
import { useUiStore } from "@/stores/uiStore";
import type { ProblemSummary } from "@/types/problem";

const DIFFICULTY_COLOR: Record<string, string> = {
  Easy: "text-success",
  Medium: "text-warning",
  Hard: "text-destructive",
};

// Classic spaced-repetition intervals: resurface what you logged 1 day, 1 week,
// and 1 month ago so it stays in long-term memory.
const BUCKETS = [
  { key: "day", label: "1 day ago", days: 1 },
  { key: "week", label: "1 week ago", days: 7 },
  { key: "month", label: "1 month ago", days: 30 },
] as const;

function wholeDaysAgo(iso: string): number {
  const created = new Date(iso);
  created.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - created.getTime()) / 86_400_000);
}

export function ReviewPanel() {
  const reviewOpen = useUiStore((s) => s.reviewOpen);
  const closeReview = useUiStore((s) => s.closeReview);
  const selectProblem = useProblemStore((s) => s.selectProblem);
  const [problems, setProblems] = useState<ProblemSummary[]>([]);

  useEffect(() => {
    if (!reviewOpen) return;
    let active = true;
    void api.problems.list().then((list) => {
      if (active) setProblems(list);
    });
    return () => {
      active = false;
    };
  }, [reviewOpen]);

  const buckets = useMemo(() => {
    const byAge = new Map<number, ProblemSummary[]>();
    for (const problem of problems) {
      const age = wholeDaysAgo(problem.createdAt);
      const bucket = byAge.get(age) ?? [];
      bucket.push(problem);
      byAge.set(age, bucket);
    }
    return BUCKETS.map((b) => ({ ...b, items: byAge.get(b.days) ?? [] }));
  }, [problems]);

  const totalDue = buckets.reduce((sum, b) => sum + b.items.length, 0);

  function openForReview(id: string) {
    void selectProblem(id);
    closeReview();
  }

  return (
    <Dialog open={reviewOpen} onOpenChange={(open: boolean) => !open && closeReview()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Review</DialogTitle>
          <DialogDescription>
            Revisit problems you logged 1 day, 1 week, and 1 month ago to lock them into memory.
          </DialogDescription>
        </DialogHeader>

        {totalDue === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
            <GraduationCapIcon className="size-8 opacity-50" />
            <p className="text-sm">Nothing due for review today — check back tomorrow.</p>
          </div>
        ) : (
          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
            {buckets.map((bucket) => (
              <section key={bucket.key} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">{bucket.label}</Label>
                  <span className="text-xs tabular-nums text-muted-foreground/60">
                    {bucket.items.length}
                  </span>
                </div>
                {bucket.items.length === 0 ? (
                  <p className="px-1 text-xs text-muted-foreground/60 italic">Nothing here.</p>
                ) : (
                  bucket.items.map((problem) => (
                    <button
                      key={problem.id}
                      type="button"
                      onClick={() => openForReview(problem.id)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="flex-1 truncate text-sm text-foreground">
                        {problem.problemName || "Untitled problem"}
                      </span>
                      {problem.favorite && (
                        <StarIcon className="size-3 shrink-0 text-warning" fill="currentColor" />
                      )}
                      <span
                        className={cn(
                          "shrink-0 text-xs font-medium",
                          DIFFICULTY_COLOR[problem.difficulty],
                        )}
                      >
                        {problem.difficulty}
                      </span>
                    </button>
                  ))
                )}
              </section>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
