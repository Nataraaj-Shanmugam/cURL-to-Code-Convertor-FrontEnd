// src/contexts/BackendStatusContext.tsx
import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";

type BackendStatus = "checking" | "ready" | "warning" | "down";

interface BackendStatusContextType {
  backendStatus: BackendStatus;

  // Seconds elapsed in the CURRENT warmup attempt
  downtime: number;

  // Attempt number (1..maxRetries). Stays at maxRetries when down.
  attempt: number;
  maxRetries: number;

  // Total seconds allowed per attempt (env minutes -> seconds)
  waitTimeSeconds: number;

  isBackendReady: boolean;
  isBackendDown: boolean;
  isBackendBlocked: boolean; // not ready => block playground
}

const BackendStatusContext = createContext<BackendStatusContextType | undefined>(undefined);

function toNumber(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function BackendStatusProvider({ children }: { children: ReactNode }) {
  const waitMins = toNumber(import.meta.env.VITE_BE_WARMUP_WAIT_MINS, 5);
  const maxRetries = toNumber(import.meta.env.VITE_BE_WARMUP_MAX_RETRIES, 3);
  const waitTimeSeconds = waitMins * 60;

  const [backendStatus, setBackendStatus] = useState<BackendStatus>("checking");
  const [downtime, setDowntime] = useState(0);
  const [attempt, setAttempt] = useState(1);

  const downtimeTimerRef = useRef<number | null>(null);
  const healthIntervalRef = useRef<number | null>(null);
  const rolloverLockRef = useRef(false);

  const stopDowntimeTimer = () => {
    if (downtimeTimerRef.current) {
      clearInterval(downtimeTimerRef.current);
      downtimeTimerRef.current = null;
    }
  };

  const startDowntimeTimerIfNeeded = () => {
    if (downtimeTimerRef.current) return;

    downtimeTimerRef.current = window.setInterval(() => {
      setDowntime((prev) => {
        const next = prev + 1;

        if (next < waitTimeSeconds) {
          rolloverLockRef.current = false;
          return next;
        }

        if (rolloverLockRef.current) {
          return prev;
        }

        rolloverLockRef.current = true;

        setAttempt((a) => {
          if (a < maxRetries) {
            setBackendStatus("warning");
            setDowntime(0);
            return a + 1;
          }

          setBackendStatus("down");
          stopDowntimeTimer();
          return a;
        });

        return prev;
      });
    }, 1000);
  };

  useEffect(() => {
    const healthUrl = `${import.meta.env.VITE_CURL_CRAFT_API_URL}${import.meta.env.VITE_CURL_CRAFT_API_HEALTH_ENDPOINT || "/health"
      }`;

    const checkBackendHealth = async () => {
      try {
        const response = await fetch(healthUrl, { method: "GET" });

        // IMPORTANT: "ready" ONLY when status is exactly 200
        if (response.status === 200) {
          setBackendStatus("ready");
          setAttempt(1);
          setDowntime(0);
          stopDowntimeTimer();
          return;
        }

        // Any non-200 => warming/up/unhealthy
        throw new Error(`Backend unhealthy: ${response.status}`);
      } catch (e) {
        setBackendStatus((prev) => {
          if (prev === "down") return "down";
          // if it was checking/ready/warning and health failed => warning
          startDowntimeTimerIfNeeded();
          return "warning";
        });

      }
    };

    // Initial check
    checkBackendHealth();

    // Poll every 30s
    healthIntervalRef.current = window.setInterval(checkBackendHealth, 30000);

    return () => {
      stopDowntimeTimer();
      if (healthIntervalRef.current) clearInterval(healthIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitTimeSeconds, maxRetries]);

  const value = useMemo<BackendStatusContextType>(() => {
    const isBackendReady = backendStatus === "ready";
    const isBackendDown = backendStatus === "down";
    const isBackendBlocked = !isBackendReady;

    return {
      backendStatus,
      downtime,
      attempt,
      maxRetries,
      waitTimeSeconds,
      isBackendReady,
      isBackendDown,
      isBackendBlocked,
    };
  }, [backendStatus, downtime, attempt, maxRetries, waitTimeSeconds]);

  return <BackendStatusContext.Provider value={value}>{children}</BackendStatusContext.Provider>;
}

export function useBackendStatus() {
  const context = useContext(BackendStatusContext);
  if (context === undefined) {
    throw new Error("useBackendStatus must be used within a BackendStatusProvider");
  }
  return context;
}
