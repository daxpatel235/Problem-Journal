import type { ProblemSummary } from "@/types/problem";

export interface ProblemGroup {
  label: string;
  items: ProblemSummary[];
  collapsedByDefault: boolean;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function groupProblemsByDate(problems: ProblemSummary[]): ProblemGroup[] {
  const today = startOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const buckets = new Map<string, ProblemSummary[]>();
  const order: string[] = [];

  function push(label: string, item: ProblemSummary) {
    if (!buckets.has(label)) {
      buckets.set(label, []);
      order.push(label);
    }
    buckets.get(label)!.push(item);
  }

  for (const problem of problems) {
    const created = new Date(problem.createdAt);
    const day = startOfDay(created);

    if (day.getTime() === today.getTime()) {
      push("Today", problem);
    } else if (day.getTime() === yesterday.getTime()) {
      push("Yesterday", problem);
    } else if (day.getTime() > weekAgo.getTime()) {
      push("This Week", problem);
    } else if (day.getTime() >= monthStart.getTime()) {
      push("This Month", problem);
    } else {
      const label = created.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      });
      push(label, problem);
    }
  }

  const fixedOrder = ["Today", "Yesterday", "This Week", "This Month"];
  const sortedLabels = [
    ...fixedOrder.filter((l) => buckets.has(l)),
    ...order.filter((l) => !fixedOrder.includes(l)),
  ];

  return sortedLabels.map((label) => ({
    label,
    items: buckets.get(label)!,
    collapsedByDefault: !fixedOrder.includes(label),
  }));
}
