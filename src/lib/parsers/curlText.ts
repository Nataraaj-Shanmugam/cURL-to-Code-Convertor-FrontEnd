/** Shared by the Postman and OpenAPI importers: renders request parts as one cURL command. */

export function shellEscape(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

export interface CurlForm {
  /** `name=value`, or `name=@path` for a file part. */
  field: string;
  /** Use --form-string so a leading `@` / `<` in a text value is not treated as a file. */
  literal?: boolean;
}

export interface CurlParts {
  method: string;
  url: string;
  headers?: Array<[string, string]>;
  /** `user:password`, sent with -u. */
  user?: string;
  userMode?: "digest" | "ntlm";
  /** `a=1; b=2`, sent with -b. */
  cookie?: string;
  data?: string;
  /** Sent with --data-binary (file bodies). */
  dataBinary?: string;
  forms?: CurlForm[];
}

export function renderCurl(p: CurlParts): string {
  const out: string[] = ["curl"];
  const method = p.method.toUpperCase();
  const hasBody = p.data !== undefined || p.dataBinary !== undefined || (p.forms?.length ?? 0) > 0;
  // -d/-F turn a request into a POST by themselves, so a GET that carries a body must say -X GET.
  if (method !== "GET" || hasBody) out.push(`-X ${method}`);
  out.push(shellEscape(p.url));
  for (const [name, value] of p.headers ?? []) out.push(`-H ${shellEscape(`${name}: ${value}`)}`);
  if (p.userMode) out.push(`--${p.userMode}`);
  if (p.user !== undefined) out.push(`-u ${shellEscape(p.user)}`);
  if (p.cookie) out.push(`-b ${shellEscape(p.cookie)}`);
  if (p.data !== undefined) out.push(`-d ${shellEscape(p.data)}`);
  if (p.dataBinary !== undefined) out.push(`--data-binary ${shellEscape(p.dataBinary)}`);
  for (const form of p.forms ?? []) out.push(`${form.literal ? "--form-string" : "-F"} ${shellEscape(form.field)}`);
  return out.join(" \\\n  ");
}

export function hasHeaderNamed(headers: Array<[string, string]>, name: string): boolean {
  const wanted = name.toLowerCase();
  return headers.some(([h]) => h.toLowerCase() === wanted);
}

/** `{{name}}` placeholders left in a command, in order of first appearance, without duplicates. */
export function findPlaceholders(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
    const name = match[1]!;
    if (!found.includes(name)) found.push(name);
  }
  return found;
}

const SKIP = /(\{\{[^{}]*\}\}|%[0-9A-Fa-f]{2})/;

/** Applies `encode` to everything except `{{placeholders}}` and existing %XX escapes. */
export function encodeKeepingPlaceholders(text: string, encode: (plain: string) => string): string {
  return text
    .split(SKIP)
    .map((piece, i) => (i % 2 === 1 ? piece : piece === "" ? "" : encode(piece)))
    .join("");
}
