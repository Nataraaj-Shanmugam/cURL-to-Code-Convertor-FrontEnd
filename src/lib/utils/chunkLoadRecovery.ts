/**
 * Recovery for lazy route chunks that disappear after a deploy.
 *
 * A tab opened before a deploy still references the old hashed chunk names; once those files are
 * gone, the dynamic import fails. Vite reports that as a `vite:preloadError` event on window. We
 * reload once to pick up the new build. The timestamp guard stops a reload loop when the chunk
 * keeps failing (e.g. a broken deploy): a second failure inside the window is left to the error
 * boundary, which shows a friendly message instead of the raw module URL.
 */

const RELOAD_KEY = 'curlcraft_chunk_reload_at';
const RELOAD_WINDOW_MS = 60_000;

const CHUNK_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError/i;

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return CHUNK_ERROR_PATTERN.test(message);
}

/** Returns true (and records the attempt) when a reload is allowed now. False if storage is unavailable. */
export function claimChunkReload(storage: Storage, now: number): boolean {
  try {
    const last = Number(storage.getItem(RELOAD_KEY));
    if (last && now - last < RELOAD_WINDOW_MS) return false;
    storage.setItem(RELOAD_KEY, String(now));
    return true;
  } catch {
    return false;
  }
}

export function installChunkLoadRecovery(win: Window = window): void {
  win.addEventListener('vite:preloadError', (event) => {
    if (!claimChunkReload(win.sessionStorage, Date.now())) return; // let the error boundary handle it
    event.preventDefault();
    win.location.reload();
  });
}
