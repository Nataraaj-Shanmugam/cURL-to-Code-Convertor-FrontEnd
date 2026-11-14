import { useEffect } from "react";
import { toast } from "sonner";
import { onRateLimit, rateLimitRemainingMs } from "@/lib/api/apiClient";

/** Toast id, so a new 429 updates the one notice instead of stacking several. */
export const RATE_LIMIT_TOAST_ID = "rate-limit";

export function rateLimitMessage(remainingMs: number): string {
  const seconds = Math.max(1, Math.ceil(remainingMs / 1000));
  return `Rate limited by the generator, retrying in ${seconds}s`;
}

/**
 * While the API client waits out a 429 (see onRateLimit), shows "Rate limited by the generator,
 * retrying in Ns", counting down; it goes away when requests are let through again. Renders nothing.
 */
export default function RateLimitNotice() {
  useEffect(() => {
    let ticker: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      clearInterval(ticker);
      ticker = undefined;
    };
    const show = () => {
      const remaining = rateLimitRemainingMs();
      if (remaining <= 0) return;
      toast.info(rateLimitMessage(remaining), { id: RATE_LIMIT_TOAST_ID, duration: Infinity });
    };
    const unsubscribe = onRateLimit((state) => {
      stop();
      if (!state) {
        toast.dismiss(RATE_LIMIT_TOAST_ID);
        return;
      }
      show();
      ticker = setInterval(show, 1000);
    });
    return () => {
      stop();
      unsubscribe();
    };
  }, []);
  return null;
}
