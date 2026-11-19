/**
 * In-memory copies of the live (unredacted) requests of this page session.
 *
 * Everything the browser keeps for us (sessionStorage, window.history.state) holds only redacted
 * copies. That is enough to restore the shape of a request but not to generate code from it. This
 * module-level store holds the real values for as long as the document lives: an in-app Back/Forward
 * gets them back, a reload or a new tab does not (the module starts empty again), so a restored
 * request then shows its redacted fields and asks for them to be re-entered.
 *
 * Nothing here is ever serialized. Entries expire LIVE_REQUEST_TTL_MS after their last activity.
 */

export const LIVE_REQUEST_TTL_MS = 8 * 60 * 60 * 1000;

interface Entry {
  value: unknown;
  touchedAt: number;
}

const entries = new Map<string, Entry>();

export function rememberLiveRequest<T>(slot: string, value: T, now: number = Date.now()): void {
  entries.set(slot, { value, touchedAt: now });
}

/** The live copy in `slot`, or null when there is none or it has expired (an expired copy is dropped). */
export function recallLiveRequest<T>(slot: string, now: number = Date.now()): T | null {
  const entry = entries.get(slot);
  if (!entry) return null;
  if (now - entry.touchedAt > LIVE_REQUEST_TTL_MS) {
    entries.delete(slot);
    return null;
  }
  return entry.value as T;
}

/** Marks activity on `slot`, restarting its expiry. */
export function touchLiveRequest(slot: string, now: number = Date.now()): void {
  const entry = entries.get(slot);
  if (entry) entry.touchedAt = now;
}

export function forgetLiveRequest(slot: string): void {
  entries.delete(slot);
}

/** Drops every live copy, as a reload would. */
export function forgetAllLiveRequests(): void {
  entries.clear();
}
