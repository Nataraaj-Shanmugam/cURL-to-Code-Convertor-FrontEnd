import type { ParsedCurl } from "@/types/curl";
import { buildFullUrl } from "@/lib/utils/urlBuilder";
import { isInsecureCurl } from "@/lib/utils/insecureFlag";

function shellEscape(s: string): string {
  // Use single-quote wrapping; escape embedded single quotes as '\''
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

type Rec = Record<string, unknown>;

function isRec(value: unknown): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const normalizeKey = (key: string) => key.trim().toLowerCase().replace(/^-+/, "").replace(/-/g, "_");

/**
 * The backend groups cURL options into config sections and the exact section a flag lands in is not
 * fixed, so look in every section that can carry transfer options (as insecureFlag.ts does for -k).
 */
const OPTION_SECTIONS = [
  "transfer_config",
  "network_config",
  "protocol_config",
  "misc_flags",
  "flags",
  "proxy_config",
  "auth_config",
] as const;

function findOption(parsed: ParsedCurl, names: readonly string[]): unknown {
  const wanted = new Set(names);
  const record = parsed as unknown as Rec;
  const scan = (source: unknown): unknown => {
    if (!isRec(source)) return undefined;
    for (const [key, value] of Object.entries(source)) {
      if (wanted.has(normalizeKey(key)) && value !== undefined && value !== null) return value;
    }
    return undefined;
  };
  const top = scan(record);
  if (top !== undefined) return top;
  for (const section of OPTION_SECTIONS) {
    const found = scan(record[section]);
    if (found !== undefined) return found;
  }
  return undefined;
}

const isTrue = (value: unknown) => value === true || value === "true";

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

/** Body text exactly as it is sent; `0`, `false` and `{}` are bodies, only absent/empty is not. */
export function bodyToString(data: ParsedCurl["data"]): string {
  if (data === undefined || data === null || data === "") return "";
  return typeof data === "object" ? JSON.stringify(data, null, 2) : String(data);
}

function credentialsOf(parsed: ParsedCurl): { user: string; mode?: string } | null {
  const record = parsed as unknown as Rec;
  const auth = record.auth_config ?? record.auth;
  if (typeof auth === "string") return auth ? { user: auth } : null;
  if (!isRec(auth)) return null;
  const type = String(auth.type ?? auth.auth_type ?? auth.scheme ?? "").toLowerCase();
  const username = auth.username ?? auth.user ?? auth.login;
  const password = auth.password ?? auth.pass ?? auth.pwd;
  if (isBlank(username)) return null;
  const user = String(username);
  const full = user.includes(":") || isBlank(password) ? user : `${user}:${String(password)}`;
  return { user: full, mode: type };
}

function bearerOf(parsed: ParsedCurl): string | null {
  const auth = (parsed as unknown as Rec).auth_config;
  if (!isRec(auth)) return null;
  const type = String(auth.type ?? auth.auth_type ?? "").toLowerCase();
  const token = auth.token ?? auth.bearer_token ?? auth.access_token;
  return type === "bearer" && !isBlank(token) ? String(token) : null;
}

function proxyOf(parsed: ParsedCurl): { url?: string; user?: string } {
  const record = parsed as unknown as Rec;
  const section = isRec(record.proxy_config) ? record.proxy_config : {};
  const pick = (source: Rec, names: readonly string[]) => {
    for (const [key, value] of Object.entries(source)) {
      if (names.includes(normalizeKey(key)) && typeof value === "string" && value) return value;
    }
    return undefined;
  };
  // Top level only knows `proxy`: its `url` is the request URL, not the proxy's.
  const url = pick(section, ["proxy", "proxy_url", "url", "x"]) ?? pick(record, ["proxy"]);
  const user = pick(section, ["proxy_user", "proxy_userpwd", "proxy_credentials", "u"]);
  return { url, user };
}

function hasHeader(headers: Record<string, string> | undefined, name: string): boolean {
  return !!headers && Object.keys(headers).some((h) => h.toLowerCase() === name.toLowerCase());
}

export function reconstructCurl(parsed: ParsedCurl): string {
  const parts: string[] = ["curl"];
  const method = (parsed.method || "GET").toUpperCase();
  const body = bodyToString(parsed.data);
  const form =
    isRec(parsed.form_data) && Object.keys(parsed.form_data).length > 0 ? parsed.form_data : undefined;
  const hasBody = body !== "" || !!form;

  // `-d`/`-F` make cURL switch to POST on their own, so any other method has to be said out loud.
  // A GET that carries a body must stay a GET.
  if (method === "HEAD" && !hasBody) parts.push("-I");
  else if (method !== "GET" || hasBody) parts.push(`-X ${method}`);

  // Transfer options that change what is sent / how it is followed
  if (isInsecureCurl(parsed)) parts.push("-k");
  if (isTrue(findOption(parsed, ["compressed"]))) parts.push("--compressed");
  const follow = findOption(parsed, ["location", "l", "follow_redirects", "follow", "follow_location"]);
  if (isTrue(follow)) parts.push("-L");
  const maxRedirs = findOption(parsed, ["max_redirs"]);
  if (typeof maxRedirs === "number" && isTrue(follow)) parts.push(`--max-redirs ${maxRedirs}`);

  // URL
  parts.push(shellEscape(buildFullUrl(parsed)));

  // Proxy
  const proxy = proxyOf(parsed);
  if (proxy.url) parts.push(`-x ${shellEscape(proxy.url)}`);
  if (proxy.user) parts.push(`-U ${shellEscape(proxy.user)}`);

  // Credentials
  const credentials = credentialsOf(parsed);
  if (credentials) {
    if (credentials.mode === "digest") parts.push("--digest");
    else if (credentials.mode === "ntlm") parts.push("--ntlm");
    parts.push(`-u ${shellEscape(credentials.user)}`);
  }

  // Headers
  const headers = isRec(parsed.headers) ? (parsed.headers as Record<string, string>) : undefined;
  if (headers) {
    Object.entries(headers).forEach(([k, v]) => {
      parts.push(`-H ${shellEscape(`${k}: ${v}`)}`);
    });
  }
  const bearer = bearerOf(parsed);
  if (bearer && !hasHeader(headers, "authorization")) {
    parts.push(`-H ${shellEscape(`Authorization: Bearer ${bearer}`)}`);
  }
  if (typeof parsed.user_agent === "string" && parsed.user_agent && !hasHeader(headers, "user-agent")) {
    parts.push(`-A ${shellEscape(parsed.user_agent)}`);
  }
  if (typeof parsed.referer === "string" && parsed.referer && !hasHeader(headers, "referer")) {
    parts.push(`-e ${shellEscape(parsed.referer)}`);
  }

  // Cookies
  if (isRec(parsed.cookies)) {
    const cookieStr = Object.entries(parsed.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
    if (cookieStr) parts.push(`-b ${shellEscape(cookieStr)}`);
  }

  // Body
  if (body !== "") {
    parts.push(`-d ${shellEscape(body)}`);
  } else if (form) {
    Object.entries(form).forEach(([k, v]) => {
      parts.push(`-F ${shellEscape(`${k}=${v}`)}`);
    });
  }

  return parts.join(" \\\n  ");
}
