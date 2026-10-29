import { useState } from "react";
import { apiClient } from "@/lib/api/apiClient";
import { ENV } from "@/lib/env";

// Convert a dot-notation path like "data.user.name" to the backend path format.
// The backend expects the path relative to the body (without "data." prefix).
export const toBodyPath = (path: string): string =>
  path.startsWith("data.") ? path.slice(5) : path;

/**
 * Mirrors body edits/deletes to the backend. This is advisory: callers apply the edit locally
 * first and must not depend on the result. With `enabled` false (the default, see
 * `ENV.BODY_API_ENABLED`) no request is made and both calls resolve `true`.
 */
export const useBodyApi = (getBody: () => unknown, enabled: boolean = ENV.BODY_API_ENABLED) => {
  const [bodyApiLoading, setBodyApiLoading] = useState(false);
  const [bodyApiError, setBodyApiError] = useState<string | null>(null);

  const editBodyNode = async (path: string, value: unknown): Promise<boolean> => {
    if (!enabled) return true;
    setBodyApiLoading(true);
    setBodyApiError(null);
    try {
      const { data: result } = await apiClient.post(ENV.BODY_EDIT_ENDPOINT, {
        body: getBody(),
        path: toBodyPath(path),
        value,
      });
      if (result.success !== false) return true;
      const errMsg =
        typeof result.error === "object"
          ? (result.error as { message?: string }).message
          : result.error || "Edit failed";
      setBodyApiError(errMsg);
      return false;
    } catch (err: unknown) {
      setBodyApiError(err instanceof Error ? err.message : "Failed to edit body node");
      return false;
    } finally {
      setBodyApiLoading(false);
    }
  };

  const deleteBodyNode = async (path: string): Promise<boolean> => {
    if (!enabled) return true;
    setBodyApiLoading(true);
    setBodyApiError(null);
    try {
      const { data: result } = await apiClient.post(ENV.BODY_DELETE_ENDPOINT, {
        body: getBody(),
        path: toBodyPath(path),
      });
      if (result.success !== false) return true;
      const errMsg =
        typeof result.error === "object"
          ? (result.error as { message?: string }).message
          : result.error || "Delete failed";
      setBodyApiError(errMsg);
      return false;
    } catch (err: unknown) {
      setBodyApiError(err instanceof Error ? err.message : "Failed to delete body node");
      return false;
    } finally {
      setBodyApiLoading(false);
    }
  };

  return { bodyApiLoading, bodyApiError, editBodyNode, deleteBodyNode };
};
