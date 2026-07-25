import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { api } from "@/lib/tauri";
import { useUiStore } from "@/stores/uiStore";
import type { ProblemSummary } from "@/types/problem";

const DIFFICULTY_ORDER = ["Easy", "Medium", "Hard"] as const;
const DIFFICULTY_BAR: Record<string, string> = {
  Easy: "bg-success",
  Medium: "bg-warning",
  Hard: "bg-destructive",
};

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function countBy(values: string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function computeStats(problems: ProblemSummary[]) {
  const total = problems.length;
  const favorites = problems.filter((p) => p.favorite).length;

  const difficulty = DIFFICULTY_ORDER.map((level) => ({
    level,
    count: problems.filter((p) => p.difficulty === level).length,
  }));

  const topics = countBy(problems.map((p) => p.topic)).slice(0, 6);
  const companies = countBy(problems.flatMap((p) => p.tags)).slice(0, 6);

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const last7 = problems.filter((p) => now - new Date(p.createdAt).getTime() <= 7 * dayMs).length;
  const last30 = problems.filter((p) => now - new Date(p.createdAt).getTime() <= 30 * dayMs).length;

  const days = new Set(problems.map((p) => dayKey(new Date(p.createdAt))));
  let streak = 0;
  const cursor = new Date();
  // A streak isn't broken until a full day passes with nothing logged, so if
  // today is empty we start counting from yesterday.
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { total, favorites, difficulty, topics, companies, last7, last30, streak };
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-hover/40 p-3">
      <span className="text-xl font-semibold tabular-nums text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function BarRow({
  label,
  count,
  max,
  barClass,
}: {
  label: string;
  count: number;
  max: number;
  barClass: string;
}) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 shrink-0 truncate text-muted-foreground" title={label}>
        {label}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-hover">
        <div className={cn("h-full rounded-full", barClass)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 shrink-0 text-right tabular-nums text-muted-foreground">{count}</span>
    </div>
  );
}

export function StatsPanel() {
  const statsOpen = useUiStore((s) => s.statsOpen);
  const closeStats = useUiStore((s) => s.closeStats);
  const [problems, setProblems] = useState<ProblemSummary[]>([]);

  useEffect(() => {
    if (!statsOpen) return;
    let active = true;
    void api.problems.list().then((list) => {
      if (active) setProblems(list);
    });
    return () => {
      active = false;
    };
  }, [statsOpen]);

  const stats = useMemo(() => computeStats(problems), [problems]);
  const maxDifficulty = Math.max(1, ...stats.difficulty.map((d) => d.count));
  const maxTopic = Math.max(1, ...stats.topics.map(([, c]) => c));
  const maxCompany = Math.max(1, ...stats.companies.map(([, c]) => c));

  return (
    <Dialog open={statsOpen} onOpenChange={(open: boolean) => !open && closeStats()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Statistics</DialogTitle>
          <DialogDescription>An overview of everything you&apos;ve logged.</DialogDescription>
        </DialogHeader>

        {stats.total === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No problems logged yet — your stats will appear here.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatTile label="Total" value={stats.total} />
              <StatTile label="Favorites" value={stats.favorites} />
              <StatTile label="Last 7 days" value={stats.last7} />
              <StatTile label="Day streak" value={stats.streak} />
            </div>

            <Separator />

            <section className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">By difficulty</Label>
              <div className="flex flex-col gap-1.5">
                {stats.difficulty.map((d) => (
                  <BarRow
                    key={d.level}
                    label={d.level}
                    count={d.count}
                    max={maxDifficulty}
                    barClass={DIFFICULTY_BAR[d.level] ?? "bg-primary"}
                  />
                ))}
              </div>
            </section>

            {stats.topics.length > 0 && (
              <>
                <Separator />
                <section className="flex flex-col gap-2">
                  <Label className="text-xs text-muted-foreground">Top topics</Label>
                  <div className="flex flex-col gap-1.5">
                    {stats.topics.map(([topic, count]) => (
                      <BarRow
                        key={topic}
                        label={topic}
                        count={count}
                        max={maxTopic}
                        barClass="bg-primary"
                      />
                    ))}
                  </div>
                </section>
              </>
            )}

            {stats.companies.length > 0 && (
              <>
                <Separator />
                <section className="flex flex-col gap-2">
                  <Label className="text-xs text-muted-foreground">Top tags</Label>
                  <div className="flex flex-col gap-1.5">
                    {stats.companies.map(([company, count]) => (
                      <BarRow
                        key={company}
                        label={company}
                        count={count}
                        max={maxCompany}
                        barClass="bg-primary/70"
                      />
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
