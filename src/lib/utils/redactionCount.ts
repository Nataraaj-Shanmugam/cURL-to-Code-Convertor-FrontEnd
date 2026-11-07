import { countRedactions } from "./redaction";

const counts = new WeakMap<object, number>();

/**
 * countRedactions for the editor's immutable, structurally shared states: the count of every
 * object/array is cached by identity, so after an edit only the containers on the edited path
 * are walked again instead of the whole request (a multi-MB body took seconds per edit).
 * Same result as countRedactions for JSON values.
 */
export function countRedactionsShared(value: unknown): number {
  if (typeof value !== "object" || value === null) return countRedactions(value);
  const cached = counts.get(value);
  if (cached !== undefined) return cached;
  const children = Array.isArray(value) ? value : Object.values(value as Record<string, unknown>);
  let n = 0;
  for (const child of children) n += countRedactionsShared(child);
  counts.set(value, n);
  return n;
}

/** Backend bookkeeping copies of the body (never shown or edited, so never re-entered). */
const HIDDEN_TOP_LEVEL = new Set(["data_raw", "data_type"]);

/** Redactions the user can see and re-enter: countRedactionsShared over the visible top-level fields. */
export function countVisibleRedactionsShared(parsed: unknown): number {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return countRedactionsShared(parsed);
  let n = 0;
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!HIDDEN_TOP_LEVEL.has(key)) n += countRedactionsShared(value);
  }
  return n;
}
