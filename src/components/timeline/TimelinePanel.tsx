import { useEffect, useRef, useState } from "react";
import { InboxIcon, PlusIcon, SearchIcon, SearchXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterBar } from "@/components/timeline/FilterBar";
import { TimelineGroup } from "@/components/timeline/TimelineGroup";
import { groupProblemsByDate } from "@/lib/dateGroups";
import { useProblemStore } from "@/stores/problemStore";

export function TimelinePanel() {
  const problems = useProblemStore((s) => s.problems);
  const filters = useProblemStore((s) => s.filters);
  const selectedId = useProblemStore((s) => s.selectedId);
  const fetchProblems = useProblemStore((s) => s.fetchProblems);
  const setFilters = useProblemStore((s) => s.setFilters);
  const selectProblem = useProblemStore((s) => s.selectProblem);
  const newProblem = useProblemStore((s) => s.newProblem);

  const [searchInput, setSearchInput] = useState("");
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    void fetchProblems();
  }, [fetchProblems]);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void setFilters({ ...filters, query: searchInput || undefined });
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // Intentionally excludes `filters`/`setFilters` — this effect should only
    // re-run when the user types, using the latest filters via closure at fire time.
  }, [searchInput]);

  const sort = filters.sort ?? "newest";
  const groups = groupProblemsByDate(problems, sort);
  const hasActiveFilters = Object.values(filters).some(
    (v) => v !== undefined && v !== "" && v !== false,
  );

  function clearFilters() {
    setSearchInput("");
    void setFilters({});
  }

  return (
    <div className="flex h-full flex-col border-r border-border bg-surface">
      <div className="flex items-center justify-between gap-2 p-2">
        <h2 className="px-1 text-sm font-semibold text-foreground">Problems</h2>
        <Button type="button" size="sm" onClick={newProblem} className="gap-1">
          <PlusIcon className="size-3.5" />
          New
        </Button>
      </div>

      <div className="px-2 pb-2">
        <div className="relative">
          <SearchIcon className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Filter problems…"
            className="h-7 bg-input/30 pl-7 text-xs"
          />
        </div>
      </div>

      <FilterBar />

      <div className="flex-1 overflow-y-auto p-2">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-hover text-muted-foreground">
              {hasActiveFilters ? (
                <SearchXIcon className="size-6 opacity-60" />
              ) : (
                <InboxIcon className="size-6 opacity-60" />
              )}
            </div>
            {hasActiveFilters ? (
              <>
                <p className="text-sm text-muted-foreground">
                  No problems match your filters.
                </p>
                <Button type="button" size="sm" variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">No problems yet</p>
                <p className="max-w-[16rem] text-sm text-muted-foreground">
                  Log your first solved problem to start building your journal.
                </p>
                <Button type="button" size="sm" onClick={() => void newProblem()} className="gap-1">
                  <PlusIcon className="size-3.5" />
                  New Problem
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map((group) => (
              <TimelineGroup
                // Keying on the sort remounts the groups when the order
                // changes, so their default collapsed state is re-applied
                // instead of carrying over from the previous ordering.
                key={`${sort}:${group.label}`}
                group={group}
                selectedId={selectedId}
                onSelect={(id) => void selectProblem(id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
