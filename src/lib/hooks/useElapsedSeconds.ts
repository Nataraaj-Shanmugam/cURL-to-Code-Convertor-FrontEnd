import { useEffect, useState } from "react";

/** Whole seconds since `since` (ms since epoch), re-rendering once a second; 0 when `since` is null. */
export function useElapsedSeconds(since: number | null): number {
  const compute = () => (since === null ? 0 : Math.max(0, Math.floor((Date.now() - since) / 1000)));
  const [elapsed, setElapsed] = useState(compute);

  useEffect(() => {
    setElapsed(compute());
    if (since === null) return;
    const id = setInterval(() => setElapsed(compute()), 1000);
    return () => clearInterval(id);
    // compute only reads `since`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [since]);

  return elapsed;
}
