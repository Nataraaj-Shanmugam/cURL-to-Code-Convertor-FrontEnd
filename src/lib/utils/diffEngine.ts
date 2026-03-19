import type { DiffEntry } from "@/types/diff";

function normalizeData(obj: unknown): unknown {
  if (typeof obj === "string") {
    try {
      return JSON.parse(obj);
    } catch {
      return obj;
    }
  }
  return obj;
}

export function computeDiff(
  original: unknown,
  current: unknown,
  basePath = ""
): DiffEntry[] {
  const entries: DiffEntry[] = [];

  // Normalize data field for comparison
  if (basePath === "data") {
    original = normalizeData(original);
    current = normalizeData(current);
  }

  if (original === current) return entries;

  const bothObjects =
    typeof original === "object" &&
    original !== null &&
    typeof current === "object" &&
    current !== null;

  if (!bothObjects) {
    if (original === undefined && current !== undefined) {
      entries.push({ path: basePath, type: "added", newValue: current });
    } else if (original !== undefined && current === undefined) {
      entries.push({ path: basePath, type: "removed", oldValue: original });
    } else {
      entries.push({
        path: basePath,
        type: "modified",
        oldValue: original,
        newValue: current,
      });
    }
    return entries;
  }

  // Both are objects/arrays
  const origRecord = original as Record<string, unknown>;
  const currRecord = current as Record<string, unknown>;
  const allKeys = new Set([
    ...Object.keys(origRecord),
    ...Object.keys(currRecord),
  ]);

  for (const key of allKeys) {
    const childPath = basePath ? `${basePath}.${key}` : key;
    const origVal = origRecord[key];
    const currVal = currRecord[key];

    if (origVal === currVal) continue;

    if (origVal === undefined) {
      entries.push({ path: childPath, type: "added", newValue: currVal });
    } else if (currVal === undefined) {
      entries.push({ path: childPath, type: "removed", oldValue: origVal });
    } else if (
      typeof origVal === "object" &&
      origVal !== null &&
      typeof currVal === "object" &&
      currVal !== null
    ) {
      entries.push(...computeDiff(origVal, currVal, childPath));
    } else {
      entries.push({
        path: childPath,
        type: "modified",
        oldValue: origVal,
        newValue: currVal,
      });
    }
  }

  return entries;
}
