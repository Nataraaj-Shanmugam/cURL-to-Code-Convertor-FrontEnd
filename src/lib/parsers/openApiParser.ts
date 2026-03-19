import type {
  OpenApiSpec,
  OpenApiOperation,
  OpenApiParameter,
  ImportedRequest,
  HttpMethod,
} from "@/types/import";

const HTTP_METHODS: HttpMethod[] = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
];

function generateExampleFromSchema(schema: unknown, depth = 0): unknown {
  if (depth > 3 || !schema || typeof schema !== "object") return "example";
  const s = schema as Record<string, unknown>;
  if (s.example !== undefined) return s.example;
  if (s.default !== undefined) return s.default;
  switch (s.type) {
    case "string":
      return "string";
    case "integer":
    case "number":
      return 0;
    case "boolean":
      return true;
    case "array":
      return [generateExampleFromSchema(s.items, depth + 1)];
    case "object": {
      if (!s.properties || typeof s.properties !== "object") return {};
      const result: Record<string, unknown> = {};
      Object.entries(s.properties as Record<string, unknown>).forEach(
        ([k, v]) => {
          result[k] = generateExampleFromSchema(v, depth + 1);
        }
      );
      return result;
    }
    default:
      return "example";
  }
}

function shellEscape(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

function operationToCurl(
  method: string,
  path: string,
  baseUrl: string,
  operation: OpenApiOperation,
  schemas: Record<string, unknown> = {}
): string {
  const parts: string[] = ["curl"];
  const httpMethod = method.toUpperCase();
  if (httpMethod !== "GET") parts.push(`-X ${httpMethod}`);

  // Substitute path params
  let resolvedPath = path;
  const pathParams = (operation.parameters || []).filter(
    (p: OpenApiParameter) => p.in === "path"
  );
  pathParams.forEach((p) => {
    const val = p.example ?? p.schema?.example ?? "value";
    resolvedPath = resolvedPath.replace(`{${p.name}}`, String(val));
  });

  // Query params
  const queryParams = (operation.parameters || []).filter(
    (p: OpenApiParameter) => p.in === "query"
  );
  let url = baseUrl.replace(/\/$/, "") + resolvedPath;
  if (queryParams.length > 0) {
    const qs = queryParams
      .map((p) => {
        const val = p.example ?? p.schema?.example ?? "value";
        return `${p.name}=${val}`;
      })
      .join("&");
    url += "?" + qs;
  }
  parts.push(shellEscape(url));

  // Header params
  const headerParams = (operation.parameters || []).filter(
    (p: OpenApiParameter) => p.in === "header"
  );
  headerParams.forEach((p) => {
    const val = p.example ?? p.schema?.example ?? "value";
    parts.push(`-H ${shellEscape(`${p.name}: ${val}`)}`);
  });

  // Request body
  if (operation.requestBody?.content) {
    const jsonContent = operation.requestBody.content["application/json"];
    if (jsonContent) {
      parts.push(`-H ${shellEscape("Content-Type: application/json")}`);
      let bodyExample: unknown = jsonContent.example;
      if (!bodyExample && jsonContent.schema) {
        let schema = jsonContent.schema as Record<string, unknown>;
        // Resolve simple $ref
        if (schema["$ref"] && typeof schema["$ref"] === "string") {
          const refName = schema["$ref"].split("/").pop()!;
          schema =
            (schemas[refName] as Record<string, unknown>) || schema;
        }
        bodyExample = generateExampleFromSchema(schema);
      }
      if (bodyExample !== undefined) {
        parts.push(`-d ${shellEscape(JSON.stringify(bodyExample, null, 2))}`);
      }
    }
  }

  return parts.join(" \\\n  ");
}

export function parseOpenApiSpec(spec: OpenApiSpec): ImportedRequest[] {
  const results: ImportedRequest[] = [];

  // Resolve base URL
  let baseUrl = "https://api.example.com";
  if (spec.servers && spec.servers.length > 0) baseUrl = spec.servers[0]!.url;
  else if (spec.host) baseUrl = `https://${spec.host}${spec.basePath || ""}`;

  const schemas: Record<string, unknown> = {
    ...(spec.components?.schemas || {}),
    ...(spec.definitions || {}),
  };

  let counter = 0;
  Object.entries(spec.paths || {}).forEach(([path, pathItem]) => {
    if (!pathItem) return;
    HTTP_METHODS.forEach((method) => {
      const operation = (pathItem as Record<string, unknown>)[
        method
      ] as OpenApiOperation | undefined;
      if (!operation) return;
      const name =
        operation.summary ||
        operation.operationId ||
        `${method.toUpperCase()} ${path}`;
      results.push({
        id: String(counter++),
        name,
        method: method.toUpperCase(),
        url: baseUrl.replace(/\/$/, "") + path,
        curlCommand: operationToCurl(method, path, baseUrl, operation, schemas),
      });
    });
  });

  return results;
}
