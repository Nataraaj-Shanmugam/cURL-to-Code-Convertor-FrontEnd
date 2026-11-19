import { useCallback, useEffect } from "react";
import { useBlocker } from "react-router-dom";

/**
 * Guards unsaved edits. While `isDirty`:
 *  - closing/reloading the tab triggers the browser's native "leave site?" prompt, and
 *  - in-app navigation to another path (links, Back, browser back/forward) is blocked until
 *    the caller chooses `leave` or `stay`.
 * While clean, neither guard is active. Requires a data router (`RouterProvider`).
 */
export function useUnsavedChangesGuard(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ""; // legacy browsers only show the prompt when this is set
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Same-path navigations (e.g. a search/hash or location-state change) are not "leaving".
  const shouldBlock = useCallback(
    ({
      currentLocation,
      nextLocation,
    }: {
      currentLocation: { pathname: string };
      nextLocation: { pathname: string };
    }) => isDirty && currentLocation.pathname !== nextLocation.pathname,
    [isDirty],
  );
  const blocker = useBlocker(shouldBlock);

  const isBlocked = blocker.state === "blocked";
  const stay = useCallback(() => {
    if (blocker.state === "blocked") blocker.reset();
  }, [blocker]);
  const leave = useCallback(() => {
    if (blocker.state === "blocked") blocker.proceed();
  }, [blocker]);

  return { isBlocked, stay, leave };
}
