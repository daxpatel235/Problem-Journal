import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { COMPANY_PRESETS } from "@/lib/presets";
import { useProblemStore } from "@/stores/problemStore";
import type { SortOrder } from "@/types/problem";

type QuickChip = "all" | "favorites" | "today" | "week";

const CHIPS: { key: QuickChip; label: string }[] = [
  { key: "all", label: "All" },
  { key: "favorites", label: "Favorites" },
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
];

function isoStartOfDay(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function FilterBar() {
  const [activeChip, setActiveChip] = useState<QuickChip>("all");
  const filters = useProblemStore((s) => s.filters);
  const setFilters = useProblemStore((s) => s.setFilters);
  const problems = useProblemStore((s) => s.problems);

  // Company presets plus any tag currently in the list (and the active one, so
  // it never vanishes from the dropdown while selected).
  const availableTags = useMemo(() => {
    const set = new Set<string>(COMPANY_PRESETS);
    for (const problem of problems) for (const tag of problem.tags) set.add(tag);
    if (filters.tag) set.add(filters.tag);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [problems, filters.tag]);

  function applyChip(chip: QuickChip) {
    setActiveChip(chip);
    const base = { ...filters, favoritesOnly: undefined, dateFrom: undefined };
    if (chip === "favorites") {
      void setFilters({ ...base, favoritesOnly: true });
    } else if (chip === "today") {
      void setFilters({ ...base, dateFrom: isoStartOfDay(0) });
    } else if (chip === "week") {
      void setFilters({ ...base, dateFrom: isoStartOfDay(7) });
    } else {
      void setFilters(base);
    }
  }

  return (
    <div className="flex flex-col gap-2 border-b border-border p-2">
      <div className="flex flex-wrap gap-1">
        {CHIPS.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => applyChip(chip.key)}
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs transition-colors",
              activeChip === chip.key
                ? "bg-primary text-primary-foreground"
                : "bg-hover text-muted-foreground hover:text-foreground",
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <Select
          value={filters.difficulty ?? "all"}
          onValueChange={(value) =>
            void setFilters({
              ...filters,
              difficulty: value === "all" ? undefined : (value as string),
            })
          }
        >
          <SelectTrigger className="h-7 flex-1 bg-input/30 text-xs">
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Difficulties</SelectItem>
            <SelectItem value="Easy">Easy</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Hard">Hard</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.sort ?? "newest"}
          onValueChange={(value) =>
            void setFilters({ ...filters, sort: value as SortOrder })
          }
        >
          <SelectTrigger className="h-7 flex-1 bg-input/30 text-xs">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="updated">Recently updated</SelectItem>
            <SelectItem value="name">Name (A-Z)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Select
        value={filters.tag ?? "all"}
        onValueChange={(value) =>
          void setFilters({ ...filters, tag: value === "all" ? undefined : (value as string) })
        }
      >
        <SelectTrigger className="h-7 w-full bg-input/30 text-xs">
          <SelectValue placeholder="Tag" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Tags</SelectItem>
          {availableTags.map((tag) => (
            <SelectItem key={tag} value={tag}>
              {tag}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
