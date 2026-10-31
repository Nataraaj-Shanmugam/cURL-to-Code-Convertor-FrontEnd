/**
 * App-wide backend status. The hosted backend sleeps when idle, so on every app load (any route)
 * this polls the health endpoint until the backend answers, and tells the UI where it stands:
 *
 *   checking ──(answers quickly)──────────────────────────▶ ready
 *      │                                                     ▲
 *      └─(probe fails, or is still pending after 2 s)─▶ waking ─┤ (answers)
 *                                                       │
 *                                     (no answer in 90 s)▼
 *                                                  unavailable ──retry()──▶ checking
 *
 * Any real response seen by the API client also marks the backend ready, and running out of
 * retries on a request while "ready" triggers a fresh check.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiClient, ApiError, onBackendSignal } from "@/lib/api/apiClient";
import { ENV } from "@/lib/env";

export type BackendStatus = "checking" | "waking" | "ready" | "unavailable";

export interface BackendStatusState {
  status: BackendStatus;
  /** When the current wake-up began (ms since epoch); null unless waking. */
  wakingSince: number | null;
}

export type BackendStatusEvent =
  /** The first probe of a check is taking long enough that the backend is probably asleep. */
  | { type: "slow"; at: number }
  | { type: "probe-failed"; at: number }
  | { type: "probe-ok" }
  /** The API client saw a real response from the backend. */
  | { type: "signal-up" }
  | { type: "gave-up" }
  /** Start a new check (app load, Retry, or a request that ran out of retries). */
  | { type: "recheck" };

export const initialBackendStatus: BackendStatusState = { status: "checking", wakingSince: null };

const isChecking = (status: BackendStatus) => status === "checking" || status === "waking";

export function backendStatusReducer(
  state: BackendStatusState,
  event: BackendStatusEvent
): BackendStatusState {
  switch (event.type) {
    case "slow":
      return state.status === "checking" ? { status: "waking", wakingSince: event.at } : state;
    case "probe-failed":
      // A probe that started before something else proved the backend awake must not undo that.
      return isChecking(state.status)
        ? { status: "waking", wakingSince: state.wakingSince ?? event.at }
        : state;
    case "probe-ok":
    case "signal-up":
      return state.status === "ready" ? state : { status: "ready", wakingSince: null };
    case "gave-up":
      return isChecking(state.status) ? { status: "unavailable", wakingSince: null } : state;
    case "recheck":
      return { status: "checking", wakingSince: null };
  }
}

export interface BackendStatusTiming {
  /** A first probe still pending after this long shows "waking". */
  slowProbeMs: number;
  /** Stop polling and report "unavailable" after this long. */
  wakeBudgetMs: number;
  /** Per-probe timeout (the client raises it to its cold-start floor while the backend may be asleep). */
  probeTimeoutMs: number;
  /** Delay between failed probes: doubles from base up to max. */
  pollBaseDelayMs: number;
  pollMaxDelayMs: number;
}

export const DEFAULT_BACKEND_TIMING: BackendStatusTiming = {
  slowProbeMs: 2_000,
  wakeBudgetMs: 90_000,
  probeTimeoutMs: 15_000,
  pollBaseDelayMs: 1_000,
  pollMaxDelayMs: 3_000,
};

/** Expected wake-up time, used for the progress estimate ("usually under a minute"). */
export const EXPECTED_WAKE_MS = 60_000;

export interface BackendStatusContextValue extends BackendStatusState {
  /** Start a new check now (used by Retry buttons). */
  retry: () => void;
  /**
   * Resolves once the backend is ready. If it is unavailable, starts a new check first. Rejects
   * with an ApiError if the check gives up (kind "network") or the signal aborts (kind "aborted").
   */
  waitUntilReady: (signal?: AbortSignal) => Promise<void>;
}

/**
 * Without a provider (components rendered on their own, e.g. in unit tests) the backend is
 * assumed ready and requests go straight out; the API client still retries them.
 */
const assumeReady: BackendStatusContextValue = {
  status: "ready",
  wakingSince: null,
  retry: () => {},
  waitUntilReady: () => Promise.resolve(),
};

const BackendStatusContext = createContext<BackendStatusContextValue>(assumeReady);

export function useBackendStatus(): BackendStatusContextValue {
  return useContext(BackendStatusContext);
}

type Probe = "up" | "down";

async function probeHealth(timeout: number, signal: AbortSignal): Promise<Probe> {
  try {
    await apiClient.get(ENV.HEALTH_ENDPOINT, { retries: 0, allowEmpty: true, timeout, signal });
    return "up";
  } catch (err) {
    // A 4xx is the backend itself answering (e.g. a health path it doesn't serve): it is awake.
    if (err instanceof ApiError && err.kind === "http" && err.status !== undefined && err.status < 500) {
      if (import.meta.env.DEV) {
        console.warn(
          `[backend-status] ${ENV.HEALTH_ENDPOINT} answered ${err.status}; treating the backend as awake. ` +
            "Check VITE_CURL_CRAFT_API_HEALTH_ENDPOINT."
        );
      }
      return "up";
    }
    return "down";
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const id = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(id);
      resolve();
    });
  });
}

interface Waiter {
  resolve: () => void;
  reject: (err: ApiError) => void;
}

export function BackendStatusProvider({
  children,
  timing,
}: {
  children: ReactNode;
  timing?: Partial<BackendStatusTiming>;
}) {
  const [state, dispatch] = useReducer(backendStatusReducer, initialBackendStatus);
  // Each increment starts a new probe loop (and cancels the previous one).
  const [checkId, setCheckId] = useState(0);
  const statusRef = useRef(state.status);
  statusRef.current = state.status;
  const waitersRef = useRef(new Set<Waiter>());

  const timingRef = useRef({ ...DEFAULT_BACKEND_TIMING, ...timing });
  timingRef.current = { ...DEFAULT_BACKEND_TIMING, ...timing };

  const retry = useCallback(() => {
    dispatch({ type: "recheck" });
    setCheckId((id) => id + 1);
  }, []);

  // Probe loop.
  useEffect(() => {
    const t = timingRef.current;
    const controller = new AbortController();
    const startedAt = Date.now();
    const slowTimer = setTimeout(() => dispatch({ type: "slow", at: Date.now() }), t.slowProbeMs);

    void (async () => {
      for (let failures = 0; !controller.signal.aborted; failures++) {
        const result = await probeHealth(t.probeTimeoutMs, controller.signal);
        if (controller.signal.aborted) return;
        if (result === "up") {
          dispatch({ type: "probe-ok" });
          return;
        }
        dispatch({ type: "probe-failed", at: Date.now() });
        if (Date.now() - startedAt >= t.wakeBudgetMs) {
          dispatch({ type: "gave-up" });
          return;
        }
        await sleep(Math.min(t.pollMaxDelayMs, t.pollBaseDelayMs * 2 ** failures), controller.signal);
        // Something else (a successful request) may have proved the backend awake meanwhile.
        if (statusRef.current === "ready") return;
      }
    })().finally(() => clearTimeout(slowTimer));

    return () => {
      controller.abort();
      clearTimeout(slowTimer);
    };
  }, [checkId]);

  // Signals from the API client.
  useEffect(
    () =>
      onBackendSignal((signal) => {
        if (signal === "up") dispatch({ type: "signal-up" });
        else if (statusRef.current === "ready") retry();
      }),
    [retry]
  );

  // Settle anyone waiting for the backend.
  useEffect(() => {
    if (state.status !== "ready" && state.status !== "unavailable") return;
    const waiters = [...waitersRef.current];
    waitersRef.current.clear();
    if (state.status === "ready") {
      waiters.forEach((w) => w.resolve());
    } else {
      const err = new ApiError(
        "The generator didn't wake up. It may be down for maintenance; please try again in a minute.",
        { kind: "network", retryable: true }
      );
      waiters.forEach((w) => w.reject(err));
    }
  }, [state.status]);

  const waitUntilReady = useCallback(
    (signal?: AbortSignal) => {
      if (statusRef.current === "ready") return Promise.resolve();
      if (signal?.aborted) {
        return Promise.reject(new ApiError("The request was cancelled.", { kind: "aborted" }));
      }
      if (statusRef.current === "unavailable") retry();
      return new Promise<void>((resolve, reject) => {
        const waiter: Waiter = {
          resolve: () => {
            signal?.removeEventListener("abort", onAbort);
            resolve();
          },
          reject: (err) => {
            signal?.removeEventListener("abort", onAbort);
            reject(err);
          },
        };
        const onAbort = () => {
          waitersRef.current.delete(waiter);
          reject(new ApiError("The request was cancelled.", { kind: "aborted" }));
        };
        signal?.addEventListener("abort", onAbort, { once: true });
        waitersRef.current.add(waiter);
      });
    },
    [retry]
  );

  const value = useMemo<BackendStatusContextValue>(
    () => ({ ...state, retry, waitUntilReady }),
    [state, retry, waitUntilReady]
  );

  return <BackendStatusContext.Provider value={value}>{children}</BackendStatusContext.Provider>;
}
