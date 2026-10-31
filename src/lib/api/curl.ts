import { apiClient, GENERATE_TIMEOUT_MS, SAFE_RETRIES } from "@/lib/api/apiClient";
import { ENV } from "@/lib/env";
import type { CodeGenerationConfig, CodeGenerationResponse, ParsedCurl } from "@/types/curl";

export interface GenerateFromParsedRequest {
  parsed_data: ParsedCurl;
  config: CodeGenerationConfig;
}

/** The message of a backend error, whether it came back as a string or as { code, message }. */
export function generationErrorMessage(error: CodeGenerationResponse["error"]): string {
  if (!error) return "Unknown error";
  return typeof error === "object" ? error.message || "Unknown error" : error;
}

export const curlApi = {
  /**
   * Generate code using already-parsed data.
   * Maps to: POST /api/generate-from-parsed (endpoint from VITE_CURL_CRAFT_API_GENERATE_ENDPOINT, or production's
   * VITE_CURL_CRAFT_API_GENERATE_FROM_PARSED_ENDPOINT). Body shape is production's: { parsed_data, config }.
   */
  generateFromParsed: async (parsedData: ParsedCurl, config: CodeGenerationConfig): Promise<CodeGenerationResponse> => {
    const body: GenerateFromParsedRequest = { parsed_data: parsedData, config };
    const { data } = await apiClient.post(ENV.GENERATE_ENDPOINT, body, { timeout: GENERATE_TIMEOUT_MS, retries: SAFE_RETRIES });
    return data as CodeGenerationResponse;
  },
};
