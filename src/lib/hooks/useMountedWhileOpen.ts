import { useEffect, useState } from "react";

/**
 * True while `open`, and for `exitMs` after it turns false so a dialog's exit animation and
 * focus return can finish. A dialog rendered only while this is true does none of its work
 * (stringifying, masking, diffing the request) while it is closed: mounted but closed, each one
 * redid that work on every editor render, which with a multi-MB body cost seconds per edit.
 */
export function useMountedWhileOpen(open: boolean, exitMs = 300): boolean {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const timer = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(timer);
  }, [open, exitMs]);
  return open || mounted;
}
