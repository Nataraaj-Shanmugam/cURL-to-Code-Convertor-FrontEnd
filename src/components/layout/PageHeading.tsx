import { createContext, useContext } from "react";

/**
 * Which heading element a page's main title should be. Pages own an <h1>; the shell sets this to
 * "h2" for a route (the batch editor) whose own <h1> is rendered by the shell, so a title that is
 * shared with the single-request editor never produces two <h1>s.
 */
const PageHeadingLevelContext = createContext<"h1" | "h2">("h1");

export const PageHeadingLevelProvider = PageHeadingLevelContext.Provider;

export function usePageHeadingLevel() {
  return useContext(PageHeadingLevelContext);
}
