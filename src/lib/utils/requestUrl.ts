import type { ParsedCurl } from "@/types/curl";
import { buildFullUrl } from "./urlBuilder";
import { deepEqual } from "./deepEqual";

/**
 * Keeps `url` and its parts (`base_url`, `endpoint`, `query_params`) consistent: the backend
 * receives all four, so an edit to one side must be reflected on the other.
 */

export interface UrlParts {
  base_url: string;
  endpoint: string;
  query_params: Record<string, unknown>;
}

const isBlank = (value: unknown): boolean =>
  value === undefined || value === null || (typeof value === "string" && value.trim() === "");

const isEmptyRecord = (value: unknown): boolean =>
  typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length === 0;

/** Query parameters of a URL; a repeated name becomes an array, like the backend's parser. */
const queryParamsOf = (search: URLSearchParams): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  search.forEach((value, key) => {
    if (key === "__proto__" || key === "prototype" || key === "constructor") return;
    const prev = out[key];
    if (prev === undefined) out[key] = value;
    else if (Array.isArray(prev)) prev.push(value);
    else out[key] = [prev, value];
  });
  return out;
};

export const buildQueryString = (params: Record<string, unknown> | undefined): string => {
  if (!params || typeof params !== "object") return "";
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (Array.isArray(v)) v.forEach(item => search.append(k, String(item)));
    else search.append(k, String(v ?? ""));
  });
  return search.toString();
};

/**
 * Splits an absolute URL. When `currentBaseUrl` is a prefix of the URL (e.g. a base with a path
 * such as `https://host/v1`), it is kept and only the rest becomes the endpoint.
 * Returns null for anything `URL` can't parse (scheme-less hosts, `{{templates}}`).
 */
export const splitUrl = (url: unknown, currentBaseUrl?: unknown): UrlParts | null => {
  if (typeof url !== "string" || !url.trim()) return null;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url.trim());
  } catch {
    return null;
  }
  if (!/^https?:$/.test(parsedUrl.protocol)) return null;

  const origin = `${parsedUrl.protocol}//${parsedUrl.host}`;
  let base_url = origin;
  let endpoint = parsedUrl.pathname || "/";
  if (typeof currentBaseUrl === "string" && currentBaseUrl) {
    const base = currentBaseUrl.replace(/\/+$/, "");
    const withoutQuery = url.trim().split(/[?#]/)[0]!;
    if (base.length > origin.length && withoutQuery.startsWith(base)) {
      const rest = withoutQuery.slice(base.length);
      if (rest === "" || rest.startsWith("/")) {
        base_url = currentBaseUrl;
        endpoint = rest || "/";
      }
    }
  }
  return { base_url, endpoint, query_params: queryParamsOf(parsedUrl.searchParams) };
};

/**
 * Defensive normalisation of a parse result (restored from production's `normalizeParsedCurl`):
 * derives `base_url`, `endpoint` and `query_params` from `url` when the backend left them out,
 * builds `url` from its parts when it is missing, defaults `method`, and falls back to `raw_data`
 * for a missing body. Unlike production it keeps every other field as returned, including
 * `false`, `0`, empty values and config sections.
 */
export const normalizeParsedCurl = (raw: ParsedCurl): ParsedCurl => {
  const out = { ...raw } as ParsedCurl;
  out.method = typeof out.method === "string" && out.method.trim() ? out.method.trim().toUpperCase() : "GET";

  if ((out.data === undefined || out.data === null) && typeof out.raw_data === "string" && out.raw_data) {
    out.data = out.raw_data;
  }

  const parts = splitUrl(out.url, out.base_url);
  if (parts) {
    if (isBlank(out.base_url)) out.base_url = parts.base_url;
    if (isBlank(out.endpoint)) out.endpoint = parts.endpoint;
    const hasQuery = Object.keys(parts.query_params).length > 0;
    if (hasQuery && (out.query_params === undefined || out.query_params === null || isEmptyRecord(out.query_params))) {
      out.query_params = parts.query_params;
    }
  } else if (isBlank(out.url) && !isBlank(out.base_url)) {
    out.url = buildFullUrl(out);
  }
  return out;
};

/**
 * Called with the state before and after an edit. If the URL was edited, its parts are
 * re-derived; if a part was edited, the URL is rebuilt. A method edit is upper-cased.
 */
export const syncRequestUrl = (prev: ParsedCurl, next: ParsedCurl): ParsedCurl => {
  let out = next;

  if (typeof next.method === "string" && next.method !== prev.method) {
    const method = next.method.trim().toUpperCase();
    if (method !== next.method) out = { ...out, method };
  }

  const urlChanged = next.url !== prev.url;
  const baseOrEndpointChanged = next.base_url !== prev.base_url || next.endpoint !== prev.endpoint;
  const queryChanged = !deepEqual(next.query_params, prev.query_params);

  if (urlChanged && !baseOrEndpointChanged && !queryChanged) {
    const parts = splitUrl(next.url, prev.base_url);
    if (!parts) return out;
    const hadQuery = next.query_params !== undefined || Object.keys(parts.query_params).length > 0;
    return {
      ...out,
      base_url: parts.base_url,
      endpoint: parts.endpoint,
      ...(hadQuery ? { query_params: parts.query_params } : {}),
    };
  }

  if (!urlChanged && (baseOrEndpointChanged || queryChanged) && typeof next.url === "string") {
    let url: string;
    if (baseOrEndpointChanged) {
      url = buildFullUrl(out);
    } else {
      const qs = buildQueryString(next.query_params);
      url = next.url.split(/[?#]/)[0]! + (qs ? `?${qs}` : "");
    }
    if (url && url !== next.url) out = { ...out, url };
  }
  return out;
};
