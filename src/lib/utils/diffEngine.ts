import type { DiffEntry } from "@/types/diff";
import { deepEqual } from "./deepEqual";
import { INTERNAL_FIELDS } from "./redaction";
import { encodePath } from "./fieldPath";

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
    // Backend bookkeeping copies of the body (kept in sync with it) are not request changes.
    if (basePath === "" && INTERNAL_FIELDS.includes(key)) continue;
    // Escaped (see fieldPath.ts) so a key containing "." still reverts the right field.
    const childPath = basePath ? `${basePath}.${encodePath([key])}` : encodePath([key]);
    // The request body may be a JSON string on one side and an object (or reformatted string) on the other.
    const isBody = childPath === "data";
    const origVal = isBody ? normalizeData(origRecord[key]) : origRecord[key];
    const currVal = isBody ? normalizeData(currRecord[key]) : currRecord[key];

    if (origVal === currVal || (isBody && deepEqual(origVal, currVal))) continue;

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
