import type { ImportFormat, PostmanCollection, PostmanEnvironment, OpenApiSpec } from "@/types/import";

export function detectFormat(obj: unknown): ImportFormat {
  if (!obj || typeof obj !== "object") return "unknown";
  const o = obj as Record<string, unknown>;
  if (o.openapi || o.swagger) return "openapi";
  // Collections exported without `info._postman_id` (hand-written, generated, older tools) are still
  // collections: recognise them by the schema URL or by the `info` + `item` shape.
  const info = o.info;
  if (info && typeof info === "object") {
    const i = info as Record<string, unknown>;
    if ("_postman_id" in i) return "postman";
    if (typeof i.schema === "string" && /postman|collection/i.test(i.schema)) return "postman";
    if (Array.isArray(o.item)) return "postman";
  }
  return "unknown";
}

/** Parses a Postman environment / globals export (`{ values: [{ key, value, enabled }] }`). */
export function parseEnvironmentText(text: string): { env: PostmanEnvironment | null; error?: string } {
  const trimmed = text.trim();
  if (!trimmed) return { env: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    return { env: null, error: "Invalid environment JSON: " + (e instanceof Error ? e.message : String(e)) };
  }
  const o = parsed as Record<string, unknown> | null;
  if (!o || typeof o !== "object" || !(Array.isArray(o.values) || Array.isArray(o.variable))) {
    return { env: null, error: 'Not a Postman environment: expected a "values" array.' };
  }
  return { env: o as PostmanEnvironment };
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
