import type { HttpMethod, ImportedRequest, OpenApiSpec } from "@/types/import";
import { encodePathValue, encodeQueryPart } from "@/lib/utils/urlBuilder";
import { type CurlForm, type CurlParts, hasHeaderNamed, renderCurl } from "./curlText";

type Obj = Record<string, unknown>;

const HTTP_METHODS: HttpMethod[] = ["get", "post", "put", "patch", "delete", "head", "options"];

const DEFAULT_BASE_URL = "https://api.example.com";
const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

// ── $ref resolution ──────────────────────────────────────────────────────────

/** Local `$ref`s only (`#/components/...`, `#/definitions/...`); external files are not fetched. */
function lookup(spec: Obj, ref: string): unknown {
  if (!ref.startsWith("#/")) return undefined;
  let node: unknown = spec;
  for (const raw of ref.slice(2).split("/")) {
    let key = raw.replace(/~1/g, "/").replace(/~0/g, "~");
    try {
      key = decodeURIComponent(key);
    } catch {
      /* keep the undecoded key */
    }
    if (!isObj(node) && !Array.isArray(node)) return undefined;
    node = (node as Obj)[key];
  }
  return node;
}

/** Follows a chain of `$ref`s. Returns the node unchanged when it is not a reference. */
function deref(spec: Obj, node: unknown): unknown {
  let current = node;
  for (let i = 0; i < 10 && isObj(current) && typeof current.$ref === "string"; i++) {
    const target = lookup(spec, current.$ref);
    if (target === undefined) return undefined;
    current = target;
  }
  return current;
}

// ── examples ─────────────────────────────────────────────────────────────────

const FORMAT_EXAMPLES: Record<string, string> = {
  "date-time": "2024-01-01T00:00:00Z",
  date: "2024-01-01",
  time: "12:00:00",
  email: "user@example.com",
  uuid: "00000000-0000-0000-0000-000000000000",
  uri: "https://example.com",
  url: "https://example.com",
  hostname: "example.com",
  ipv4: "127.0.0.1",
  byte: "c3RyaW5n",
};

/** First usable value of an `examples` map (OpenAPI 3) — entries may be `$ref`s to components/examples. */
function firstExample(spec: Obj, examples: unknown): unknown {
  if (Array.isArray(examples)) return examples[0]; // JSON Schema style
  if (!isObj(examples)) return undefined;
  for (const entry of Object.values(examples)) {
    const resolved = deref(spec, entry);
    if (isObj(resolved) && resolved.value !== undefined) return resolved.value;
  }
  return undefined;
}

/**
 * Builds an example value for a schema. Understands `$ref`, `allOf` (merged), `oneOf`/`anyOf` (first),
 * enums, formats and OpenAPI/Swagger 2 `example`/`x-example`/`default`. `readOnly` properties are left out
 * because a request never sends them. `refs` is the chain of references being expanded: a schema that
 * contains itself ends at `null` instead of recursing forever.
 */
function exampleOf(spec: Obj, node: unknown, refs: string[] = [], depth = 0): unknown {
  if (depth > 10) return null;
  let schema: unknown = node;
  let chain = refs;
  for (let i = 0; i < 10 && isObj(schema) && typeof schema.$ref === "string"; i++) {
    const ref = schema.$ref;
    if (chain.includes(ref)) return null;
    chain = [...chain, ref];
    schema = lookup(spec, ref);
  }
  if (!isObj(schema)) return "string";

  if (schema.example !== undefined) return schema.example;
  if (schema["x-example"] !== undefined) return schema["x-example"];
  const named = firstExample(spec, schema.examples);
  if (named !== undefined) return named;
  if (schema.default !== undefined) return schema.default;
  if (schema.const !== undefined) return schema.const;
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];

  const next = (child: unknown) => exampleOf(spec, child, chain, depth + 1);

  if (Array.isArray(schema.allOf)) {
    const parts = schema.allOf.map(next);
    const own = schema.properties ? next({ type: "object", properties: schema.properties }) : undefined;
    const objects = [...parts, own].filter(isObj);
    if (objects.length > 0) return Object.assign({}, ...objects);
    return parts.find((p) => p !== undefined && p !== null) ?? "string";
  }
  for (const key of ["oneOf", "anyOf"] as const) {
    const options = schema[key];
    if (Array.isArray(options) && options.length > 0) return next(options[0]);
  }

  let type = schema.type;
  if (Array.isArray(type)) type = type.find((t) => t !== "null");
  if (type === undefined && isObj(schema.properties)) type = "object";
  if (type === undefined && schema.items !== undefined) type = "array";

  switch (type) {
    case "string":
      return FORMAT_EXAMPLES[String(schema.format)] ?? "string";
    case "integer":
    case "number":
      return 0;
    case "boolean":
      return true;
    case "array":
      return [next(schema.items)];
    case "object": {
      const result: Obj = {};
      if (isObj(schema.properties)) {
        for (const [name, prop] of Object.entries(schema.properties)) {
          const resolved = deref(spec, prop);
          if (isObj(resolved) && resolved.readOnly === true) continue;
          result[name] = next(prop);
        }
      }
      return result;
    }
    case "file":
      return "string";
    default:
      return "string";
  }
}

// ── parameters ───────────────────────────────────────────────────────────────

interface Param {
  name: string;
  in: string;
  raw: Obj;
}

function collectParameters(spec: Obj, pathItem: Obj, operation: Obj): Param[] {
  const merged = new Map<string, Param>();
  // Path-level parameters apply to every operation; an operation can override one by name + location.
  for (const list of [pathItem.parameters, operation.parameters]) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      const raw = deref(spec, entry);
      if (!isObj(raw) || typeof raw.name !== "string" || typeof raw.in !== "string") continue;
      merged.set(`${raw.in}:${raw.name}`, { name: raw.name, in: raw.in, raw });
    }
  }
  return [...merged.values()];
}

function paramValue(spec: Obj, param: Param): unknown {
  const raw = param.raw;
  if (raw.example !== undefined) return raw.example;
  const named = firstExample(spec, raw.examples);
  if (named !== undefined) return named;
  if (raw["x-example"] !== undefined) return raw["x-example"];
  // OpenAPI 3 keeps the type under `schema`; Swagger 2 keeps it on the parameter itself.
  return exampleOf(spec, raw.schema ?? raw);
}

const scalar = (v: unknown): string => (v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));

function paramValues(param: Param, value: unknown): string[] {
  if (!Array.isArray(value)) return [scalar(value)];
  const explode = param.raw.explode !== false && param.raw.collectionFormat !== "csv";
  if (param.in === "query" && explode && param.raw.style !== "pipeDelimited" && param.raw.style !== "spaceDelimited") {
    return value.map(scalar);
  }
  const separator =
    param.raw.style === "pipeDelimited" || param.raw.collectionFormat === "pipes"
      ? "|"
      : param.raw.style === "spaceDelimited" || param.raw.collectionFormat === "ssv"
        ? " "
        : ",";
  return [value.map(scalar).join(separator)];
}

// ── servers / base url ───────────────────────────────────────────────────────

function expandServer(server: unknown): string | undefined {
  if (!isObj(server) || typeof server.url !== "string") return undefined;
  const variables = isObj(server.variables) ? server.variables : {};
  return server.url.replace(/\{([^}]+)\}/g, (whole, name: string) => {
    const variable = variables[name];
    if (!isObj(variable)) return whole;
    if (variable.default !== undefined) return String(variable.default);
    if (Array.isArray(variable.enum) && variable.enum.length > 0) return String(variable.enum[0]);
    return whole;
  });
}

/** Servers may be relative ("/api/v3") because they resolve against wherever the spec was served from. */
function absoluteBase(url: string): string {
  if (SCHEME.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  return DEFAULT_BASE_URL + (url.startsWith("/") ? "" : "/") + url.replace(/^\.\//, "");
}

function resolveBaseUrl(spec: OpenApiSpec, scope: Obj[]): string {
  for (const holder of scope) {
    const server = Array.isArray(holder.servers) ? holder.servers[0] : undefined;
    const url = expandServer(server);
    if (url !== undefined) return absoluteBase(url).replace(/\/+$/, "");
  }
  if (spec.host) {
    const schemes = Array.isArray((spec as Obj).schemes) ? ((spec as Obj).schemes as string[]) : [];
    const scheme = schemes.includes("https") || schemes.length === 0 ? "https" : schemes[0];
    return `${scheme}://${spec.host}${spec.basePath || ""}`.replace(/\/+$/, "");
  }
  if (spec.basePath) return absoluteBase(spec.basePath).replace(/\/+$/, "");
  return DEFAULT_BASE_URL;
}

// ── security ─────────────────────────────────────────────────────────────────

interface SecurityResult {
  headers: Array<[string, string]>;
  query: Array<[string, string]>;
  cookies: Array<[string, string]>;
  user?: string;
  userMode?: "digest";
}

/**
 * Security schemes become placeholder credentials to fill in. Requirements are alternatives (OR);
 * the first one that names a known scheme is used, and every scheme inside it applies (AND).
 */
function mapSecurity(spec: Obj, operation: Obj): SecurityResult {
  const result: SecurityResult = { headers: [], query: [], cookies: [] };
  const requirements = operation.security !== undefined ? operation.security : spec.security;
  if (!Array.isArray(requirements)) return result;
  const components = isObj(spec.components) ? spec.components : {};
  const schemes = isObj(components.securitySchemes)
    ? components.securitySchemes
    : isObj(spec.securityDefinitions)
      ? spec.securityDefinitions
      : {};

  for (const requirement of requirements) {
    if (!isObj(requirement)) continue;
    const known = Object.keys(requirement).filter((name) => isObj(deref(spec, schemes[name])));
    if (known.length === 0) continue;
    for (const name of known) {
      const scheme = deref(spec, schemes[name]) as Obj;
      const type = String(scheme.type ?? "").toLowerCase();
      const httpScheme = String(scheme.scheme ?? "").toLowerCase();
      if (type === "basic" || (type === "http" && httpScheme === "basic")) {
        result.user = "YOUR_USERNAME:YOUR_PASSWORD";
      } else if (type === "http" && httpScheme === "digest") {
        result.user = "YOUR_USERNAME:YOUR_PASSWORD";
        result.userMode = "digest";
      } else if (type === "http" && httpScheme === "bearer") {
        result.headers.push(["Authorization", "Bearer YOUR_BEARER_TOKEN"]);
      } else if (type === "http") {
        result.headers.push(["Authorization", `${String(scheme.scheme ?? "Bearer")} YOUR_CREDENTIALS`]);
      } else if (type === "apikey") {
        const keyName = String(scheme.name ?? "api_key");
        const where = String(scheme.in ?? "header");
        if (where === "query") result.query.push([keyName, "YOUR_API_KEY"]);
        else if (where === "cookie") result.cookies.push([keyName, "YOUR_API_KEY"]);
        else result.headers.push([keyName, "YOUR_API_KEY"]);
      } else if (type === "oauth2" || type === "openidconnect") {
        result.headers.push(["Authorization", "Bearer YOUR_ACCESS_TOKEN"]);
      }
    }
    break;
  }
  return result;
}

// ── request body ─────────────────────────────────────────────────────────────

interface BodyResult {
  contentType?: string;
  data?: string;
  forms?: CurlForm[];
}

/** `application/json; charset=utf-8`, `application/vnd.api+json`, `text/json` ... */
const JSON_MEDIA = /^[\w.+-]+\/(?:[\w.+-]*\+)?json\s*(?:;|$)/i;
const isMedia = (type: string, prefix: string) => type.trim().toLowerCase().startsWith(prefix);

function schemaProperties(spec: Obj, schema: unknown, refs: string[] = []): Array<[string, unknown]> {
  let node: unknown = schema;
  let chain = refs;
  for (let i = 0; i < 10 && isObj(node) && typeof node.$ref === "string"; i++) {
    if (chain.includes(node.$ref)) return [];
    chain = [...chain, node.$ref];
    node = lookup(spec, node.$ref);
  }
  if (!isObj(node)) return [];
  const props: Array<[string, unknown]> = [];
  if (Array.isArray(node.allOf)) for (const part of node.allOf) props.push(...schemaProperties(spec, part, chain));
  if (isObj(node.properties)) props.push(...Object.entries(node.properties));
  return props;
}

function isBinary(spec: Obj, schema: unknown): boolean {
  const s = deref(spec, schema);
  if (!isObj(s)) return false;
  if (s.type === "file" || s.format === "binary") return true;
  return s.type === "array" && isBinary(spec, s.items);
}

function formFields(spec: Obj, properties: Array<[string, unknown]>, example: unknown, multipart: boolean): { forms?: CurlForm[]; data?: string } {
  const forms: CurlForm[] = [];
  const pairs: string[] = [];
  const given = isObj(example) ? example : {};
  for (const [name, prop] of properties) {
    const resolved = deref(spec, prop);
    if (isObj(resolved) && resolved.readOnly === true) continue;
    if (multipart && isBinary(spec, prop)) {
      forms.push({ field: `${name}=@path/to/file` });
      continue;
    }
    const value = given[name] !== undefined ? given[name] : exampleOf(spec, prop);
    const items = Array.isArray(value) ? value : [value];
    for (const item of items) {
      if (multipart) {
        const text = scalar(item);
        const json = isObj(item) || Array.isArray(item);
        forms.push({ field: `${name}=${text}${json ? ";type=application/json" : ""}`, literal: /^[@<]/.test(text) });
      } else {
        pairs.push(`${encodeQueryPart(name, true)}=${encodeQueryPart(scalar(item))}`);
      }
    }
  }
  return multipart ? (forms.length ? { forms } : {}) : pairs.length ? { data: pairs.join("&") } : {};
}

function mediaExample(spec: Obj, media: Obj): unknown {
  if (media.example !== undefined) return media.example;
  const named = firstExample(spec, media.examples);
  if (named !== undefined) return named;
  return undefined;
}

function jsonText(value: unknown): string {
  if (typeof value === "string") {
    try {
      JSON.parse(value);
      return value; // already serialised JSON (typical for YAML block-scalar examples)
    } catch {
      /* a plain string value: serialise it as JSON */
    }
  }
  return JSON.stringify(value, null, 2);
}

function bodyFromMedia(spec: Obj, content: Obj): BodyResult {
  const types = Object.keys(content).filter((t) => isObj(content[t]));
  const json = types.find((t) => t.trim().toLowerCase() === "application/json") ?? types.find((t) => JSON_MEDIA.test(t));
  if (json) {
    const media = content[json] as Obj;
    const value = mediaExample(spec, media);
    const example = value !== undefined ? value : media.schema !== undefined ? exampleOf(spec, media.schema) : undefined;
    return example === undefined ? {} : { contentType: json, data: jsonText(example) };
  }
  const multipart = types.find((t) => isMedia(t, "multipart/"));
  const urlencoded = types.find((t) => isMedia(t, "application/x-www-form-urlencoded"));
  const form = multipart ?? urlencoded;
  if (form) {
    const media = content[form] as Obj;
    return formFields(spec, schemaProperties(spec, media.schema), mediaExample(spec, media), form === multipart);
  }
  for (const type of types) {
    const media = content[type] as Obj;
    const value = mediaExample(spec, media);
    if (typeof value === "string") return { contentType: type, data: value };
  }
  return {};
}

function bodyFromSwagger2(spec: Obj, operation: Obj, params: Param[]): BodyResult {
  const consumes = (Array.isArray(operation.consumes) ? operation.consumes : Array.isArray(spec.consumes) ? spec.consumes : []) as string[];
  const bodyParam = params.find((p) => p.in === "body");
  if (bodyParam) {
    const raw = bodyParam.raw;
    const example = raw["x-example"] !== undefined ? raw["x-example"] : exampleOf(spec, raw.schema);
    const contentType = consumes.find((t) => JSON_MEDIA.test(t)) ?? consumes[0] ?? "application/json";
    return { contentType, data: JSON_MEDIA.test(contentType) ? jsonText(example) : scalar(example) };
  }
  const formParams = params.filter((p) => p.in === "formData");
  if (formParams.length > 0) {
    const hasFile = formParams.some((p) => p.raw.type === "file");
    const multipart = hasFile || consumes.some((t) => isMedia(t, "multipart/")) || !consumes.some((t) => isMedia(t, "application/x-www-form-urlencoded"));
    const properties: Array<[string, unknown]> = formParams.map((p) => [p.name, p.raw]);
    return formFields(spec, properties, undefined, multipart);
  }
  return {};
}

// ── operations ───────────────────────────────────────────────────────────────

function fillPath(path: string, params: Param[], spec: Obj): string {
  let resolved = path;
  for (const param of params.filter((p) => p.in === "path")) {
    resolved = resolved.split(`{${param.name}}`).join(encodePathValue(paramValues(param, paramValue(spec, param)).join(",")));
  }
  // curl treats {…} in a URL as a glob, so a template variable with no parameter definition gets a stand-in.
  return resolved.replace(/\{([^}/]+)\}/g, "value");
}

function operationToCurl(spec: OpenApiSpec, method: string, path: string, baseUrl: string, pathItem: Obj, operation: Obj): string {
  const root = spec as unknown as Obj;
  const params = collectParameters(root, pathItem, operation);

  const query: string[] = [];
  for (const param of params.filter((p) => p.in === "query")) {
    for (const value of paramValues(param, paramValue(root, param))) {
      query.push(`${encodeQueryPart(param.name, true)}=${encodeQueryPart(value)}`);
    }
  }
  const security = mapSecurity(root, operation);
  for (const [name, value] of security.query) {
    if (!params.some((p) => p.in === "query" && p.name === name)) query.push(`${encodeQueryPart(name, true)}=${encodeQueryPart(value)}`);
  }
  const url = baseUrl + fillPath(path, params, root) + (query.length ? "?" + query.join("&") : "");

  const headers: Array<[string, string]> = [];
  for (const param of params.filter((p) => p.in === "header")) {
    headers.push([param.name, paramValues(param, paramValue(root, param)).join(",")]);
  }
  for (const [name, value] of security.headers) {
    if (!hasHeaderNamed(headers, name)) headers.push([name, value]);
  }

  const cookies = params.filter((p) => p.in === "cookie").map((p): [string, string] => [p.name, paramValues(p, paramValue(root, p)).join(",")]);
  for (const cookie of security.cookies) if (!cookies.some(([n]) => n === cookie[0])) cookies.push(cookie);

  let body: BodyResult = {};
  const requestBody = deref(root, operation.requestBody);
  if (isObj(requestBody) && isObj(requestBody.content)) body = bodyFromMedia(root, requestBody.content);
  else if (spec.swagger || params.some((p) => p.in === "body" || p.in === "formData")) body = bodyFromSwagger2(root, operation, params);
  if (body.contentType && !hasHeaderNamed(headers, "Content-Type")) headers.push(["Content-Type", body.contentType]);

  const parts: CurlParts = {
    method,
    url,
    headers,
    user: hasHeaderNamed(headers, "Authorization") ? undefined : security.user,
    userMode: security.userMode,
    cookie: cookies.length ? cookies.map(([n, v]) => `${n}=${v}`).join("; ") : undefined,
    data: body.data,
    forms: body.forms,
  };
  return renderCurl(parts);
}

export function parseOpenApiSpec(spec: OpenApiSpec): ImportedRequest[] {
  const results: ImportedRequest[] = [];
  const root = spec as unknown as Obj;

  let counter = 0;
  Object.entries(spec.paths || {}).forEach(([path, rawPathItem]) => {
    const pathItem = deref(root, rawPathItem);
    if (!isObj(pathItem)) return;
    HTTP_METHODS.forEach((method) => {
      const operation = pathItem[method];
      if (!isObj(operation)) return;
      const baseUrl = resolveBaseUrl(spec, [operation, pathItem, root]);
      const name =
        (typeof operation.summary === "string" && operation.summary) ||
        (typeof operation.operationId === "string" && operation.operationId) ||
        `${method.toUpperCase()} ${path}`;
      results.push({
        id: String(counter++),
        name,
        method: method.toUpperCase(),
        url: baseUrl + path,
        curlCommand: operationToCurl(spec, method, path, baseUrl, pathItem, operation),
      });
    });
  });

  return results;
}
