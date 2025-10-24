import { apiClient } from "./apiClient";
import type { ParsedCurlResponse } from "@/types/curl";

export const curlApi = {
  /**
   * Parse a cURL command string into structured data
   */
  parse: async (curlCommand: string): Promise<ParsedCurlResponse> => {
    const { data } = await apiClient.post<ParsedCurlResponse>(
      "/api/parse-curl", 
      { curl: curlCommand }
    );
    return data;
  },
};