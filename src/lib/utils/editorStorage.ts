/**
 * Saved editor state: lets a reload of /editor restore the request for the current browser session.
 *
 * - Lives in sessionStorage (gone when the tab closes), never localStorage.
 * - Secrets are redacted before they are written, and again when they are read.
 * - Entries expire after EDITOR_STATE_TTL_MS.
 * - The old localStorage entry (which held raw secrets forever) is deleted, or migrated in redacted form.
 */
import type { ParsedCurl } from "@/types/curl";
import { redactCurlString, redactParsedCurl } from "@/lib/utils/redaction";

export const EDITOR_STORAGE_KEY = "curlcraft_editor_state";
export const EDITOR_STATE_VERSION = 2;
export const EDITOR_STATE_TTL_MS = 8 * 60 * 60 * 1000;

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

/** The saved (redacted) request, or null when there is none, it is unreadable, or it has expired. */
export function loadEditorState(now: number = Date.now()): EditorSnapshot | null {
  migrateLegacyEditorState(now);
  const store = sessionStore();
  if (!store) return null;
  try {
    const raw = store.getItem(EDITOR_STORAGE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Partial<StoredEditorState>;
    if (
      entry.version !== EDITOR_STATE_VERSION ||
      typeof entry.savedAt !== "number" ||
      now - entry.savedAt > EDITOR_STATE_TTL_MS ||
      !isParsedShape(entry.parsed)
    ) {
      store.removeItem(EDITOR_STORAGE_KEY);
      return null;
    }
    // Redact again on the way out: anything that reached storage by another route is still scrubbed.
    return redactSnapshot({
      parsed: entry.parsed,
      originalCurl: typeof entry.originalCurl === "string" ? entry.originalCurl : undefined,
    });
  } catch {
    return null;
  }
}

/**
 * React Router keeps the `navigate('/editor', { state })` payload in `window.history.state`, which the
 * browser holds for the life of the tab (it survives a reload and can be written to disk for session
 * restore). Replace it, in place, with the redacted payload. The router is not notified, so the editor
 * keeps working with the live values for this visit; a reload or a Back/Forward visit gets the redacted copy.
 */
export function redactHistoryState(): void {
  try {
    const current = window.history.state as { usr?: { parsed?: unknown; originalCurl?: unknown } } | null;
    const usr = current?.usr;
    if (!current || !usr || !isParsedShape(usr.parsed)) return;
    const redacted = redactSnapshot({
      parsed: usr.parsed,
      originalCurl: typeof usr.originalCurl === "string" ? usr.originalCurl : undefined,
    });
    window.history.replaceState({ ...current, usr: { ...usr, ...redacted } }, "");
  } catch {
    // history unavailable: nothing to do
  }
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
