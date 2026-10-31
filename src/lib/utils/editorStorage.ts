/**
 * Saved editor state: lets a reload of /editor restore the request for the current browser session.
 *
 * - Lives in sessionStorage (gone when the tab closes), never localStorage.
 * - Secrets are redacted before they are written, and again when they are read.
 * - Entries expire EDITOR_STATE_TTL_MS after the last activity in the editor (see touchEditorRestore).
 * - The old localStorage entry (which held raw secrets forever) is deleted, or migrated in redacted form.
 *
 * The live values are kept only in memory (liveRequestStore). resolveEditorRestore picks the best
 * source for a visit: the router's fresh payload, else a redacted copy upgraded to the live one when
 * it is the same request.
 */
import type { ParsedCurl } from "@/types/curl";
import { redactCurlString, redactParsedCurl } from "@/lib/utils/redaction";
import {
  LIVE_REQUEST_TTL_MS,
  forgetLiveRequest,
  recallLiveRequest,
  rememberLiveRequest,
  touchLiveRequest,
} from "@/lib/utils/liveRequestStore";

export const EDITOR_STORAGE_KEY = "curlcraft_editor_state";
export const EDITOR_STATE_VERSION = 2;
export const EDITOR_STATE_TTL_MS = LIVE_REQUEST_TTL_MS;

/** Slot of the single editor's request in the in-memory live store. */
export const EDITOR_LIVE_SLOT = "editor";

export interface EditorSnapshot {
  parsed: ParsedCurl;
  originalCurl?: string;
}

interface StoredEditorState extends EditorSnapshot {
  version: number;
  savedAt: number;
}

function sessionStore(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function localStore(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isParsedShape(value: unknown): value is ParsedCurl {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function redactSnapshot(snapshot: EditorSnapshot): EditorSnapshot {
  return {
    parsed: redactParsedCurl(snapshot.parsed),
    originalCurl: typeof snapshot.originalCurl === "string" ? redactCurlString(snapshot.originalCurl) : undefined,
  };
}

/** Writes a redacted copy of the request to sessionStorage. Returns false when it could not be saved. */
export function saveEditorState(parsed: ParsedCurl, originalCurl?: string, now: number = Date.now()): boolean {
  const store = sessionStore();
  if (!store) return false;
  try {
    const entry: StoredEditorState = {
      version: EDITOR_STATE_VERSION,
      savedAt: now,
      ...redactSnapshot({ parsed, originalCurl }),
    };
    store.setItem(EDITOR_STORAGE_KEY, JSON.stringify(entry));
    return true;
  } catch {
    return false; // storage full or blocked
  }
}

/** Removes the legacy localStorage entry, carrying it over (redacted) when there is nothing newer. */
export function migrateLegacyEditorState(now: number = Date.now()): void {
  const local = localStore();
  if (!local) return;
  let legacy: string | null = null;
  try {
    legacy = local.getItem(EDITOR_STORAGE_KEY);
  } catch {
    return;
  }
  if (legacy === null) return;

  try {
    const session = sessionStore();
    if (session && session.getItem(EDITOR_STORAGE_KEY) === null) {
      const old = JSON.parse(legacy) as { parsed?: unknown; originalCurl?: unknown };
      if (isParsedShape(old.parsed)) {
        saveEditorState(old.parsed, typeof old.originalCurl === "string" ? old.originalCurl : undefined, now);
      }
    }
  } catch {
    // unreadable legacy data: just drop it
  }
  try {
    local.removeItem(EDITOR_STORAGE_KEY);
  } catch {
    // ignore
  }
}

type LoadResult = { snapshot: EditorSnapshot; expired: false } | { snapshot: null; expired: boolean };

function loadEditorStateDetailed(now: number): LoadResult {
  migrateLegacyEditorState(now);
  const store = sessionStore();
  if (!store) return { snapshot: null, expired: false };
  try {
    const raw = store.getItem(EDITOR_STORAGE_KEY);
    if (!raw) return { snapshot: null, expired: false };
    const entry = JSON.parse(raw) as Partial<StoredEditorState>;
    if (entry.version !== EDITOR_STATE_VERSION || typeof entry.savedAt !== "number" || !isParsedShape(entry.parsed)) {
      store.removeItem(EDITOR_STORAGE_KEY);
      return { snapshot: null, expired: false };
    }
    if (now - entry.savedAt > EDITOR_STATE_TTL_MS) {
      store.removeItem(EDITOR_STORAGE_KEY);
      return { snapshot: null, expired: true };
    }
    // Redact again on the way out: anything that reached storage by another route is still scrubbed.
    const snapshot = redactSnapshot({
      parsed: entry.parsed,
      originalCurl: typeof entry.originalCurl === "string" ? entry.originalCurl : undefined,
    });
    return { snapshot, expired: false };
  } catch {
    return { snapshot: null, expired: false };
  }
}

/** The saved (redacted) request, or null when there is none, it is unreadable, or it has expired. */
export function loadEditorState(now: number = Date.now()): EditorSnapshot | null {
  return loadEditorStateDetailed(now).snapshot;
}

/** Restarts the expiry of the saved copy (activity in the editor). */
function touchEditorState(now: number): void {
  const store = sessionStore();
  if (!store) return;
  try {
    const raw = store.getItem(EDITOR_STORAGE_KEY);
    if (!raw) return;
    const entry = JSON.parse(raw) as Partial<StoredEditorState>;
    if (entry.version !== EDITOR_STATE_VERSION || typeof entry.savedAt !== "number") return;
    store.setItem(EDITOR_STORAGE_KEY, JSON.stringify({ ...entry, savedAt: now }));
  } catch {
    // ignore
  }
}

/**
 * Route state as it comes back from `window.history.state` after redactHistoryState: redacted, and
 * stamped so a later visit can tell it from a fresh navigation and apply the TTL to it.
 */
interface HistoryEditorState {
  parsed?: unknown;
  originalCurl?: unknown;
  /** Set on the copy redactHistoryState leaves in history; never on a fresh navigation payload. */
  redacted?: boolean;
  /** Last activity, for the TTL. */
  savedAt?: number;
}

type HistoryEntry = { usr?: HistoryEditorState } & Record<string, unknown>;

function currentHistoryEntry(): HistoryEntry | null {
  try {
    const current = window.history.state as HistoryEntry | null;
    return current && typeof current === "object" ? current : null;
  } catch {
    return null;
  }
}

function replaceHistoryEntry(entry: HistoryEntry): void {
  try {
    window.history.replaceState(entry, "");
  } catch {
    // history unavailable: nothing to do
  }
}

/**
 * React Router keeps the `navigate('/editor', { state })` payload in `window.history.state`, which the
 * browser holds for the life of the tab (it survives a reload and can be written to disk for session
 * restore). Replace it, in place, with the redacted payload. The router is not notified, so the editor
 * keeps working with the live values for this visit; a reload or a Back/Forward visit gets the redacted
 * copy (upgraded to the live values from memory when they are still there, see resolveEditorRestore).
 */
export function redactHistoryState(now: number = Date.now()): void {
  const current = currentHistoryEntry();
  const usr = current?.usr;
  if (!current || !usr || !isParsedShape(usr.parsed)) return;
  const redacted = redactSnapshot({
    parsed: usr.parsed,
    originalCurl: typeof usr.originalCurl === "string" ? usr.originalCurl : undefined,
  });
  replaceHistoryEntry({ ...current, usr: { ...usr, ...redacted, redacted: true, savedAt: now } });
}

/** Removes the request from the current history entry, keeping the router's own bookkeeping. */
function stripHistoryState(): void {
  const current = currentHistoryEntry();
  const usr = current?.usr;
  if (!current || !usr || typeof usr !== "object" || !("parsed" in usr)) return;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { parsed, originalCurl, redacted, savedAt, ...rest } = usr;
  replaceHistoryEntry({ ...current, usr: rest });
}

export type EditorRestoreSource =
  /** Live values: a fresh navigation, or a redacted copy matched to the live copy still in memory. */
  | "live"
  /** Only a redacted copy exists (reload, new document): secrets must be re-entered. */
  | "redacted"
  /** A saved copy existed but its TTL ran out. */
  | "expired"
  | "none";

export interface EditorRestore {
  source: EditorRestoreSource;
  snapshot: EditorSnapshot | null;
}

function sameRequest(a: EditorSnapshot, b: EditorSnapshot): boolean {
  return JSON.stringify(redactSnapshot(a)) === JSON.stringify(redactSnapshot(b));
}

/** A redacted copy, swapped for the in-memory live copy when that is the same request. */
function preferLive(redacted: EditorSnapshot, now: number): EditorRestore {
  const live = recallLiveRequest<EditorSnapshot>(EDITOR_LIVE_SLOT, now);
  if (live && sameRequest(live, redacted)) return { source: "live", snapshot: live };
  return { source: "redacted", snapshot: redacted };
}

/**
 * Decides what the editor shows for this visit, given the router's location.state:
 *  1. a fresh navigation payload (live values);
 *  2. the redacted copy in history.state (Back/Forward, reload), unless it has expired;
 *  3. the redacted copy in sessionStorage, unless it has expired.
 * A redacted copy is upgraded to the live values when they are still in memory. Never writes.
 */
export function resolveEditorRestore(routeState: unknown, now: number = Date.now()): EditorRestore {
  const usr = (routeState && typeof routeState === "object" ? routeState : null) as HistoryEditorState | null;
  if (usr && isParsedShape(usr.parsed)) {
    const snapshot: EditorSnapshot = {
      parsed: usr.parsed,
      originalCurl: typeof usr.originalCurl === "string" ? usr.originalCurl : undefined,
    };
    if (usr.redacted !== true) return { source: "live", snapshot };
    if (typeof usr.savedAt !== "number" || now - usr.savedAt <= EDITOR_STATE_TTL_MS) {
      return preferLive(redactSnapshot(snapshot), now);
    }
    return { source: "expired", snapshot: null };
  }
  const loaded = loadEditorStateDetailed(now);
  if (loaded.snapshot) return preferLive(loaded.snapshot, now);
  return { source: loaded.expired ? "expired" : "none", snapshot: null };
}

/** Keeps the live values of the request on screen in memory (never persisted). */
export function rememberEditorRequest(snapshot: EditorSnapshot, now: number = Date.now()): void {
  rememberLiveRequest(EDITOR_LIVE_SLOT, snapshot, now);
}

/** Activity in the editor: restarts the TTL of the saved, history and in-memory copies. */
export function touchEditorRestore(now: number = Date.now()): void {
  touchEditorState(now);
  touchLiveRequest(EDITOR_LIVE_SLOT, now);
  const current = currentHistoryEntry();
  const usr = current?.usr;
  if (current && usr?.redacted === true) replaceHistoryEntry({ ...current, usr: { ...usr, savedAt: now } });
}

/**
 * Forgets the request everywhere it is kept: sessionStorage (and legacy localStorage), the copy in
 * the current history entry and the in-memory live copy. A reload or a later Forward to this entry
 * then finds nothing to restore.
 */
export function clearEditorRestore(): void {
  clearEditorState();
  stripHistoryState();
  forgetLiveRequest(EDITOR_LIVE_SLOT);
}

/** Deletes the saved request (and any legacy localStorage copy). */
export function clearEditorState(): void {
  try {
    sessionStore()?.removeItem(EDITOR_STORAGE_KEY);
  } catch {
    // ignore
  }
  try {
    localStore()?.removeItem(EDITOR_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function hasSavedEditorState(): boolean {
  try {
    return sessionStore()?.getItem(EDITOR_STORAGE_KEY) != null;
  } catch {
    return false;
  }
}
