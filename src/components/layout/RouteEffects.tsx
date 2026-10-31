import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

// Lazy routes render their <h1> only once their chunk has loaded, which can take a while on a slow link.
const FOCUS_GIVE_UP_MS = 10_000;

/**
 * Per-navigation housekeeping for a single-page app, none of which the browser does for us:
 *  - focus moves to the page's <h1> (WCAG 2.4.3), instead of staying on a control that is gone.
 * The first render is left alone: on a fresh load the browser's focus and scroll are correct.
 */
export default function RouteEffects() {
  const { pathname } = useLocation();
  // Compared by value, not a "first run" flag, so StrictMode's second effect run on load is a no-op too.
  const lastPath = useRef(pathname);

  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    let done = false;
    const focusHeading = () => {
      const heading = document.querySelector<HTMLElement>("#main-content h1");
      if (!heading) return;
      finish();
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    };
    // Wait for the heading with an observer, and stop waiting once the user has taken over.
    const observer = new MutationObserver(focusHeading);
    const timer = setTimeout(() => finish(), FOCUS_GIVE_UP_MS);
    const finish = () => {
      if (done) return;
      done = true;
      observer.disconnect();
      clearTimeout(timer);
      window.removeEventListener("keydown", finish, true);
      window.removeEventListener("pointerdown", finish, true);
    };
    window.addEventListener("keydown", finish, true);
    window.addEventListener("pointerdown", finish, true);
    observer.observe(document.body, { childList: true, subtree: true });
    focusHeading();
    return finish;
    // Only the path matters: state changes on the same page must not steal focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}
