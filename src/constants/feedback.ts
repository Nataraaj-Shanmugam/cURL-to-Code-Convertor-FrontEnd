export const RATING_LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"] as const;

/** Values are the backend's category codes (production contract); do not rename them. */
export const FEEDBACK_CATEGORIES = [
  { value: "ui_ux", label: "UI/UX issue" },
  { value: "bug", label: "Functionality bug" },
  { value: "performance", label: "Performance issue" },
  { value: "feature", label: "Feature request" },
  { value: "documentation", label: "Documentation" },
  { value: "other", label: "Other" },
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]["value"];

/** Route state for /feedback: "Report this cURL" on a parse error fills these in. */
export interface FeedbackLocationState {
  category?: FeedbackCategory;
  /** Already redacted by the sender: it is route state, which outlives a reload in history.state. */
  curlCommand?: string;
}

export const FEEDBACK_DETAILS_MIN = 10;
export const FEEDBACK_DETAILS_MAX = 2000;
