import { useEffect, useMemo, useState, type MouseEvent } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ChevronRightIcon,
  FileCodeIcon,
  FolderIcon,
  InboxIcon,
  MinusIcon,
  SearchIcon,
  StarIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildSubtreeMap,
  childrenByParent,
  EMPTY_PICKER_FILTERS,
  hasPickerFilters,
  matchesPickerFilters,
  type PickerFilters,
} from "@/lib/exportPlan";
import { folderPath } from "@/lib/folders";
import { cn } from "@/lib/utils";
import { useExportStore, type ExportMode } from "@/stores/exportStore";
import { useFolderStore } from "@/stores/folderStore";

/** Pseudo-folder holding problems that aren't in any folder. */
const UNFILED = "__unfiled__";
/** Problems drawn per folder before a "Show more" row. */
const PAGE = 100;

const DIFFICULTY_COLOR: Record<string, string> = {
  Easy: "text-success",
  Medium: "text-warning",
  Hard: "text-destructive",
};

const MODE_HINT: Record<ExportMode, string> = {
  one: "Click the problem you want to export.",
  selected: "Tick the problems you want. Ticking a folder ticks everything inside it.",
  folder: "Tick one or more folders. Their subfolders come along too.",
  filtered: "Started from your problem list's current filters. Fine-tune with the filters below.",
  all: "Every problem is ticked. Untick anything you want to leave out.",
};

type Row =
  | {
      kind: "folder";
      key: string;
      id: string;
      name: string;
      depth: number;
      ids: string[];
      expanded: boolean;
      expandable: boolean;
      unfiled: boolean;
    }
  | { kind: "problem"; key: string; id: string; depth: number }
  | { kind: "more"; key: string; nodeId: string; depth: number; remaining: number };

type CheckState = "on" | "off" | "mixed";

function TriCheckbox({
  state,
  label,
  onToggle,
  disabled,
}: {
  state: CheckState;
  label: string;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={state === "mixed" ? "mixed" : state === "on"}
      aria-label={label}
      disabled={disabled}
      onClick={(e: MouseEvent) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40",
        state !== "off" && "border-primary bg-primary text-primary-foreground",
      )}
    >
      {state === "on" && <CheckIcon className="size-3" />}
      {state === "mixed" && <MinusIcon className="size-3" />}
    </button>
  );
}

function Radio({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-full border border-input",
        on && "border-primary",
      )}
    >
      {on && <span className="size-2 rounded-full bg-primary" />}
    </span>
  );
}

export function ExportPickStep() {
  const index = useExportStore((s) => s.index)!;
  const mode = useExportStore((s) => s.mode) ?? "selected";
  const selected = useExportStore((s) => s.selected);
  const focusFolderId = useExportStore((s) => s.focusFolderId);
  const toggle = useExportStore((s) => s.toggle);
  const selectOnly = useExportStore((s) => s.selectOnly);
  const setMany = useExportStore((s) => s.setMany);
  const clearSelection = useExportStore((s) => s.clearSelection);
  const goTo = useExportStore((s) => s.goTo);
  const folders = useFolderStore((s) => s.folders);

  const single = mode === "one";
  const [filters, setFilters] = useState<PickerFilters>(EMPTY_PICKER_FILTERS);
  const filtering = hasPickerFilters(filters);
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const open = new Set<string>();
    if (focusFolderId) for (const f of folderPath(folders, focusFolderId)) open.add(f.id);
    if (folders.length === 0) open.add(UNFILED);
    return open;
  });

  // Bring the folder you came from into view.
  useEffect(() => {
    if (!focusFolderId) return;
    document
      .querySelector(`[data-folder-row="${CSS.escape(focusFolderId)}"]`)
      ?.scrollIntoView({ block: "center" });
  }, [focusFolderId]);

  const childrenOf = useMemo(() => childrenByParent(folders), [folders]);
  const subtree = useMemo(
    () => buildSubtreeMap(folders, index, childrenOf),
    [folders, index, childrenOf],
  );

  const matching = useMemo(() => {
    if (!filtering) return null;
    const ids = new Set<string>();
    for (const p of index.problemById.values()) if (matchesPickerFilters(p, filters)) ids.add(p.id);
    return ids;
  }, [filtering, filters, index]);

  const topics = useMemo(
    () =>
      [...new Set([...index.problemById.values()].map((p) => p.topic).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b),
      ),
    [index],
  );
  const tags = useMemo(
    () =>
      [...new Set([...index.problemById.values()].flatMap((p) => p.tags))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [index],
  );

  const rows = useMemo(() => {
    const out: Row[] = [];
    const pushProblems = (nodeId: string, ids: string[], depth: number) => {
      const limit = limits[nodeId] ?? PAGE;
      for (const id of ids.slice(0, limit)) {
        out.push({ kind: "problem", key: `${nodeId}/${id}`, id, depth });
      }
      if (ids.length > limit) {
        out.push({ kind: "more", key: `${nodeId}/more`, nodeId, depth, remaining: ids.length - limit });
      }
    };
    const seen = new Set<string>();
    const walk = (parentId: string | null, depth: number) => {
      for (const f of childrenOf.get(parentId) ?? []) {
        if (seen.has(f.id)) continue;
        seen.add(f.id);
        const all = subtree.get(f.id) ?? [];
        const ids = matching ? all.filter((id) => matching.has(id)) : all;
        if (matching && ids.length === 0) continue;
        const direct = (index.directByFolder.get(f.id) ?? []).filter(
          (id) => !matching || matching.has(id),
        );
        const hasKids = (childrenOf.get(f.id) ?? []).length > 0;
        const isOpen = Boolean(matching) || expanded.has(f.id);
        out.push({
          kind: "folder",
          key: f.id,
          id: f.id,
          name: f.name,
          depth,
          ids,
          expanded: isOpen,
          expandable: hasKids || direct.length > 0,
          unfiled: false,
        });
        if (isOpen) {
          walk(f.id, depth + 1);
          pushProblems(f.id, direct, depth + 1);
        }
      }
    };
    walk(null, 0);

    const unfiled = matching ? index.unfiled.filter((id) => matching.has(id)) : index.unfiled;
    if (unfiled.length > 0) {
      const isOpen = Boolean(matching) || expanded.has(UNFILED);
      out.push({
        kind: "folder",
        key: UNFILED,
        id: UNFILED,
        name: folders.length === 0 ? "All problems" : "Not in any folder",
        depth: 0,
        ids: unfiled,
        expanded: isOpen,
        expandable: true,
        unfiled: true,
      });
      if (isOpen) pushProblems(UNFILED, unfiled, 1);
    }
    return out;
  }, [childrenOf, subtree, matching, index, expanded, limits, folders.length]);

  const matchingIds = useMemo(
    () => (matching ? [...matching] : [...index.problemById.keys()]),
    [matching, index],
  );
  const hiddenSelected = matching ? [...selected].filter((id) => !matching.has(id)).length : 0;

  function checkState(ids: string[]): CheckState {
    let on = 0;
    for (const id of ids) if (selected.has(id)) on += 1;
    if (on === 0) return "off";
    return on === ids.length ? "on" : "mixed";
  }

  function toggleExpanded(id: string) {
    if (matching) return; // everything matching is already open
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function pickProblem(id: string) {
    if (single) selectOnly(id);
    else toggle(id);
  }

  const canContinue = single ? selected.size === 1 : selected.size > 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">{MODE_HINT[mode]}</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-56">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.query}
              onChange={(e) => setFilters({ ...filters, query: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Escape" && filters.query) {
                  e.preventDefault();
                  setFilters({ ...filters, query: "" });
                }
              }}
              placeholder="Search name, topic, tag…"
              aria-label="Search problems"
              className="h-7 pl-7 text-xs"
            />
          </div>

          <Select
            value={filters.difficulty || "any"}
            onValueChange={(v) =>
              setFilters({ ...filters, difficulty: v === "any" ? "" : String(v) })
            }
          >
            <SelectTrigger size="sm" className="h-7 w-36 bg-input/30 text-xs">
              <SelectValue>
                {(v: string) => (v === "any" || !v ? "Any difficulty" : v)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any difficulty</SelectItem>
              <SelectItem value="Easy">Easy</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Hard">Hard</SelectItem>
            </SelectContent>
          </Select>

          {topics.length > 0 && (
            <Select
              value={filters.topic || "any"}
              onValueChange={(v) => setFilters({ ...filters, topic: v === "any" ? "" : String(v) })}
            >
              <SelectTrigger size="sm" className="h-7 w-40 bg-input/30 text-xs">
                <SelectValue>{(v: string) => (v === "any" || !v ? "Any topic" : v)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any topic</SelectItem>
                {topics.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {tags.length > 0 && (
            <Select
              value={filters.tag || "any"}
              onValueChange={(v) => setFilters({ ...filters, tag: v === "any" ? "" : String(v) })}
            >
              <SelectTrigger size="sm" className="h-7 w-36 bg-input/30 text-xs">
                <SelectValue>{(v: string) => (v === "any" || !v ? "Any tag" : v)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any tag</SelectItem>
                {tags.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            type="button"
            size="sm"
            variant={filters.favoritesOnly ? "secondary" : "ghost"}
            aria-pressed={filters.favoritesOnly}
            className="h-7 gap-1 text-xs"
            onClick={() => setFilters({ ...filters, favoritesOnly: !filters.favoritesOnly })}
          >
            <StarIcon
              className={cn("size-3.5", filters.favoritesOnly && "text-warning")}
              fill={filters.favoritesOnly ? "currentColor" : "none"}
            />
            Favorites
          </Button>

          {filtering && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs text-muted-foreground"
              onClick={() => setFilters(EMPTY_PICKER_FILTERS)}
            >
              <XIcon className="size-3.5" />
              Clear filters
            </Button>
          )}

          {!single && (
            <div className="ml-auto flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={matchingIds.length === 0}
                onClick={() => setMany(matchingIds, true)}
              >
                {filtering
                  ? `Select ${matchingIds.length} matching`
                  : `Select all ${matchingIds.length}`}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                disabled={selected.size === 0}
                onClick={clearSelection}
              >
                Clear selection
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto px-2 py-2" role="tree" aria-multiselectable={!single}>
        {rows.length === 0 && (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
            <SearchIcon className="size-5 opacity-60" />
            No problems match these filters.
          </div>
        )}

        {rows.map((row) => {
          const indent = { paddingLeft: `${row.depth * 20 + 8}px` };

          if (row.kind === "more") {
            return (
              <div key={row.key} style={indent} className="py-1">
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  className="text-xs text-primary"
                  onClick={() =>
                    setLimits((l) => ({ ...l, [row.nodeId]: (l[row.nodeId] ?? PAGE) + 200 }))
                  }
                >
                  Show {Math.min(200, row.remaining)} more ({row.remaining} hidden)
                </Button>
              </div>
            );
          }

          if (row.kind === "folder") {
            const state = checkState(row.ids);
            const Icon = row.unfiled ? InboxIcon : FolderIcon;
            return (
              <div
                key={row.key}
                role="treeitem"
                aria-expanded={row.expandable ? row.expanded : undefined}
                aria-selected={state === "on"}
                tabIndex={0}
                data-folder-row={row.id}
                style={indent}
                onClick={() => row.expandable && toggleExpanded(row.id)}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === "Enter" || e.key === "ArrowRight" || e.key === "ArrowLeft") {
                    e.preventDefault();
                    if (
                      e.key === "Enter" ||
                      (e.key === "ArrowRight" && !row.expanded) ||
                      (e.key === "ArrowLeft" && row.expanded)
                    )
                      toggleExpanded(row.id);
                  }
                  if (e.key === " " && !single && row.ids.length > 0) {
                    e.preventDefault();
                    setMany(row.ids, state !== "on");
                  }
                }}
                className={cn(
                  "flex h-8 cursor-pointer items-center gap-2 rounded-md pr-2 transition-colors hover:bg-hover focus-visible:bg-hover focus-visible:outline-none",
                  focusFolderId === row.id && "bg-selection/40",
                )}
              >
                <ChevronRightIcon
                  className={cn(
                    "size-3.5 shrink-0 text-muted-foreground transition-transform",
                    row.expanded && "rotate-90",
                    !row.expandable && "invisible",
                  )}
                />
                {!single && (
                  <TriCheckbox
                    state={state}
                    label={`Select everything in ${row.name}`}
                    disabled={row.ids.length === 0}
                    onToggle={() => setMany(row.ids, state !== "on")}
                  />
                )}
                <Icon
                  className={cn("size-4 shrink-0", row.unfiled ? "text-muted-foreground" : "text-folder")}
                  {...(row.unfiled ? {} : { fill: "currentColor", fillOpacity: 0.25 })}
                />
                <span className="truncate text-sm">{row.name}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                  {row.ids.length === 0
                    ? "empty"
                    : single
                      ? `${row.ids.length}`
                      : `${row.ids.filter((id) => selected.has(id)).length} / ${row.ids.length}`}
                </span>
              </div>
            );
          }

          const problem = index.problemById.get(row.id);
          if (!problem) return null;
          const on = selected.has(row.id);
          return (
            <div
              key={row.key}
              role="treeitem"
              aria-selected={on}
              tabIndex={0}
              style={indent}
              onClick={() => pickProblem(row.id)}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  pickProblem(row.id);
                }
              }}
              className={cn(
                "flex h-8 cursor-pointer items-center gap-2 rounded-md pr-2 transition-colors hover:bg-hover focus-visible:bg-hover focus-visible:outline-none",
                on && "bg-selection/30",
              )}
            >
              {/* lines the checkbox up under the folder checkbox (chevron width) */}
              <span className="w-3.5 shrink-0" aria-hidden />
              {single ? (
                <Radio on={on} />
              ) : (
                <TriCheckbox
                  state={on ? "on" : "off"}
                  label={`Select ${problem.problemName || "Untitled problem"}`}
                  onToggle={() => toggle(row.id)}
                />
              )}
              <FileCodeIcon className="size-4 shrink-0 text-primary" />
              <span className="truncate text-sm">{problem.problemName || "Untitled problem"}</span>
              {problem.favorite && (
                <StarIcon className="size-3 shrink-0 text-warning" fill="currentColor" />
              )}
              <span className="ml-auto flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("font-medium", DIFFICULTY_COLOR[problem.difficulty])}>
                  {problem.difficulty}
                </span>
                {problem.topic && (
                  <>
                    <span className="opacity-40">&middot;</span>
                    <span className="max-w-40 truncate">{problem.topic}</span>
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex shrink-0 items-center gap-3 border-t border-border px-4 py-2.5">
        <span className="text-sm">
          <span className="font-semibold tabular-nums">{selected.size}</span>{" "}
          <span className="text-muted-foreground">
            {selected.size === 1 ? "problem" : "problems"} selected
          </span>
          {hiddenSelected > 0 && (
            <span className="text-xs text-muted-foreground">
              {" "}
              · {hiddenSelected} not shown by the filters
            </span>
          )}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button type="button" size="sm" variant="ghost" className="gap-1" onClick={() => goTo("mode")}>
            <ArrowLeftIcon className="size-3.5" />
            Back
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1"
            disabled={!canContinue}
            onClick={() => goTo("review")}
          >
            Next: Review
            <ArrowRightIcon className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
