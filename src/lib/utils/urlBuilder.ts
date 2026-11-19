import type { ParsedCurl } from "@/types/curl";
import { MASK, REDACTED_PLACEHOLDER } from "@/lib/utils/redaction";

/**
 * The one place that turns a ParsedCurl into a URL. The URL bar, the reconstructed cURL and any
 * future consumer must go through here so they cannot disagree about what is sent.
 */

const PERCENT_ESCAPE = /(%[0-9A-Fa-f]{2})/;

/** Placeholders that stand in for a secret on screen; they are display text, never encoded. */
const MASK_TOKENS = [MASK, REDACTED_PLACEHOLDER];

function encodeSegment(text: string, keepBrackets: boolean): string {
  // An existing %XX escape is kept as is, so a value that arrives already encoded is not double-encoded.
  return text
    .split(PERCENT_ESCAPE)
    .map((piece, i) => {
      if (i % 2 === 1) return piece;
      const encoded = encodeURIComponent(piece);
      return keepBrackets ? encoded.replace(/%5B/g, "[").replace(/%5D/g, "]") : encoded;
    })
    .join("");
}

function encodeKeepingMasks(text: string, keepBrackets: boolean): string {
  const pattern = new RegExp(`(${MASK_TOKENS.map(escapeRegExp).join("|")})`);
  return text
    .split(pattern)
    .map((piece, i) => (i % 2 === 1 ? piece : encodeSegment(piece, keepBrackets)))
    .join("");
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Percent-encodes one path segment value. Keeps 0 and false (they are values), masks stay readable. */
export function encodePathValue(value: unknown): string {
  return encodeKeepingMasks(stringifyValue(value), false);
}

/** Percent-encodes one query key or value. */
export function encodeQueryPart(value: unknown, isKey = false): string {
  return encodeKeepingMasks(stringifyValue(value), isKey);
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Every `{name}` placeholder in the endpoint gets its value. 0, false and "" are real values. */
function applyPathParameters(path: string, parameters: unknown): string {
  const entries: Array<[string, unknown]> = [];
  if (Array.isArray(parameters)) {
    for (const param of parameters) {
      if (!isPlainObject(param)) continue;
      const name = String(param.name ?? param.key ?? "");
      if (name) entries.push([name, param.value]);
    }
  } else if (isPlainObject(parameters)) {
    for (const [name, param] of Object.entries(parameters)) {
      entries.push([name, isPlainObject(param) && "value" in param ? param.value : param]);
    }
  }
  let result = path;
  for (const [name, value] of entries) {
    if (value === undefined || value === null) continue; // no value yet: keep the placeholder visible
    result = result.split(`{${name}}`).join(encodePathValue(value));
  }
  return result;
}

export function buildQueryString(query: ParsedCurl["query_params"]): string {
  if (!isPlainObject(query)) return "";
  const pairs: string[] = [];
  const push = (key: string, value: unknown) => {
    const k = encodeQueryPart(key, true);
    pairs.push(value === undefined ? k : `${k}=${encodeQueryPart(value)}`);
  };
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) value.forEach((item) => push(key, item));
    else push(key, value);
  }
  return pairs.join("&");
}

export function buildFullUrl(parsed: ParsedCurl): string {
  let base = parsed.base_url || "";
  let path = parsed.endpoint || "";

  // Older/partial payloads only carry `url`.
  if (!base && !path && parsed.url) {
    const queryAt = parsed.url.search(/[?#]/);
    base = queryAt < 0 ? parsed.url : parsed.url.slice(0, queryAt);
    path = "";
    if (queryAt >= 0 && parsed.url[queryAt] === "?") path = parsed.url.slice(queryAt);
  }

  path = applyPathParameters(path, parsed.path_parameters);
  let url = base.replace(/\/$/, "") + path;

  const qs = buildQueryString(parsed.query_params);
  if (qs) url += (url.includes("?") ? "&" : "?") + qs;
  return url;
}
