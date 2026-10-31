/**
 * The batch editor's route state (`navigate('/batch-editor', { state: { items, failures } })`).
 *
 * React Router keeps that payload in `window.history.state`, which survives a reload and can be
 * written to disk for session restore, so it is replaced there by a redacted copy as soon as the page
 * mounts (as the single editor does, see editorStorage). The live values stay in memory only
 * (liveRequestStore): an in-app Back/Forward gets them back, a reload gets the redacted copy.
 */
import type { BatchParseFailure, ParsedCurlEntry } from "@/types/batch";
import { redactCurlString, redactParsedCurl, redactText } from "@/lib/utils/redaction";
import { recallLiveRequest, rememberLiveRequest } from "@/lib/utils/liveRequestStore";

export const BATCH_LIVE_SLOT = "batch";

export interface BatchSnapshot {
  items: ParsedCurlEntry[];
  failures: BatchParseFailure[];
}

interface BatchRouteState {
  items?: unknown;
  failures?: unknown;
  /** Set on the copy left in history.state; never on a fresh navigation payload. */
  redacted?: boolean;
  savedAt?: number;
}

export interface BatchRestore extends BatchSnapshot {
  /** "live": real values; "redacted": only placeholders are left for the secrets. */
  source: "live" | "redacted" | "none";
}

function isEntry(value: unknown): value is ParsedCurlEntry {
  return typeof value === "object" && value !== null && typeof (value as ParsedCurlEntry).parsed === "object";
}

function isFailure(value: unknown): value is BatchParseFailure {
  return typeof value === "object" && value !== null && typeof (value as BatchParseFailure).index === "number";
}

function snapshotOf(state: BatchRouteState | null): BatchSnapshot {
  return {
    items: Array.isArray(state?.items) ? state.items.filter(isEntry) : [],
    failures: Array.isArray(state?.failures) ? state.failures.filter(isFailure) : [],
  };
}

export function redactBatchSnapshot(snapshot: BatchSnapshot): BatchSnapshot {
  return {
    items: snapshot.items.map((entry) => ({
      ...entry,
      parsed: redactParsedCurl(entry.parsed),
      originalCurl: typeof entry.originalCurl === "string" ? redactCurlString(entry.originalCurl) : entry.originalCurl,
    })),
    failures: snapshot.failures.map((failure) => ({
      ...failure,
      curl: typeof failure.curl === "string" ? redactCurlString(failure.curl) : failure.curl,
      // Parser messages can quote the offending input.
      message: typeof failure.message === "string" ? redactText(failure.message) : failure.message,
    })),
  };
}

function sameBatch(a: BatchSnapshot, b: BatchSnapshot): boolean {
  return JSON.stringify(redactBatchSnapshot(a)) === JSON.stringify(redactBatchSnapshot(b));
}

/**
 * What the batch editor shows for this visit, given the router's location.state: a fresh navigation
 * payload as is; the redacted copy from history.state upgraded to the live values when they are still
 * in memory and describe the same batch. Never writes.
 */
export function resolveBatchRestore(routeState: unknown, now: number = Date.now()): BatchRestore {
  const state = (routeState && typeof routeState === "object" ? routeState : null) as BatchRouteState | null;
  const snapshot = snapshotOf(state);
  if (snapshot.items.length === 0 && snapshot.failures.length === 0) return { source: "none", ...snapshot };
  if (state?.redacted !== true) return { source: "live", ...snapshot };
  const live = recallLiveRequest<BatchSnapshot>(BATCH_LIVE_SLOT, now);
  if (live && sameBatch(live, snapshot)) return { source: "live", ...live };
  return { source: "redacted", ...redactBatchSnapshot(snapshot) };
}

/** Keeps the live batch in memory (never persisted). */
export function rememberBatchRequest(snapshot: BatchSnapshot, now: number = Date.now()): void {
  rememberLiveRequest(BATCH_LIVE_SLOT, snapshot, now);
}

/** Replaces the batch payload in the current history entry with its redacted copy. Router bookkeeping stays. */
export function redactBatchHistoryState(now: number = Date.now()): void {
  try {
    const current = window.history.state as ({ usr?: BatchRouteState } & Record<string, unknown>) | null;
    const usr = current?.usr;
    if (!current || !usr || typeof usr !== "object" || (!Array.isArray(usr.items) && !Array.isArray(usr.failures))) return;
    const redacted = redactBatchSnapshot(snapshotOf(usr));
    window.history.replaceState({ ...current, usr: { ...usr, ...redacted, redacted: true, savedAt: now } }, "");
  } catch {
    // history unavailable: nothing to do
  }
}
