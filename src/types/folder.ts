export interface Folder {
  id: string;
  name: string;
  /** `null` for top-level folders. */
  parentId: string | null;
  /** Problems placed directly in this folder (not counting subfolders). */
  problemCount: number;
  createdAt: string;
  updatedAt: string;
}
