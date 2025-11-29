import { useState } from "react";
import { curlApi } from "@/lib/api/curl";
import { normalizeParsedCurl } from "@/lib/utils/curl";
import type { ParsedCurl, FilterState, ParseCurlResponse } from "@/types/curl";

/**
 * Custom hook for parsing cURL commands
 * Handles loading, error, and normalized parsed state
 */
export const useCurlParser = () => {
  const [parsed, setParsed] = useState<ParsedCurl | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<FilterState>({});

  const parseCurl = async (curlCommand: string) => {
    if (!curlCommand.trim()) {
      setError("Please paste a cURL command.");
      return null;
    }

    setLoading(true);
    setError("");

    try {
      const res: ParseCurlResponse = await curlApi.parse(curlCommand);

      if (!res.success || !res.data) {
        const msg =
          res.error?.message ||
          res.error?.code ||
          "Failed to parse cURL command.";
        throw new Error(msg);
      }

      const normalized = normalizeParsedCurl(res.data);
      setParsed(normalized);
      setSelectedKeys({});
      return normalized;
    } catch (err: any) {
      console.error("parseCurl error:", err);
      setParsed(null);
      setError(err.message || "Unable to parse the cURL command.");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setParsed(null);
    setError("");
    setSelectedKeys({});
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
