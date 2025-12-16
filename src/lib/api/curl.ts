import { apiClient } from "./apiClient";
import type {
  ParseCurlResponse,
  CodeGenerationConfig,
  CodeGenerationResponse,
  ParsedCurl,
} from "@/types/curl";

export interface GenerateFromParsedRequest {
  parsed_data: ParsedCurl;
  config: CodeGenerationConfig;
}

export interface ParseAndGenerateRequest {
  curl: string;
  config: CodeGenerationConfig;
}

export const curlApi = {
  /**
   * Parse a cURL command string into structured data
   * Maps to: POST /api/parse
   */
  parse: async (curlCommand: string): Promise<ParseCurlResponse> => {
    const { data } = await apiClient.post<ParseCurlResponse>("/api/parse", {
      curl: curlCommand,
    });
    return data;
  },

  /**
   * One shot: parse cURL and generate code
   * Maps to: POST /api/parse-and-generate
   */
  parseAndGenerate: async (
    curlCommand: string,
    config: CodeGenerationConfig
  ): Promise<CodeGenerationResponse> => {
    const { data } = await apiClient.post<CodeGenerationResponse>(
      "/api/parse-and-generate",
      {
        curl: curlCommand,
        config,
      } satisfies ParseAndGenerateRequest
    );
    return data;
  },

  /**
   * Generate code using already-parsed data
   * Maps to: POST /api/generate-from-parsed
   * 
   * Now supports POM.xml generation when config.generatePom is true
   */
  generateFromParsed: async (
    parsedData: ParsedCurl,
    config: CodeGenerationConfig
  ): Promise<CodeGenerationResponse> => {
    const { data } = await apiClient.post<CodeGenerationResponse>(
      "/api/generate-from-parsed",
      {
        parsed_data: parsedData,
        config,
      } satisfies GenerateFromParsedRequest
    );
    return data;
  },
};