export type ImportFormat = "postman" | "openapi" | "unknown";

export interface ImportedRequest {
  id: string;
  name: string;
  method: string;
  url: string;
  curlCommand: string;
  folder?: string;
}

// Minimal Postman Collection v2.1 types
export interface PostmanUrl {
  raw?: string;
  protocol?: string;
  host?: string | string[];
  path?: string | string[];
  query?: Array<{ key: string; value: string; disabled?: boolean }>;
  variable?: Array<{ key: string; value: string }>;
}

export interface PostmanHeader {
  key: string;
  value: string;
  disabled?: boolean;
}

export interface PostmanBody {
  mode?: "raw" | "urlencoded" | "formdata" | "file";
  raw?: string;
  options?: { raw?: { language?: string } };
  urlencoded?: Array<{ key: string; value: string; disabled?: boolean }>;
  formdata?: Array<{ key: string; value: string; disabled?: boolean }>;
}

export interface PostmanRequest {
  method?: string;
  url?: string | PostmanUrl;
  header?: PostmanHeader[];
  body?: PostmanBody;
  auth?: { type?: string };
}

export interface PostmanItem {
  id?: string;
  name?: string;
  request?: PostmanRequest;
  item?: PostmanItem[]; // folder
}

export interface PostmanCollection {
  info?: { _postman_id?: string; name?: string; schema?: string };
  item?: PostmanItem[];
}

// Minimal OpenAPI 3.x types
export interface OpenApiServer {
  url: string;
}
export interface OpenApiMediaType {
  schema?: Record<string, unknown>;
  example?: unknown;
}
export interface OpenApiRequestBody {
  content?: Record<string, OpenApiMediaType>;
}
export interface OpenApiParameter {
  name: string;
  in: "query" | "path" | "header" | "cookie";
  required?: boolean;
  schema?: { type?: string; example?: unknown };
  example?: unknown;
}
export interface OpenApiOperation {
  operationId?: string;
  summary?: string;
  parameters?: OpenApiParameter[];
  requestBody?: OpenApiRequestBody;
  security?: Record<string, string[]>[];
}
export type HttpMethod =
  | "get"
  | "post"
  | "put"
  | "patch"
  | "delete"
  | "head"
  | "options";
export type OpenApiPathItem = Partial<Record<HttpMethod, OpenApiOperation>>;
export interface OpenApiSpec {
  openapi?: string;
  swagger?: string;
  info?: { title?: string };
  servers?: OpenApiServer[];
  host?: string;
  basePath?: string;
  paths?: Record<string, OpenApiPathItem>;
  components?: { schemas?: Record<string, unknown> };
  definitions?: Record<string, unknown>;
}
