import type { ImportFormat, PostmanCollection, OpenApiSpec } from "@/types/import";

export function detectFormat(obj: unknown): ImportFormat {
  if (!obj || typeof obj !== "object") return "unknown";
  const o = obj as Record<string, unknown>;
  if (o.info && typeof o.info === "object" && "_postman_id" in (o.info as object))
    return "postman";
  if (o.openapi || o.swagger) return "openapi";
  return "unknown";
}

export async function parseInput(
  text: string
): Promise<{
  format: ImportFormat;
  data: PostmanCollection | OpenApiSpec | null;
  error?: string;
}> {
  const trimmed = text.trim();
  let parsed: unknown = null;

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      parsed = JSON.parse(trimmed);
    } catch (e) {
      return {
        format: "unknown",
        data: null,
        error: "Invalid JSON: " + (e instanceof Error ? e.message : String(e)),
      };
    }
  } else {
    try {
      const { load } = await import("js-yaml");
      parsed = load(trimmed);
    } catch (e) {
      return {
        format: "unknown",
        data: null,
        error: "Invalid YAML: " + (e instanceof Error ? e.message : String(e)),
      };
    }
  }

  const format = detectFormat(parsed);
  if (format === "unknown") {
    return {
      format,
      data: null,
      error:
        "Could not detect format. Expected Postman Collection v2.1 or OpenAPI/Swagger spec.",
    };
  }
  return { format, data: parsed as PostmanCollection | OpenApiSpec };
}
