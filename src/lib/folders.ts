import type { Folder } from "@/types/folder";

/** Folders whose parent is `parentId` (null = top level), sorted by name. */
export function childFolders(folders: Folder[], parentId: string | null): Folder[] {
  return folders
    .filter((f) => f.parentId === parentId)
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }),
    );
}

/** Ancestors of a folder, from the top level down to (and including) the folder itself. */
export function folderPath(folders: Folder[], id: string | null): Folder[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const path: Folder[] = [];
  const seen = new Set<string>();
  let current = id ? byId.get(id) : undefined;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}

/** "Arrays / Sliding Window" style label for a folder. */
export function folderPathLabel(folders: Folder[], id: string): string {
  return folderPath(folders, id)
    .map((f) => f.name)
    .join(" / ");
}

/** The folder itself plus every folder nested anywhere below it. */
export function folderSubtreeIds(folders: Folder[], id: string): Set<string> {
  const result = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders) {
      if (f.parentId && result.has(f.parentId) && !result.has(f.id)) {
        result.add(f.id);
        grew = true;
      }
    }
  }
  return result;
}

/** Short "2 folders · 5 problems" summary of what's directly inside a folder. */
export function folderContentsLabel(folders: Folder[], folder: Folder): string {
  const subfolders = folders.filter((f) => f.parentId === folder.id).length;
  const parts: string[] = [];
  if (subfolders > 0) parts.push(`${subfolders} folder${subfolders === 1 ? "" : "s"}`);
  if (folder.problemCount > 0 || subfolders === 0) {
    parts.push(`${folder.problemCount} problem${folder.problemCount === 1 ? "" : "s"}`);
  }
  return parts.join(" · ");
}
