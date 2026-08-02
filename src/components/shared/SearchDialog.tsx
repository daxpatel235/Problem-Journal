import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { api } from "@/lib/tauri";
import { useProblemStore } from "@/stores/problemStore";
import { useUiStore } from "@/stores/uiStore";
import type { ProblemSummary } from "@/types/problem";

export function SearchDialog() {
  const searchOpen = useUiStore((s) => s.searchOpen);
  const closeSearch = useUiStore((s) => s.closeSearch);
  const selectProblem = useProblemStore((s) => s.selectProblem);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProblemSummary[]>([]);

  useEffect(() => {
    if (!searchOpen) {
      setQuery("");
      setResults([]);
    }
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const res = await api.problems.filter({ query });
        setResults(res);
      } catch (err) {
        console.error("Search failed", err);
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [query, searchOpen]);

  function handleSelect(id: string) {
    void selectProblem(id);
    closeSearch();
  }

  return (
    <CommandDialog
      open={searchOpen}
      onOpenChange={(open: boolean) => !open && closeSearch()}
      title="Search Problems"
      description="Search across problem names, topics, patterns, brute force notes, thinking, mistakes, and takeaways"
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search problems…"
      />
      <CommandList>
        <CommandEmpty>
          {query.trim() ? "No matching problems." : "Start typing to search."}
        </CommandEmpty>
        {results.length > 0 && (
          <CommandGroup heading="Results">
            {results.map((problem) => (
              <CommandItem
                key={problem.id}
                value={problem.id}
                onSelect={() => handleSelect(problem.id)}
              >
                <span className="flex-1 truncate">{problem.problemName}</span>
                <span className="text-xs text-muted-foreground">
                  {problem.difficulty}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
