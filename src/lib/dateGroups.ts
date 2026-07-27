import type { ProblemSummary, SortOrder } from "@/types/problem";

export interface ProblemGroup {
  label: string;
  items: ProblemSummary[];
  collapsedByDefault: boolean;
}

const RECENT_LABELS = ["Today", "Yesterday", "This Week", "This Month"];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function groupProblemsByDate(
  problems: ProblemSummary[],
  sort: SortOrder = "newest",
): ProblemGroup[] {
  // Alphabetical order has nothing to do with dates: bucketing by day would
  // scatter the A-Z run across headers, so show one flat list instead.
  if (sort === "name") {
    return problems.length === 0
      ? []
      : [{ label: "All Problems", items: problems, collapsedByDefault: false }];
  }

  // Bucket by whichever timestamp the list is ordered on, so a heading always
  // describes the ordering the user asked for.
  const dateOf = (p: ProblemSummary) => (sort === "updated" ? p.updatedAt : p.createdAt);

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
    const date = new Date(dateOf(problem));
    const day = startOfDay(date);

    if (day.getTime() === today.getTime()) {
      push("Today", problem);
    } else if (day.getTime() === yesterday.getTime()) {
      push("Yesterday", problem);
    } else if (day.getTime() > weekAgo.getTime()) {
      push("This Week", problem);
    } else if (day.getTime() >= monthStart.getTime()) {
      push("This Month", problem);
    } else {
      const label = date.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      });
      push(label, problem);
    }
  }

  // Month buckets already follow the query's direction (insertion order), but
  // the relative labels are a fixed newest-first ladder, so "oldest" has to
  // flip them and move them below the months — otherwise the group order stays
  // newest-first no matter what the sort says.
  const recent = RECENT_LABELS.filter((label) => buckets.has(label));
  const months = order.filter((label) => !RECENT_LABELS.includes(label));
  const sortedLabels =
    sort === "oldest" ? [...months, ...recent.reverse()] : [...recent, ...months];

  return sortedLabels.map((label, index) => ({
    label,
    items: buckets.get(label)!,
    // Archive months collapse by default, but never the group at the top of
    // the list — the panel would open on nothing but headers.
    collapsedByDefault: index > 0 && !RECENT_LABELS.includes(label),
  }));
}
