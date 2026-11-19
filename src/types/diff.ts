export type DiffType = "added" | "removed" | "modified";

export interface DiffEntry {
  path: string;
  type: DiffType;
  oldValue?: unknown;
  newValue?: unknown;
}
