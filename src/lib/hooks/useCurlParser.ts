import { useState } from "react";
import { curlApi } from "@/lib/api/curl";
import { normalizeParsedCurl } from "@/lib/utils/curl";
import type { ParsedCurl, FilterState } from "@/types/curl";

/**
 * Custom hook for parsing cURL commands
 * Manages parsing state, error handling, and filter state
 */
export const useCurlParser = () => {
  const [parsed, setParsed] = useState<ParsedCurl | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<FilterState>({});

  /**
   * Parse a cURL command string
   */
  const parseCurl = async (curlCommand: string) => {
    setError("");
    setParsed(null);
    setLoading(true);

    try {
      const result = await curlApi.parse(curlCommand);

      // Handle error response
      if (!result?.success && result?.error) {
        setError(result.error);
        return;
      }

      // Extract and validate raw data
      let raw: any;

      if (Array.isArray(result.data)) {
        // Handle array response - get first element
        if (result.data.length === 0) {
          setError("Server returned empty data array");
          return;
        }
        raw = result.data[0];
      } else if (result.data) {
        // Handle single object response
        raw = result.data;
      } else {
        // Fallback: use result itself if data is missing
        raw = result;
      }

      // Additional validation: ensure raw is not undefined
      if (!raw) {
        setError("No valid data received from server");
        return;
      }

      // Normalize the parsed data
      const normalized = normalizeParsedCurl(raw);

      if (!normalized) {
        setError("Failed to normalize parsed data");
        return;
      }

      setParsed(normalized);
      setSelectedKeys({}); // Reset filters on new parse
    } catch (err: any) {
      console.error("cURL parse error:", err);
      setError(err.message || "Failed to parse cURL command");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Reset all state to initial values
   */
  const reset = () => {
    setParsed(null);
    setError("");
    setSelectedKeys({});
    setLoading(false);
  };

  return {
    parsed,
    error,
    loading,
    selectedKeys,
    setSelectedKeys,
    parseCurl,
    reset,
  };
};