import type {
  ImportedRequest,
  PostmanAuth,
  PostmanBody,
  PostmanCollection,
  PostmanEnvironment,
  PostmanFormField,
  PostmanHeader,
  PostmanItem,
  PostmanRequest,
  PostmanUrl,
  PostmanVariable,
} from "@/types/import";
import { encodePathValue, encodeQueryPart } from "@/lib/utils/urlBuilder";
import {
  type CurlForm,
  type CurlParts,
  encodeKeepingPlaceholders,
  findPlaceholders,
  hasHeaderNamed,
  renderCurl,
} from "./curlText";

type Vars = Record<string, string>;

const stringify = (value: unknown): string => {
  if (value === undefined || value === null) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
};

export function variablesFromList(list: PostmanVariable[] | undefined): Vars {
  const vars: Vars = {};
  for (const v of list ?? []) {
    const key = v?.key ?? v?.id;
    if (!key || v.disabled) continue;
    vars[key] = stringify(v.value);
  }
  return vars;
}

/** Variables of a Postman environment (or globals) export. Disabled entries are ignored. */
export function environmentVariables(env: PostmanEnvironment | null | undefined): Vars {
  if (!env) return {};
  const vars: Vars = {};
  for (const v of env.values ?? []) {
    if (!v?.key || v.enabled === false) continue;
    vars[v.key] = stringify(v.value);
  }
  return { ...variablesFromList(env.variable), ...vars };
}

const VARIABLE = /\{\{\s*([^{}]+?)\s*\}\}/g;

/** Replaces `{{name}}` with its value (values may reference other variables). Unknown names stay as written. */
function resolve(text: string, vars: Vars, depth = 0): string {
  if (!text.includes("{{")) return text;
  return text.replace(VARIABLE, (whole, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(vars, name)) return whole;
    const value = vars[name]!;
    return depth < 5 ? resolve(value, vars, depth + 1) : value;
  });
}

// ── auth ─────────────────────────────────────────────────────────────────────

function authParams(auth: PostmanAuth, type: string): Record<string, string> {
  const raw = auth[type];
  const params: Record<string, string> = {};
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (entry && typeof entry === "object" && "key" in entry) {
        params[String((entry as { key: unknown }).key)] = stringify((entry as { value?: unknown }).value);
      }
    }
  } else if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw)) params[k] = stringify(v);
  }
  return params;
}

interface AuthResult {
  headers: Array<[string, string]>;
  query: Array<[string, string]>;
  user?: string;
  userMode?: "digest";
  warnings: string[];
}

function mapAuth(auth: PostmanAuth | undefined, vars: Vars): AuthResult {
  const result: AuthResult = { headers: [], query: [], warnings: [] };
  const type = auth?.type;
  if (!auth || !type || type === "noauth" || type === "inherit") return result;
  const p = Object.fromEntries(Object.entries(authParams(auth, type)).map(([k, v]) => [k, resolve(v, vars)]));

  switch (type) {
    case "bearer":
      result.headers.push(["Authorization", `Bearer ${p.token ?? ""}`]);
      break;
    case "basic":
      result.user = `${p.username ?? ""}:${p.password ?? ""}`;
      break;
    case "digest":
      result.user = `${p.username ?? ""}:${p.password ?? ""}`;
      result.userMode = "digest";
      break;
    case "apikey": {
      const key = p.key ?? "";
      if (!key) break;
      if ((p.in ?? "header") === "query") result.query.push([key, p.value ?? ""]);
      else result.headers.push([key, p.value ?? ""]);
      break;
    }
    case "oauth2": {
      const prefix = p.headerPrefix === undefined ? "Bearer" : p.headerPrefix;
      // A Postman export carries a token only if one was fetched; otherwise leave a variable to fill in.
      const token = p.accessToken || resolve("{{accessToken}}", vars);
      if (p.addTokenTo === "queryParams") result.query.push(["access_token", token]);
      else result.headers.push(["Authorization", `${prefix ? prefix + " " : ""}${token}`]);
      break;
    }
    default:
      result.warnings.push(`Auth type "${type}" is not converted; add its credentials manually.`);
  }
  return result;
}

// ── url ──────────────────────────────────────────────────────────────────────

const encodePathSegment = (plain: string) =>
  encodeURIComponent(plain).replace(/%(3A|40|24|26|2B|2C|3B|3D)/g, (_m, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  );

const encodePart = (text: string, isKey = false) =>
  encodeKeepingPlaceholders(text, (plain) => encodeQueryPart(plain, isKey));

const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

interface BuiltUrl {
  url: string;
  unresolved: string[];
}

function buildUrl(
  input: string | PostmanUrl | undefined,
  vars: Vars,
  extraQuery: Array<[string, string]>,
): BuiltUrl {
  const unresolved: string[] = [];
  const pathVars: Vars = {};
  let base = "";
  let query: string[] = [];

  const fillPath = (segment: string): string => {
    const m = /^:([A-Za-z_][\w.-]*)$/.exec(segment);
    if (!m) return encodeKeepingPlaceholders(segment, encodePathSegment);
    const value = pathVars[m[1]!];
    if (value === undefined || value === "") {
      unresolved.push(`:${m[1]}`);
      return segment;
    }
    return encodeKeepingPlaceholders(value, (plain) => encodePathValue(plain));
  };

  const url: PostmanUrl = typeof input === "string" ? { raw: input } : input ?? {};
  for (const v of url.variable ?? []) {
    if (v?.key) pathVars[v.key] = resolve(stringify(v.value), vars);
  }

  const hostText = Array.isArray(url.host) ? url.host.join(".") : url.host ?? "";
  if (hostText) {
    // Structured form: host / port / path / query.
    let host = resolve(hostText, vars).replace(/\/+$/, "");
    if (url.port && !/:\d+$/.test(host)) host += `:${url.port}`;
    const protocol = url.protocol ? resolve(url.protocol, vars).replace(/:?\/*$/, "") : "";
    if (protocol && !SCHEME.test(host)) host = `${protocol}://${host}`;
    const segments = Array.isArray(url.path)
      ? url.path.map((s) => resolve(String(s), vars))
      : (url.path ? resolve(url.path, vars) : "").split("/");
    const path = segments.filter((s, i) => s !== "" || i === segments.length - 1).map(fillPath).join("/");
    base = host + (path ? "/" + path.replace(/^\/+/, "") : "");
    query = (url.query ?? [])
      .filter((q) => q && !q.disabled && (q.key ?? "") !== "")
      .map((q) => {
        const key = encodePart(resolve(String(q.key), vars), true);
        return q.value === null || q.value === undefined ? key : `${key}=${encodePart(resolve(String(q.value), vars))}`;
      });
  } else if (url.raw) {
    // Raw form only: split off ?query and #fragment, fill :pathVars, re-encode the query pairs.
    const raw = resolve(url.raw, vars);
    const hashAt = raw.indexOf("#");
    const noHash = hashAt < 0 ? raw : raw.slice(0, hashAt);
    const queryAt = noHash.indexOf("?");
    const head = queryAt < 0 ? noHash : noHash.slice(0, queryAt);
    const tail = queryAt < 0 ? "" : noHash.slice(queryAt + 1);
    const schemeLen = SCHEME.exec(head)?.[0].length ?? 0;
    const hostEnd = head.indexOf("/", schemeLen);
    const hostPart = hostEnd < 0 ? head : head.slice(0, hostEnd);
    const pathPart = hostEnd < 0 ? "" : head.slice(hostEnd + 1);
    base = hostPart + (hostEnd < 0 ? "" : "/" + pathPart.split("/").map(fillPath).join("/"));
    query = tail
      .split("&")
      .filter((pair) => pair !== "")
      .map((pair) => {
        const eq = pair.indexOf("=");
        return eq < 0 ? encodePart(pair, true) : `${encodePart(pair.slice(0, eq), true)}=${encodePart(pair.slice(eq + 1))}`;
      });
  }

  for (const [k, v] of extraQuery) query.push(`${encodePart(k, true)}=${encodePart(v)}`);

  if (base && !SCHEME.test(base) && !base.startsWith("{{")) base = `https://${base}`;
  return { url: base + (query.length ? "?" + query.join("&") : ""), unresolved };
}

// ── body ─────────────────────────────────────────────────────────────────────

const RAW_CONTENT_TYPES: Record<string, string> = {
  json: "application/json",
  xml: "application/xml",
  html: "text/html",
  javascript: "application/javascript",
  text: "text/plain",
};

interface BodyResult {
  data?: string;
  dataBinary?: string;
  forms?: CurlForm[];
  contentType?: string;
  warnings: string[];
}

function mapBody(body: PostmanBody | undefined, vars: Vars): BodyResult {
  const result: BodyResult = { warnings: [] };
  if (!body) return result;
  switch (body.mode) {
    case "raw": {
      if (body.raw === undefined || body.raw === "") break;
      result.data = resolve(body.raw, vars);
      const language = body.options?.raw?.language;
      if (language && RAW_CONTENT_TYPES[language]) result.contentType = RAW_CONTENT_TYPES[language];
      break;
    }
    case "urlencoded": {
      const pairs = (body.urlencoded ?? [])
        .filter((f) => f && !f.disabled && f.key)
        .map((f) => `${encodePart(resolve(f.key, vars), true)}=${encodePart(resolve(stringify(f.value), vars))}`);
      if (pairs.length) result.data = pairs.join("&");
      break;
    }
    case "formdata": {
      const forms: CurlForm[] = [];
      for (const f of (body.formdata ?? []) as PostmanFormField[]) {
        if (!f || f.disabled || !f.key) continue;
        const name = resolve(f.key, vars);
        if (f.type === "file") {
          const src = Array.isArray(f.src) ? f.src[0] : f.src;
          if (!src) result.warnings.push(`File field "${name}" has no source path; replace the placeholder.`);
          forms.push({ field: `${name}=@${src ? resolve(src, vars) : "path/to/file"}` });
        } else {
          const value = resolve(stringify(f.value), vars);
          const type = f.contentType ? `;type=${resolve(f.contentType, vars)}` : "";
          forms.push({ field: `${name}=${value}${type}`, literal: /^[@<]/.test(value) });
        }
      }
      if (forms.length) result.forms = forms;
      break;
    }
    case "file": {
      const src = body.file?.src;
      result.dataBinary = `@${src ? resolve(src, vars) : "path/to/file"}`;
      if (!src) result.warnings.push("File body has no source path; replace the placeholder.");
      break;
    }
    case "graphql": {
      const query = resolve(body.graphql?.query ?? "", vars);
      const payload: Record<string, unknown> = { query };
      const rawVars = body.graphql?.variables;
      if (rawVars !== undefined && rawVars !== "") {
        if (typeof rawVars === "string") {
          const text = resolve(rawVars, vars);
          try {
            payload.variables = JSON.parse(text);
          } catch {
            payload.variables = text; // keep what the user wrote rather than drop it
          }
        } else {
          payload.variables = JSON.parse(resolve(JSON.stringify(rawVars), vars));
        }
      }
      result.data = JSON.stringify(payload, null, 2);
      result.contentType = "application/json";
      break;
    }
    default:
      break;
  }
  return result;
}

// ── request ──────────────────────────────────────────────────────────────────

function parseHeaders(header: PostmanRequest["header"]): PostmanHeader[] {
  if (Array.isArray(header)) return header;
  if (typeof header !== "string") return [];
  return header
    .split(/\r?\n/)
    .map((line) => {
      const at = line.indexOf(":");
      return at < 0 ? null : { key: line.slice(0, at).trim(), value: line.slice(at + 1).trim() };
    })
    .filter((h): h is PostmanHeader => !!h && h.key !== "");
}

interface Converted {
  curl: string;
  url: string;
  method: string;
  unresolved: string[];
  warnings: string[];
}

function convertRequest(request: PostmanRequest | string, vars: Vars, inheritedAuth: PostmanAuth | undefined): Converted {
  const req: PostmanRequest = typeof request === "string" ? { url: request } : request;
  const method = (req.method || "GET").toUpperCase();

  // Request auth wins; "inherit" and a missing auth fall through to folder / collection auth.
  const auth = req.auth && req.auth.type && req.auth.type !== "inherit" ? req.auth : inheritedAuth;
  const authResult = mapAuth(auth, vars);

  const { url, unresolved } = buildUrl(req.url, vars, authResult.query);

  const headers: Array<[string, string]> = [];
  for (const h of parseHeaders(req.header)) {
    if (!h || h.disabled || !h.key) continue;
    headers.push([resolve(h.key, vars), resolve(stringify(h.value), vars)]);
  }
  for (const [name, value] of authResult.headers) {
    if (!hasHeaderNamed(headers, name)) headers.push([name, value]);
  }

  const body = mapBody(req.body, vars);
  if (body.contentType && !hasHeaderNamed(headers, "Content-Type")) headers.push(["Content-Type", body.contentType]);

  const parts: CurlParts = {
    method,
    url,
    headers,
    user: authResult.user !== undefined && !hasHeaderNamed(headers, "Authorization") ? authResult.user : undefined,
    userMode: authResult.userMode,
    data: body.data,
    dataBinary: body.dataBinary,
    forms: body.forms,
  };
  const curl = renderCurl(parts);
  return {
    curl,
    url,
    method,
    unresolved: [...findPlaceholders(curl), ...unresolved],
    warnings: [...authResult.warnings, ...body.warnings],
  };
}

interface Scope {
  /** Collection and folder variables, inner folders over outer ones. */
  vars: Vars;
  /** Environment variables; they beat every collection-level variable. */
  env: Vars;
  auth: PostmanAuth | undefined;
  folders: string[];
}

const ownAuth = (auth: PostmanAuth | undefined) => (auth && auth.type && auth.type !== "inherit" ? auth : undefined);

function extractItems(items: PostmanItem[], scope: Scope, out: ImportedRequest[]): void {
  for (const item of items) {
    if (!item) continue;
    if (Array.isArray(item.item)) {
      extractItems(
        item.item,
        {
          ...scope,
          vars: { ...scope.vars, ...variablesFromList(item.variable) },
          auth: ownAuth(item.auth) ?? scope.auth,
          folders: item.name ? [...scope.folders, item.name] : scope.folders,
        },
        out,
      );
    } else if (item.request) {
      const vars = { ...scope.vars, ...variablesFromList(item.variable), ...scope.env };
      const converted = convertRequest(item.request, vars, ownAuth(item.auth) ?? scope.auth);
      out.push({
        // Postman ids repeat across copies of a request, and the dialog selects by id.
        id: String(out.length),
        name: item.name || "Request",
        method: converted.method,
        url: converted.url,
        curlCommand: converted.curl,
        folder: scope.folders.length ? scope.folders.join(" / ") : undefined,
        unresolvedVariables: converted.unresolved.length ? converted.unresolved : undefined,
        warnings: converted.warnings.length ? converted.warnings : undefined,
      });
    }
  }
}

/**
 * Converts a Postman collection to cURL commands. `{{variables}}` are resolved from the environment
 * first, then from request/folder/collection variables (inner scopes over outer ones).
 */
export function parsePostmanCollection(
  collection: PostmanCollection,
  environment?: PostmanEnvironment | null,
): ImportedRequest[] {
  const out: ImportedRequest[] = [];
  extractItems(
    collection.item || [],
    {
      vars: variablesFromList(collection.variable),
      env: environmentVariables(environment),
      auth: ownAuth(collection.auth),
      folders: [],
    },
    out,
  );
  return out;
}
