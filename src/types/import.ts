export type ImportFormat = "postman" | "openapi" | "unknown";

export interface ImportedRequest {
  id: string;
  name: string;
  method: string;
  url: string;
  curlCommand: string;
  folder?: string;
  /** `{{variables}}` / `:pathVariables` that no collection, folder or environment value resolved. */
  unresolvedVariables?: string[];
  /** Things that could not be carried over (unsupported auth type, ...). */
  warnings?: string[];
}

// Minimal Postman Collection v2.x types
export interface PostmanVariable {
  key?: string;
  id?: string;
  value?: unknown;
  disabled?: boolean;
  type?: string;
}

export interface PostmanQueryParam {
  key?: string | null;
  value?: string | null;
  disabled?: boolean;
}

export interface PostmanUrl {
  raw?: string;
  protocol?: string;
  host?: string | string[];
  port?: string;
  path?: string | string[];
  query?: PostmanQueryParam[];
  variable?: PostmanVariable[];
}

export interface PostmanHeader {
  key: string;
  value: string;
  disabled?: boolean;
}

export interface PostmanFormField {
  key: string;
  value?: string;
  type?: "text" | "file" | string;
  src?: string | string[] | null;
  contentType?: string;
  disabled?: boolean;
}

export interface PostmanBody {
  mode?: "raw" | "urlencoded" | "formdata" | "file" | "graphql";
  raw?: string;
  options?: { raw?: { language?: string } };
  urlencoded?: Array<{ key: string; value?: string | null; disabled?: boolean }>;
  formdata?: PostmanFormField[];
  file?: { src?: string | null; content?: string };
  graphql?: { query?: string; variables?: string | Record<string, unknown> };
}

/** v2.1 stores auth params as `[{key, value}]`; v2.0 as a plain object. Both are accepted. */
export interface PostmanAuth {
  type?: string;
  [scheme: string]: unknown;
}

export interface PostmanRequest {
  method?: string;
  url?: string | PostmanUrl;
  header?: PostmanHeader[] | string;
  body?: PostmanBody;
  auth?: PostmanAuth;
}

export interface PostmanItem {
  id?: string;
  name?: string;
  request?: PostmanRequest | string;
  item?: PostmanItem[]; // folder
  auth?: PostmanAuth;
  variable?: PostmanVariable[];
}

export interface PostmanCollection {
  info?: { _postman_id?: string; name?: string; schema?: string };
  item?: PostmanItem[];
  auth?: PostmanAuth;
  variable?: PostmanVariable[];
}

/** Postman environment export (`values`) or globals. */
export interface PostmanEnvironment {
  id?: string;
  name?: string;
  values?: Array<{ key?: string; value?: unknown; enabled?: boolean; type?: string }>;
  variable?: PostmanVariable[];
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
