import { childFolders, folderSubtreeIds } from "@/lib/folders";
import type { Folder, FolderLink } from "@/types/folder";
import type { ProblemSummary } from "@/types/problem";

/** Lookup tables the export picker needs, built once per data load. */
export interface ExportIndex {
  problemById: Map<string, ProblemSummary>;
  /** Problems placed directly in each folder, sorted by name. */
  directByFolder: Map<string, string[]>;
  /** Problems not in any folder, sorted by name. */
  unfiled: string[];
}

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

function byName(problemById: Map<string, ProblemSummary>) {
  return (a: string, b: string) =>
    collator.compare(problemById.get(a)?.problemName ?? "", problemById.get(b)?.problemName ?? "");
}

export function buildExportIndex(problems: ProblemSummary[], links: FolderLink[]): ExportIndex {
  const problemById = new Map(problems.map((p) => [p.id, p]));
  const directByFolder = new Map<string, string[]>();
  const filed = new Set<string>();

  for (const link of links) {
    // A link can point at a problem the summary list doesn't know (race with a
    // delete); skip it rather than show a ghost row.
    if (!problemById.has(link.problemId)) continue;
    filed.add(link.problemId);
    const list = directByFolder.get(link.folderId);
    if (list) list.push(link.problemId);
    else directByFolder.set(link.folderId, [link.problemId]);
  }

  const compare = byName(problemById);
  for (const list of directByFolder.values()) list.sort(compare);
  const unfiled = problems
    .map((p) => p.id)
    .filter((id) => !filed.has(id))
    .sort(compare);

  return { problemById, directByFolder, unfiled };
}

/** Every problem anywhere inside a folder (including subfolders), de-duplicated. */
export function subtreeProblemIds(
  folders: Folder[],
  index: ExportIndex,
  folderId: string,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of folderSubtreeIds(folders, folderId)) {
    for (const pid of index.directByFolder.get(id) ?? []) {
      if (!seen.has(pid)) {
        seen.add(pid);
        out.push(pid);
      }
    }
  }
  return out;
}

/**
 * The order problems appear in the PDF: walk the folder tree the way the
 * picker shows it (folders by name, depth first, problems by name), then the
 * unfiled ones. A problem in several folders appears once, at its first spot.
 */
export function orderSelection(
  folders: Folder[],
  index: ExportIndex,
  selected: ReadonlySet<string>,
): string[] {
  const out: string[] = [];
  const placed = new Set<string>();
  const take = (id: string) => {
    if (selected.has(id) && !placed.has(id)) {
      placed.add(id);
      out.push(id);
    }
  };

  const visited = new Set<string>();
  const walk = (parentId: string | null) => {
    for (const folder of childFolders(folders, parentId)) {
      if (visited.has(folder.id)) continue; // defensive against a cyclic tree
      visited.add(folder.id);
      for (const pid of index.directByFolder.get(folder.id) ?? []) take(pid);
      walk(folder.id);
    }
  };
  walk(null);
  for (const pid of index.unfiled) take(pid);
  // Anything left (shouldn't happen, but never silently drop a selection).
  for (const id of selected) take(id);
  return out;
}

const RESERVED_WINDOWS_NAMES = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;

/** Turns any title into a safe Windows/macOS/Linux file name stem. */
export function sanitizeFileStem(name: string): string {
  let stem = name
    .normalize("NFC")
    // Characters Windows forbids in file names, plus control characters.
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    // Windows strips trailing dots/spaces, and leading dots hide files on Unix.
    .replace(/^[.-]+|[.-]+$/g, "");
  if (stem.length > 120) stem = stem.slice(0, 120).replace(/[.-]+$/, "");
  if (!stem) stem = "Problem";
  if (RESERVED_WINDOWS_NAMES.test(stem)) stem = `${stem}-file`;
  return stem;
}

export function ensurePdfExtension(fileName: string): string {
  const trimmed = fileName.trim();
  return /\.pdf$/i.test(trimmed) ? trimmed : `${trimmed}.pdf`;
}

/** Folders grouped by parent, each group sorted by name. */
export function childrenByParent(folders: Folder[]): Map<string | null, Folder[]> {
  const map = new Map<string | null, Folder[]>();
  for (const f of folders) {
    const list = map.get(f.parentId);
    if (list) list.push(f);
    else map.set(f.parentId, [f]);
  }
  for (const list of map.values()) list.sort((a, b) => collator.compare(a.name, b.name));
  return map;
}

/**
 * Every problem anywhere under each folder (subfolders included), computed
 * bottom-up in one pass so big trees stay fast.
 */
export function buildSubtreeMap(
  folders: Folder[],
  index: ExportIndex,
  children: Map<string | null, Folder[]> = childrenByParent(folders),
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const visiting = new Set<string>();
  const compute = (id: string): string[] => {
    const cached = map.get(id);
    if (cached) return cached;
    if (visiting.has(id)) return []; // defensive against a cyclic tree
    visiting.add(id);
    const ids = new Set(index.directByFolder.get(id) ?? []);
    for (const child of children.get(id) ?? []) for (const pid of compute(child.id)) ids.add(pid);
    const list = [...ids];
    map.set(id, list);
    return list;
  };
  for (const f of folders) compute(f.id);
  return map;
}

/** Folder whose whole subtree is exactly the selection, preferring the deepest match. */
export function folderMatchingSelection(
  folders: Folder[],
  index: ExportIndex,
  selected: ReadonlySet<string>,
): Folder | null {
  let best: Folder | null = null;
  let bestDepth = -1;
  const byId = new Map(folders.map((f) => [f.id, f]));
  const depthOf = (f: Folder) => {
    let depth = 0;
    let cur = f.parentId;
    const seen = new Set<string>();
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      depth += 1;
      cur = byId.get(cur)?.parentId ?? null;
    }
    return depth;
  };
  const subtree = buildSubtreeMap(folders, index);
  for (const folder of folders) {
    const ids = subtree.get(folder.id) ?? [];
    if (ids.length !== selected.size || ids.length === 0) continue;
    if (!ids.every((id) => selected.has(id))) continue;
    const depth = depthOf(folder);
    if (depth > bestDepth) {
      best = folder;
      bestDepth = depth;
    }
  }
  return best;
}

/**
 * Default PDF name: `Two-Sum.pdf` for one problem, `Arrays.pdf` when the
 * selection is exactly one folder, `Problem-Journal-All.pdf` for everything,
 * otherwise `Problem-Journal-12-problems.pdf`.
 */
export function suggestFileName(
  folders: Folder[],
  index: ExportIndex,
  selected: ReadonlySet<string>,
): string {
  const count = selected.size;
  if (count === 1) {
    const [only] = selected;
    const name = index.problemById.get(only)?.problemName ?? "";
    return `${sanitizeFileStem(name || "Untitled-problem")}.pdf`;
  }
  const total = index.problemById.size;
  if (count > 0 && count === total) return "Problem-Journal-All.pdf";
  const folder = folderMatchingSelection(folders, index, selected);
  if (folder) return `${sanitizeFileStem(folder.name)}.pdf`;
  return `Problem-Journal-${count}-problems.pdf`;
}

/** Filters the export picker applies on top of the tree (all client side). */
export interface PickerFilters {
  query: string;
  difficulty: string; // "" = any
  topic: string;
  tag: string;
  favoritesOnly: boolean;
}

export const EMPTY_PICKER_FILTERS: PickerFilters = {
  query: "",
  difficulty: "",
  topic: "",
  tag: "",
  favoritesOnly: false,
};

export function hasPickerFilters(f: PickerFilters): boolean {
  return Boolean(f.query.trim() || f.difficulty || f.topic || f.tag || f.favoritesOnly);
}

export function matchesPickerFilters(p: ProblemSummary, f: PickerFilters): boolean {
  if (f.difficulty && p.difficulty !== f.difficulty) return false;
  if (f.topic && p.topic !== f.topic) return false;
  if (f.tag && !p.tags.includes(f.tag)) return false;
  if (f.favoritesOnly && !p.favorite) return false;
  const q = f.query.trim().toLowerCase();
  if (q) {
    const haystack = [p.problemName, p.topic, p.patternCategory, ...p.tags]
      .join("\u0001")
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}
