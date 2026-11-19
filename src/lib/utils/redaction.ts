/**
 * Secret redaction for cURL requests, parsed requests and generated code.
 *
 * Everything here is pure: inputs are never mutated and nothing touches storage or the DOM.
 *
 * What counts as a secret:
 *  - values of the Authorization, Proxy-Authorization, Cookie and Set-Cookie headers;
 *  - values of headers, query parameters, form fields and JSON body keys whose NAME matches
 *    SECRET_NAME_PATTERN (token, key, secret, password, session, auth, ...);
 *  - basic-auth credentials (`-u user:pass`, `auth_config`), proxy credentials, URL userinfo;
 *  - every value in the cookies section;
 *  - every value nested under a secret-named key (`{"auth": {"p": "..."}}`);
 *  - JWT-shaped values (`eyJ...`) under any name, anywhere;
 *  - secret-named parameters in a URL query string or #fragment (`#access_token=...`);
 *  - payment data: card numbers, CVV/CVC, PAN, account numbers, IBAN, SSN (by name);
 *  - text of XML elements with a secret name (`<password>...</password>`);
 *  - the password part of a client certificate (`-E cert.pem:password`).
 *
 * The name test is a substring match, so it over-redacts on purpose (`author`, `monkey`, ...).
 * A masked harmless value costs the user one click; a leaked credential costs much more.
 */
import type { ParsedCurl } from "@/types/curl";

/** Stored in place of a secret. Persisted/attached data uses this, so restored fields can be detected. */
export const REDACTED_PLACEHOLDER = "[REDACTED]";

/** Shown in place of a secret on screen while its value is hidden. */
export const MASK = "••••••••";

/** Header, query, form and body-key names that hold secrets. Case-insensitive substring test. */
export const SECRET_NAME_PATTERN =
  /token|key|secret|passw(?:or)?d|passphrase|passcode|pwd|session|auth|credential|bearer|jwt|signature|hmac|csrf|xsrf|verifier|cvv|cvc|(?:card|account|acct).?(?:num|no(?![a-z]))/i;

/**
 * Short secret words that would over-match as substrings (`shipping`, `design`, `compass`, `footprint`):
 * matched as whole words of the name instead (`X-Pass`, `user_pin`, `otpCode`, `?sig=`).
 */
const SECRET_NAME_WORDS = new Set(["pass", "pin", "otp", "totp", "hotp", "mfa", "sig", "pan", "cvn", "iban", "ssn"]);

/** Names that contain a secret word but are not secret: the HTTP/2 `:authority` header is the host. */
const NOT_SECRET_NAMES = new Set(["authority", ":authority"]);

/** Names that are secret only on their own: the OAuth authorization `code` (`?code=...`). */
const SECRET_EXACT_NAMES = new Set(["code"]);

/** A JSON Web Token: base64url `{"...` header, payload and (possibly empty) signature. */
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]*/g;

const ALWAYS_SECRET_HEADERS = new Set(["authorization", "proxy-authorization", "cookie", "set-cookie"]);

const AUTH_SCHEMES = new Set([
  "bearer",
  "basic",
  "digest",
  "token",
  "negotiate",
  "ntlm",
  "hawk",
  "apikey",
  "api-key",
  "oauth",
  "mac",
  "aws4-hmac-sha256",
]);

const COOKIE_ATTRIBUTES = new Set([
  "path",
  "domain",
  "expires",
  "max-age",
  "samesite",
  "secure",
  "httponly",
  "partitioned",
  "priority",
]);

/** Keys inside auth_config that describe HOW to authenticate rather than WHAT the credentials are. */
const AUTH_CONFIG_SAFE_KEYS = new Set(["type", "auth_type", "authtype", "scheme", "method", "mode", "algorithm", "realm"]);

/** Credential-ish keys inside the other *_config sections (proxy_config.proxy_user, ftp_config.user, ...). */
const CONFIG_USER_KEY = /^(?:[a-z]+_)?(?:user|username|login)$/i;

/** Client-certificate keys inside ssl_config (`cert: "client.pem:password"`). */
const CONFIG_CERT_KEY = /^(?:[a-z]+_)?cert(?:ificate)?$/i;

/** Minimum length for value-based replacement in free text, to avoid mangling code around short secrets. */
const MIN_KNOWN_SECRET_LENGTH = 6;

export interface RedactOptions {
  /** Replacement text. Defaults to REDACTED_PLACEHOLDER; pass MASK for on-screen masking. */
  placeholder?: string;
  /** Exact secret values to scrub from free text (see collectSecretValues). */
  knownSecrets?: readonly string[];
  /** Called with every secret substring that gets replaced. */
  collect?: (secret: string) => void;
}

type Sub = (secret: string) => string;

function makeSub(opts: RedactOptions): Sub {
  const placeholder = opts.placeholder ?? REDACTED_PLACEHOLDER;
  return (secret: string) => {
    if (secret.trim() === "") return secret;
    // Already redacted/masked (keeps every function idempotent).
    if (secret === REDACTED_PLACEHOLDER || secret === MASK || secret === placeholder) return secret;
    opts.collect?.(secret);
    return placeholder;
  };
}

// ── name tests ───────────────────────────────────────────────────────────────

/** `X-Hub-Signature-256` -> [x, hub, signature, 256]; `setPinCode` -> [set, pin, code]. */
function nameWords(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function isSecretName(name: string): boolean {
  if (NOT_SECRET_NAMES.has(name.trim().toLowerCase())) return false;
  if (SECRET_NAME_PATTERN.test(name)) return true;
  if (SECRET_EXACT_NAMES.has(name.trim().toLowerCase())) return true;
  return nameWords(name).some((word) => SECRET_NAME_WORDS.has(word));
}

export function isSecretHeaderName(name: string): boolean {
  return ALWAYS_SECRET_HEADERS.has(name.trim().toLowerCase()) || isSecretName(name);
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    return s;
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// ── value-level helpers ──────────────────────────────────────────────────────

/** Replace every string/number leaf (booleans and null stay), optionally skipping some keys. */
function mapLeaves(value: unknown, sub: Sub, safeKeys?: ReadonlySet<string>): unknown {
  if (typeof value === "string") return sub(value);
  if (typeof value === "number") return sub(String(value));
  if (Array.isArray(value)) return value.map((item) => mapLeaves(item, sub, safeKeys));
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = safeKeys?.has(k.toLowerCase()) ? clone(v) : mapLeaves(v, sub, safeKeys);
    }
    return out;
  }
  return value;
}

function clone(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clone);
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = clone(v);
    return out;
  }
  return value;
}

/** Replaces every JWT-shaped substring, whatever the name it sits under. */
function scrubJwts(text: string, sub: Sub): string {
  return text.replace(JWT_PATTERN, (jwt) => sub(jwt));
}

/** scrubJwts on every string leaf. */
function scrubJwtsDeep(value: unknown, sub: Sub): unknown {
  if (typeof value === "string") return scrubJwts(value, sub);
  if (Array.isArray(value)) return value.map((item) => scrubJwtsDeep(item, sub));
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = scrubJwtsDeep(v, sub);
    return out;
  }
  return value;
}

export function redactAuthorizationValue(value: string, opts: RedactOptions = {}): string {
  const sub = makeSub(opts);
  const match = /^\s*([A-Za-z][\w.-]*)\s+([\s\S]+)$/.exec(value);
  if (match && AUTH_SCHEMES.has(match[1]!.toLowerCase())) return `${match[1]} ${sub(match[2]!.trim())}`;
  return sub(value);
}

/** `a=1; b=2` -> `a=<secret>; b=<secret>`. Names and Set-Cookie attributes stay; bare tokens (file names) stay. */
export function redactCookieString(value: string, opts: RedactOptions = {}): string {
  const sub = makeSub(opts);
  return value
    .split(";")
    .map((segment) => {
      const eq = segment.indexOf("=");
      if (eq < 0) return segment;
      const name = segment.slice(0, eq);
      const val = segment.slice(eq + 1);
      if (COOKIE_ATTRIBUTES.has(name.trim().toLowerCase()) || val.trim() === "") return segment;
      const lead = /^\s*/.exec(val)![0];
      return `${name}=${lead}${sub(val.trim())}`;
    })
    .join(";");
}

/**
 * Redacts userinfo (`https://user:pass@host`), secret-named query and #fragment parameters (OAuth
 * implicit flow puts `access_token` in the fragment) and JWTs inside a URL or any text.
 */
export function redactUrlString(text: string, opts: RedactOptions = {}): string {
  const sub = makeSub(opts);
  const out = text
    .replace(/(:\/\/)([^/\s@?#'"]+)@/g, (_m, scheme: string, userinfo: string) => `${scheme}${sub(userinfo)}@`)
    // A cmd-escaped `^&` / closing `^"` ends the value; the caret is kept.
    .replace(/([?&#])([^=&#\s'"]+)=((?:[^&#\s'"^]|\^(?![&"]))*)/g, (m, sep: string, name: string, val: string) => {
      if (!val || !isSecretName(safeDecode(name))) return m;
      return `${sep}${name}=${sub(val)}`;
    });
  return scrubJwts(out, sub);
}

/** Redacts one header value according to the header's name. Non-secret headers only get their URLs scrubbed. */
export function redactHeaderValue(name: string, value: unknown, opts: RedactOptions = {}): unknown {
  const sub = makeSub(opts);
  const lower = name.trim().toLowerCase();
  if (typeof value !== "string") return isSecretHeaderName(name) ? mapLeaves(value, sub) : clone(value);
  if (lower === "cookie" || lower === "set-cookie") return redactCookieString(value, opts);
  if (lower === "authorization" || lower === "proxy-authorization") return redactAuthorizationValue(value, opts);
  if (isSecretName(name)) return sub(value);
  return redactUrlString(value, opts);
}

function redactFormEncoded(body: string, opts: RedactOptions): string {
  const sub = makeSub(opts);
  return body
    .split("&")
    .map((pair) => {
      const eq = pair.indexOf("=");
      if (eq < 0) return pair;
      const name = pair.slice(0, eq);
      const val = pair.slice(eq + 1);
      if (!name.trim() || !val || val.startsWith("@") || !isSecretName(safeDecode(name.trim()))) return pair;
      return `${name}=${sub(val)}`;
    })
    .join("&");
}

/** How deep stringified JSON inside JSON is unwrapped before giving up. */
const MAX_NESTED_JSON_DEPTH = 4;

/** `{ name: "Authorization", value: "Bearer x" }` (HAR / Postman header lists): the name of the value. */
function pairName(value: Record<string, unknown>): string | undefined {
  if (!("value" in value)) return undefined;
  const name = value.name ?? value.key;
  return typeof name === "string" ? name : undefined;
}

function redactJsonValue(value: unknown, sub: Sub, opts: RedactOptions, depth = 0): unknown {
  if (typeof value === "string") {
    // A string leaf can itself be JSON (`{"payload": "{\"token\": ...}"}`) or carry `password: "..."` text.
    const trimmed = value.trim();
    if (depth < MAX_NESTED_JSON_DEPTH && (trimmed.startsWith("{") || trimmed.startsWith("["))) {
      return redactBodyStringAt(value, opts, depth + 1);
    }
    // Every free-text pattern needs one of these characters (JWTs are caught by redactSection).
    return /[:=("'@<]/.test(value) ? redactText(value, opts) : value;
  }
  if (Array.isArray(value)) return value.map((item) => redactJsonValue(item, sub, opts, depth));
  if (isPlainObject(value)) {
    const name = pairName(value);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (isSecretName(k)) out[k] = mapLeaves(v, sub);
      else if (k === "value" && name !== undefined && isSecretHeaderName(name)) out[k] = redactHeaderValue(name, v, opts);
      else out[k] = redactJsonValue(v, sub, opts, depth);
    }
    return out;
  }
  return value;
}

/** A request body held as a string: JSON, url-encoded form, or anything else. */
export function redactBodyString(body: string, opts: RedactOptions = {}): string {
  return redactBodyStringAt(body, opts, 0);
}

function redactBodyStringAt(body: string, opts: RedactOptions, depth: number): string {
  const sub = makeSub(opts);
  const trimmed = body.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const redacted = redactJsonValue(parsed, sub, opts, depth);
      if (JSON.stringify(redacted) === JSON.stringify(parsed)) return body;
      return JSON.stringify(redacted, null, body.includes("\n") ? 2 : 0);
    } catch {
      return redactText(body, opts);
    }
  }
  if (/^&*[^=\s&]+=/.test(trimmed)) return scrubJwts(redactFormEncoded(body, opts), sub);
  return redactText(body, opts);
}

// ── free text (raw cURL, generated code) ─────────────────────────────────────

function matchingKnownSecrets(text: string, secrets: readonly string[], placeholder: string): string {
  const variants = new Set<string>();
  for (const secret of secrets) {
    if (secret.length < MIN_KNOWN_SECRET_LENGTH || secret === placeholder) continue;
    variants.add(secret);
    variants.add(JSON.stringify(secret).slice(1, -1));
    variants.add(encodeURIComponent(secret));
  }
  let out = text;
  for (const variant of [...variants].sort((a, b) => b.length - a.length)) {
    if (variant.length >= MIN_KNOWN_SECRET_LENGTH && out.includes(variant)) out = out.split(variant).join(placeholder);
  }
  return out;
}

/**
 * Finds adjacent string literals separated by `:`, `,` or `=` (name/value pairs) and redacts values of
 * secret names. A value split into literals joined with `+` (`"Bearer " + "abc"`) is judged, and
 * replaced, as one literal.
 */
function redactLiteralPairs(text: string, literal: RegExp, quoteLength: number, opts: RedactOptions): string {
  const tokens = [...text.matchAll(literal)].map((m) => ({ start: m.index!, end: m.index! + m[0].length }));
  if (tokens.length < 2) return text;
  const inner = (t: { start: number; end: number }) => text.slice(t.start + quoteLength, t.end - quoteLength);
  let out = "";
  let cursor = 0;
  for (let i = 0; i + 1 < tokens.length; i++) {
    const a = tokens[i]!;
    const b = tokens[i + 1]!;
    if (a.start < cursor || !/^\s*[:,=]\s*$/.test(text.slice(a.end, b.start))) continue;
    const name = inner(a);
    if (!isSecretHeaderName(name)) continue;
    let last = i + 1;
    while (last + 1 < tokens.length && /^\s*\+\s*$/.test(text.slice(tokens[last]!.end, tokens[last + 1]!.start))) last++;
    const value = tokens.slice(i + 1, last + 1).map(inner).join("");
    if (!value) continue;
    const replaced = redactHeaderValue(name, value, opts);
    if (typeof replaced !== "string" || replaced === value) continue;
    out += text.slice(cursor, b.start + quoteLength) + replaced;
    cursor = tokens[last]!.end - quoteLength;
    i = last - 1;
  }
  return out + text.slice(cursor);
}

/**
 * `"auth": { "user": "a", "p": "b" }`: every string literal VALUE inside an object or array that sits
 * under a secret-named key is redacted, whatever its own key is.
 */
function redactSecretContainers(text: string, literal: RegExp, quoteLength: number, sub: Sub): string {
  const tokens = [...text.matchAll(literal)].map((m) => ({ start: m.index!, end: m.index! + m[0].length }));
  const values: { start: number; end: number }[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i]!;
    const open = /^\s*:\s*[{[]/.exec(text.slice(t.end, t.end + 64));
    if (!open || !isSecretName(text.slice(t.start + quoteLength, t.end - quoteLength))) {
      i++;
      continue;
    }
    let pos = t.end + open[0].length;
    let depth = 1;
    let j = i + 1;
    while (pos < text.length && depth > 0) {
      while (j < tokens.length && tokens[j]!.start < pos) j++;
      const next = tokens[j];
      if (next && next.start === pos) {
        if (!/^\s*:/.test(text.slice(next.end, next.end + 16))) values.push(next);
        pos = next.end;
        j++;
        continue;
      }
      const ch = text[pos];
      if (ch === "{" || ch === "[") depth++;
      else if (ch === "}" || ch === "]") depth--;
      pos++;
    }
    i = j;
  }
  if (values.length === 0) return text;
  let out = "";
  let cursor = 0;
  for (const v of values) {
    const value = text.slice(v.start + quoteLength, v.end - quoteLength);
    out += text.slice(cursor, v.start + quoteLength) + sub(value);
    cursor = v.end - quoteLength;
  }
  return out + text.slice(cursor);
}

const ARG_START = String.raw`(?:^|[\s;&|])`;
const QUOTED_OR_BARE = String.raw`(?:'([^']*)'|"((?:[^"\\]|\\.)*)"|([^\s'"\\]+))`;
const QUOTED = String.raw`(?:'([^']*)'|"((?:[^"\\]|\\.)*)")`;

/** Re-emits a matched shell argument with `inner` swapped in, keeping its original quoting. */
function rebuildArg(prefix: string, single: string | undefined, double: string | undefined, bare: string | undefined, next: string): string {
  if (single !== undefined) return `${prefix}'${next}'`;
  if (double !== undefined) return `${prefix}"${next}"`;
  void bare;
  return `${prefix}${next}`;
}

/**
 * `cert.pem:password` (curl -E / --cert): the part after the first unescaped colon. A Windows drive
 * letter (`C:\\certs\\a.pem`) and a PKCS#11 URI are not a password separator.
 */
function redactCertArg(arg: string, sub: Sub): string {
  if (/^pkcs11:/i.test(arg)) return arg;
  for (let i = 0; i < arg.length; i++) {
    if (arg[i] === "\\") {
      i++;
      continue;
    }
    if (arg[i] !== ":") continue;
    if (i === 1 && /^[A-Za-z]:[\\/]/.test(arg)) continue;
    const pass = arg.slice(i + 1);
    return pass ? `${arg.slice(0, i + 1)}${sub(pass)}` : arg;
  }
  return arg;
}

/** curl --variable `name=value`: the value when the name is secret (`%ENV` imports and `name@file` stay). */
function redactVariableArg(arg: string, sub: Sub): string {
  const eq = arg.indexOf("=");
  if (arg.startsWith("%") || eq <= 0) return arg;
  const name = arg.slice(0, eq);
  const value = arg.slice(eq + 1);
  return value && !name.includes("@") && isSecretName(name) ? `${name}=${sub(value)}` : arg;
}

/** curl --url-query `name=value` (a leading `+` means "already encoded"). */
function redactUrlQueryArg(arg: string, opts: RedactOptions): string {
  const plus = arg.startsWith("+") ? "+" : "";
  return `${plus}${redactFormEncoded(arg.slice(plus.length), opts)}`;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replaces each secret inside `escaped`, a quoted argument whose characters may each carry the shell's
 * escape character (`^` for cmd, `` ` `` for PowerShell). The secrets were found in the unescaped text.
 */
function scrubEscaped(escaped: string, secrets: readonly string[], escapeChar: string, placeholder: string): string {
  const esc = escapeRegExp(escapeChar);
  let out = escaped;
  for (const secret of [...new Set(secrets)].sort((a, b) => b.length - a.length)) {
    if (!secret || secret === placeholder) continue;
    const pattern = [...secret].map((c) => `${esc}?${escapeRegExp(c)}`).join("");
    out = out.replace(new RegExp(pattern, "g"), placeholder);
  }
  return out;
}

/**
 * Chrome's "Copy as cURL (cmd)": every argument is `^"..."^"` with each special character escaped by
 * `^` (and `"` written `^\\^"`). Each such argument is redacted as the plain argument it stands for
 * (judged by the flag before it), then the secrets found are replaced in the escaped text, so the
 * command keeps its cmd quoting.
 */
const CMD_ARG = /(^|[\s;&|])(?:(-[A-Za-z]|--[a-z][\w-]*)(\s+|=))?\^"((?:\^\\\^"|\^[^"]|[^^\r\n])*)\^"/g;

function redactCmdArgs(text: string, opts: RedactOptions, placeholder: string): string {
  if (!text.includes('^"')) return text;
  return text.replace(CMD_ARG, (m: string, _start: string, flag: string | undefined, sep: string | undefined, inner: string) => {
    const plain = inner.replace(/\^(.)/g, "$1");
    const found: string[] = [];
    redactText(`curl ${flag ? `${flag}${sep}` : ""}"${plain}"`, { ...opts, knownSecrets: undefined, collect: (s) => found.push(s) });
    if (found.length === 0) return m;
    found.forEach((s) => opts.collect?.(s));
    return `${m.slice(0, m.length - inner.length - 2)}${scrubEscaped(inner, found, "^", placeholder)}^"`;
  });
}

/**
 * Chrome's "Copy as PowerShell": `-Body "{\`"password\`":\`"v\`"}"` (quotes escaped with a backtick)
 * and `New-Object System.Net.Cookie("name", "value", "/", "host")`.
 */
function redactPowerShell(text: string, opts: RedactOptions, sub: Sub, placeholder: string): string {
  if (!/-Body\b|System\.Net\.Cookie/i.test(text)) return text;
  return text
    .replace(
      /(System\.Net\.Cookie\s*\(\s*(?:"(?:[^"`]|`.)*"|'(?:[^']|'')*')\s*,\s*)(?:"((?:[^"`]|`.)*)"|'((?:[^']|'')*)')/gi,
      (_m, head: string, double?: string, single?: string) =>
        double !== undefined ? `${head}"${sub(double)}"` : `${head}'${sub(single ?? "")}'`,
    )
    .replace(/((?:^|\s)-Body\s+)"((?:[^"`]|`.)*)"/gi, (m: string, head: string, inner: string) => {
      const found: string[] = [];
      redactBodyString(inner.replace(/`(.)/g, "$1"), { ...opts, knownSecrets: undefined, collect: (s) => found.push(s) });
      if (found.length === 0) return m;
      found.forEach((s) => opts.collect?.(s));
      return `${head}"${scrubEscaped(inner, found, "`", placeholder)}"`;
    });
}

/**
 * Redacts secrets in free text: a raw cURL command, generated REST Assured code, or JSON.
 * Pattern-based, plus exact-value scrubbing when `knownSecrets` is given.
 */
export function redactText(text: string, opts: RedactOptions = {}): string {
  if (!text) return text;
  const placeholder = opts.placeholder ?? REDACTED_PLACEHOLDER;
  const sub = makeSub(opts);
  let out = opts.knownSecrets?.length ? matchingKnownSecrets(text, opts.knownSecrets, placeholder) : text;

  // Windows shells (Chrome's "Copy as cURL (cmd)" and "Copy as PowerShell").
  out = redactCmdArgs(out, opts, placeholder);
  out = redactPowerShell(out, opts, sub, placeholder);

  // curl -H / --header '<Name>: <value>'
  out = out.replace(
    new RegExp(`(${ARG_START}(?:-H|--header|--proxy-header)(?:\\s+|=)\\$?)${QUOTED}`, "g"),
    (m: string, prefix: string, single?: string, double?: string) => {
      const header = single ?? double ?? "";
      const colon = header.indexOf(":");
      if (colon < 0) return m;
      const name = header.slice(0, colon);
      const rawValue = header.slice(colon + 1);
      const lead = /^\s*/.exec(rawValue)![0];
      const redacted = redactHeaderValue(name, rawValue.trim(), opts);
      const quote = single !== undefined ? "'" : '"';
      return `${prefix}${quote}${name}:${lead}${String(redacted)}${quote}`;
    },
  );

  // Header lines outside -H arguments (raw HTTP, logs).
  out = out
    .replace(/((?:proxy-)?authorization[ \t]*:[ \t]*)((?:[^\r\n'"^]|\^(?!"))+)/gi, (_m, head: string, value: string) => `${head}${redactAuthorizationValue(value, opts)}`)
    .replace(/((?:set-)?cookie[ \t]*:[ \t]*)((?:[^\r\n'"^]|\^(?!"))+)/gi, (_m, head: string, value: string) => `${head}${redactCookieString(value, opts)}`);

  // curl -b / --cookie (short form may be attached: -bsid=x)
  out = out.replace(
    new RegExp(`(${ARG_START}(?:-b(?:\\s+|=)?|--cookie(?:\\s+|=)))${QUOTED_OR_BARE}`, "g"),
    (m: string, prefix: string, single?: string, double?: string, bare?: string) => {
      const inner = single ?? double ?? bare ?? "";
      if (!inner.includes("=")) return m; // a cookie jar file name
      return rebuildArg(prefix, single, double, bare, redactCookieString(inner, opts));
    },
  );

  // curl -u / --user / --proxy-user (short forms may be attached: -ubob:pw)
  out = out.replace(
    new RegExp(`(${ARG_START}(?:-[uU](?:\\s+|=)?|--user(?:\\s+|=)|--proxy-user(?:\\s+|=)))${QUOTED_OR_BARE}`, "g"),
    (m: string, prefix: string, single?: string, double?: string, bare?: string) => {
      const inner = single ?? double ?? bare ?? "";
      // `-Uri`, `-UseBasicParsing`, `-UserAgent`: PowerShell parameters, not curl's attached -u/-U.
      if (/-[uU]$/.test(prefix) && bare !== undefined && /^(?:ri|se[A-Za-z]*)$/i.test(bare)) return m;
      const colon = inner.indexOf(":");
      const next = colon < 0 ? sub(inner) : `${sub(inner.slice(0, colon))}:${sub(inner.slice(colon + 1))}`;
      return rebuildArg(prefix, single, double, bare, next);
    },
  );

  // curl --oauth2-bearer / --pass / --proxy-pass
  out = out.replace(
    new RegExp(`(${ARG_START}(?:--oauth2-bearer|--pass|--proxy-pass)(?:\\s+|=))${QUOTED_OR_BARE}`, "g"),
    (_m: string, prefix: string, single?: string, double?: string, bare?: string) =>
      rebuildArg(prefix, single, double, bare, sub(single ?? double ?? bare ?? "")),
  );

  // curl -E / --cert / --proxy-cert `file:password` (-E may be attached; `-ErrorAction` has no colon)
  out = out.replace(
    new RegExp(`(${ARG_START}(?:-E(?:\\s+|=)?|--cert(?:\\s+|=)|--proxy-cert(?:\\s+|=)))${QUOTED_OR_BARE}`, "g"),
    (m: string, prefix: string, single?: string, double?: string, bare?: string) => {
      const inner = single ?? double ?? bare ?? "";
      const next = redactCertArg(inner, sub);
      return next === inner ? m : rebuildArg(prefix, single, double, bare, next);
    },
  );

  // curl --url-query `name=value` / --variable `name=value`
  out = out.replace(
    new RegExp(`(${ARG_START}(--url-query|--variable)(?:\\s+|=))${QUOTED_OR_BARE}`, "g"),
    (m: string, prefix: string, flag: string, single?: string, double?: string, bare?: string) => {
      const inner = single ?? double ?? bare ?? "";
      const next = flag === "--variable" ? redactVariableArg(inner, sub) : redactUrlQueryArg(inner, opts);
      return next === inner ? m : rebuildArg(prefix, single, double, bare, next);
    },
  );

  // curl -d / --data* / -F with url-encoded or name=value content (JSON bodies are handled by the literal pairs below)
  out = out.replace(
    new RegExp(`(${ARG_START}(?:-d|--data|--data-raw|--data-binary|--data-ascii|--data-urlencode|--json|-F|--form|--form-string)(?:\\s+|=))${QUOTED}`, "g"),
    (m: string, prefix: string, single?: string, double?: string) => {
      const inner = single ?? double ?? "";
      const lead = inner.trimStart();
      if (lead.startsWith("{") || lead.startsWith("[") || lead.startsWith("@")) return m;
      return rebuildArg(prefix, single, double, undefined, redactFormEncoded(inner, opts));
    },
  );

  // REST Assured: .cookie("name", "value"), .cookies("a", "b", ...)
  out = out.replace(/(\.cookies?\s*\()([^()]*)(\))/g, (_m, open: string, args: string, close: string) => {
    let index = 0;
    const next = args.replace(/"(?:[^"\\]|\\.)*"/g, (literal) => {
      const isValue = index++ % 2 === 1;
      return isValue ? `"${sub(literal.slice(1, -1))}"` : literal;
    });
    return `${open}${next}${close}`;
  });

  // REST Assured: .basic("user", "pass"), .digest(...), .oauth2("token"), ...
  out = out.replace(/(\.(?:basic|digest|ntlm|oauth2|oauth)\s*\()([^()]*)(\))/g, (_m, open: string, args: string, close: string) => {
    const next = args.replace(/"(?:[^"\\]|\\.)*"/g, (literal) => `"${sub(literal.slice(1, -1))}"`);
    return `${open}${next}${close}`;
  });

  // Setter / builder calls with one literal argument: setPassword("v"), .apiKey("v"), .sessionId("v")
  out = out.replace(
    /(\b([A-Za-z_$][\w$]*)\s*\(\s*")((?:[^"\\\r\n]|\\.)*)("\s*\))/g,
    (m: string, open: string, method: string, value: string, close: string) =>
      value && isSecretName(method) ? `${open}${sub(value)}${close}` : m,
  );

  // Unquoted names: GraphQL / JS `password: "v"`, Java `String token = "v"`
  out = out.replace(
    /(^|[^\w"'\\$-])([A-Za-z_][\w-]*)(\s*[:=]\s*")((?:[^"\\\r\n]|\\.)*)"/g,
    (m: string, pre: string, name: string, sep: string, value: string) =>
      value && isSecretName(name) ? `${pre}${name}${sep}${sub(value)}"` : m,
  );

  // Everything inside an object/array under a secret-named key: {"auth": {"u": "a", "p": "b"}}
  out = redactSecretContainers(out, /\\"(?:[^"\\\r\n]|\\(?!"))*\\"/g, 2, sub);
  out = redactSecretContainers(out, /"(?:[^"\\\r\n]|\\.)*"/g, 1, sub);

  // "Name": "value" / "Name", "value" / "Name"="value" pairs: JSON bodies, .header(..), .queryParam(..),
  // Map.of(..), PowerShell @{"Name"="value"}
  out = redactLiteralPairs(out, /\\"(?:[^"\\\r\n]|\\(?!"))*\\"/g, 2, opts);
  out = redactLiteralPairs(out, /"(?:[^"\\\r\n]|\\.)*"/g, 1, opts);
  out = redactLiteralPairs(out, /'(?:[^'\\\r\n]|\\.)*'/g, 1, opts);

  // XML element text: <password>v</password>, <ns:Token>v</ns:Token> (leaf elements only)
  if (out.includes("</")) {
    out = out.replace(/<([A-Za-z_][\w.:-]*)(\s[^<>]*)?>([^<>]+)<\/\1\s*>/g, (m: string, tag: string, attrs: string | undefined, body: string) => {
      if (!body.trim() || !isSecretName(tag.slice(tag.lastIndexOf(":") + 1))) return m;
      const lead = /^\s*/.exec(body)![0];
      const trail = /\s*$/.exec(body)![0];
      return `<${tag}${attrs ?? ""}>${lead}${sub(body.trim())}${trail}</${tag}>`;
    });
  }

  // URLs: userinfo and secret query parameters
  return redactUrlString(out, opts);
}

/** Redacts a raw cURL command. */
export function redactCurlString(curl: string, opts: RedactOptions = {}): string {
  return redactText(curl, opts);
}

// ── parsed requests ──────────────────────────────────────────────────────────

const URL_FIELDS = new Set(["url", "base_url", "endpoint", "path_template", "referer", "proxy"]);
const CONFIG_SECTIONS = new Set([
  "proxy_config",
  "network_config",
  "ssl_config",
  "transfer_config",
  "protocol_config",
  "output_config",
  "ftp_config",
  "mail_config",
]);

function redactKeyedRecord(value: unknown, sub: Sub): unknown {
  if (!isPlainObject(value)) return clone(value);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = isSecretName(k) ? mapLeaves(v, sub) : clone(v);
  return out;
}

function redactConfigSection(value: unknown, opts: RedactOptions, sub: Sub): unknown {
  if (Array.isArray(value)) return value.map((item) => redactConfigSection(item, opts, sub));
  if (!isPlainObject(value)) return typeof value === "string" ? redactUrlString(value, opts) : value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (CONFIG_CERT_KEY.test(k) && typeof v === "string") out[k] = redactCertArg(v, sub);
    else out[k] = isSecretName(k) || CONFIG_USER_KEY.test(k) ? mapLeaves(v, sub) : redactConfigSection(v, opts, sub);
  }
  return out;
}

/**
 * One argument of a raw argument list (`all_options: ["-u", "bob:pw"]`), judged by the flag before it.
 * Undefined when `flag` is not a flag whose argument can hold a secret.
 */
function redactFlagArgument(flag: string, arg: string, opts: RedactOptions, sub: Sub): string | undefined {
  switch (flag) {
    case "-u":
    case "-U":
    case "--user":
    case "--proxy-user": {
      const colon = arg.indexOf(":");
      return colon < 0 ? sub(arg) : `${sub(arg.slice(0, colon))}:${sub(arg.slice(colon + 1))}`;
    }
    case "--oauth2-bearer":
    case "--pass":
    case "--proxy-pass":
      return sub(arg);
    case "-E":
    case "--cert":
    case "--proxy-cert":
      return redactCertArg(arg, sub);
    case "--variable":
      return redactVariableArg(arg, sub);
    case "--url-query":
      return redactUrlQueryArg(arg, opts);
    case "-H":
    case "--header":
    case "--proxy-header": {
      const colon = arg.indexOf(":");
      if (colon < 0) return undefined;
      const value = arg.slice(colon + 1);
      const lead = /^\s*/.exec(value)![0];
      return `${arg.slice(0, colon)}:${lead}${String(redactHeaderValue(arg.slice(0, colon), value.trim(), opts))}`;
    }
    case "-b":
    case "--cookie":
      return arg.includes("=") ? redactCookieString(arg, opts) : arg;
    case "-d":
    case "--data":
    case "--data-raw":
    case "--data-binary":
    case "--data-ascii":
    case "--data-urlencode":
    case "--json":
    case "-F":
    case "--form":
    case "--form-string":
      return redactBodyString(arg, opts);
    default:
      return undefined;
  }
}

function redactGeneric(value: unknown, opts: RedactOptions, sub: Sub): unknown {
  if (typeof value === "string") return redactText(value, opts);
  if (Array.isArray(value)) {
    return value.map((item, i) => {
      const flag = value[i - 1];
      if (typeof item === "string" && typeof flag === "string") {
        const redacted = redactFlagArgument(flag, item, opts, sub);
        if (redacted !== undefined) return redacted;
      }
      return redactGeneric(item, opts, sub);
    });
  }
  if (isPlainObject(value)) {
    const name = pairName(value);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (isSecretName(k)) out[k] = mapLeaves(v, sub);
      else if (k === "value" && name !== undefined && isSecretHeaderName(name)) out[k] = redactHeaderValue(name, v, opts);
      else out[k] = redactGeneric(v, opts, sub);
    }
    return out;
  }
  return value;
}

function redactPathParameter(item: unknown, sub: Sub): unknown {
  if (!isPlainObject(item)) return clone(item);
  const name = String(item.name ?? item.key ?? "");
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(item)) out[k] = k === "value" && isSecretName(name) ? mapLeaves(v, sub) : clone(v);
  return out;
}

/** Redacts one top-level section of a parsed request (`headers`, `cookies`, `data`, ...). */
function redactSection(key: string, value: unknown, opts: RedactOptions): unknown {
  if (value === null || value === undefined) return value;
  // A JWT is a secret whatever name it sits under.
  return scrubJwtsDeep(redactSectionByName(key, value, opts), makeSub(opts));
}

function redactSectionByName(key: string, value: unknown, opts: RedactOptions): unknown {
  const sub = makeSub(opts);

  if (key === "headers") {
    if (!isPlainObject(value)) return redactGeneric(value, opts, sub);
    const out: Record<string, unknown> = {};
    for (const [name, v] of Object.entries(value)) out[name] = redactHeaderValue(name, v, opts);
    return out;
  }
  if (key === "cookies") return typeof value === "string" ? redactCookieString(value, opts) : mapLeaves(value, sub);
  if (key === "query_params" || key === "form_data") return redactKeyedRecord(value, sub);
  if (key === "data" || key === "raw_data") {
    if (typeof value === "string") return redactBodyString(value, opts);
    return redactJsonValue(value, sub, opts);
  }
  if (URL_FIELDS.has(key)) return typeof value === "string" ? redactUrlString(value, opts) : clone(value);
  if (key === "path_parameters") {
    if (Array.isArray(value)) return value.map((item) => redactPathParameter(item, sub));
    return isPlainObject(value) ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactPathParameter(v, sub)])) : clone(value);
  }
  if (key === "auth_config" || key === "auth") return mapLeaves(value, sub, AUTH_CONFIG_SAFE_KEYS);
  if (CONFIG_SECTIONS.has(key)) return redactConfigSection(value, opts, sub);
  return redactGeneric(value, opts, sub);
}

/** A copy of the parsed request with every secret value replaced. Keys, structure and non-secret values stay. */
export function redactParsedCurl<T extends ParsedCurl>(parsed: T, opts: RedactOptions = {}): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed as unknown as Record<string, unknown>)) {
    out[key] = redactSection(key, value, opts);
  }
  return out as unknown as T;
}

/**
 * Redacts a single editor field given its dot path (`headers.Authorization`, `data.user.password`, `url`).
 * Returns the value unchanged when it is not secret.
 */
export function redactFieldValue(path: string, value: unknown, opts: RedactOptions = {}): unknown {
  const firstDot = path.indexOf(".");
  const root = firstDot < 0 ? path : path.slice(0, firstDot);
  const rest = firstDot < 0 ? "" : path.slice(firstDot + 1);
  if (!rest) return redactSection(root, value, opts);

  // Body paths nest (`data.a.b[0]`); every other section is a flat record whose keys may contain dots.
  const keys = root === "data" || root === "raw_data" ? rest.split(/[.[\]]+/).filter(Boolean) : [rest];
  let wrapped: unknown = value;
  for (let i = keys.length - 1; i >= 0; i--) wrapped = { [keys[i]!]: wrapped };

  let result: unknown = redactSection(root, wrapped, opts);
  for (const k of keys) {
    if (!isPlainObject(result)) return value;
    result = result[k];
  }
  return result;
}

/** True when masking this field would change what is shown. */
export function isSecretField(path: string, value: unknown): boolean {
  if (value === null || value === undefined) return false;
  return JSON.stringify(redactFieldValue(path, value, { placeholder: MASK })) !== JSON.stringify(value);
}

// ── discovery ────────────────────────────────────────────────────────────────

export interface SecretField {
  /** Stable id for this field (JSON of its key path). */
  id: string;
  path: string[];
  /** Human-readable path, e.g. `headers.Authorization`. */
  label: string;
}

function walkDiff(original: unknown, masked: unknown, path: string[], found: SecretField[]): void {
  if (Array.isArray(original) && Array.isArray(masked)) {
    original.forEach((item, i) => walkDiff(item, masked[i], [...path, String(i)], found));
    return;
  }
  if (isPlainObject(original) && isPlainObject(masked)) {
    for (const k of Object.keys(original)) walkDiff(original[k], masked[k], [...path, k], found);
    return;
  }
  if (original !== masked && path.length > 0) found.push({ id: JSON.stringify(path), path, label: path.join(".") });
}

/** Every leaf of the request whose value is secret. */
export function listSecretFields(parsed: ParsedCurl): SecretField[] {
  const found: SecretField[] = [];
  walkDiff(parsed, redactParsedCurl(parsed, { placeholder: MASK }), [], found);
  return found;
}

/** The request with secrets masked, except the fields whose ids are in `revealed`. */
export function maskParsedCurl(parsed: ParsedCurl, revealed: ReadonlySet<string> = new Set()): ParsedCurl {
  const masked = redactParsedCurl(parsed, { placeholder: MASK }) as unknown as Record<string, unknown>;
  if (revealed.size === 0) return masked as unknown as ParsedCurl;
  for (const field of listSecretFields(parsed)) {
    if (!revealed.has(field.id)) continue;
    let from: unknown = parsed;
    let to: unknown = masked;
    for (let i = 0; i < field.path.length - 1; i++) {
      const k = field.path[i]!;
      from = (from as Record<string, unknown>)[k];
      to = (to as Record<string, unknown>)[k];
    }
    const last = field.path[field.path.length - 1]!;
    (to as Record<string, unknown>)[last] = (from as Record<string, unknown>)[last];
  }
  return masked as unknown as ParsedCurl;
}

/** The secret substrings in a request, longest first, for scrubbing generated code. */
export function collectSecretValues(parsed: ParsedCurl): string[] {
  return redactParsedCurlWithSecrets(parsed).secrets;
}

/** redactParsedCurl and collectSecretValues in one walk of the request. */
export function redactParsedCurlWithSecrets<T extends ParsedCurl>(parsed: T, opts: RedactOptions = {}): { redacted: T; secrets: string[] } {
  const found = new Set<string>();
  const redacted = redactParsedCurl(parsed, {
    ...opts,
    collect: (secret) => {
      found.add(secret);
      opts.collect?.(secret);
    },
  });
  const secrets = [...found].filter((s) => s.length >= MIN_KNOWN_SECRET_LENGTH).sort((a, b) => b.length - a.length);
  return { redacted, secrets };
}

/**
 * A raw cURL command (any shell: bash, cmd, PowerShell) redacted for storage or display: by pattern,
 * and by value with the secrets of its parsed request, which catches shapes the patterns miss.
 */
export function redactCurlForRequest(curl: string, parsed: ParsedCurl | null | undefined, opts: RedactOptions = {}): string {
  const knownSecrets = parsed ? collectSecretValues(parsed) : [];
  return redactCurlString(curl, { ...opts, knownSecrets: [...knownSecrets, ...(opts.knownSecrets ?? [])] });
}

// ── redaction markers ────────────────────────────────────────────────────────

/** How many redacted values (occurrences of the placeholder) a value contains. */
export function countRedactions(value: unknown): number {
  if (typeof value === "string") return value.split(REDACTED_PLACEHOLDER).length - 1;
  if (Array.isArray(value)) return value.reduce<number>((n, item) => n + countRedactions(item), 0);
  if (isPlainObject(value)) return Object.values(value).reduce<number>((n, item) => n + countRedactions(item), 0);
  return 0;
}

/** Backend bookkeeping fields: copies of the body, never shown or edited, so they never need re-entry. */
export const INTERNAL_FIELDS: readonly string[] = ["data_raw", "data_type"];

/** Redactions in the fields the user can see and edit (internal copies of the body are not counted). */
export function countVisibleRedactions(parsed: unknown): number {
  if (!isPlainObject(parsed)) return countRedactions(parsed);
  return Object.entries(parsed).reduce<number>(
    (n, [key, value]) => (INTERNAL_FIELDS.includes(key) ? n : n + countRedactions(value)),
    0,
  );
}

export function containsRedaction(value: unknown): boolean {
  return countRedactions(value) > 0;
}

/** True for a leaf value that is (or contains) the persisted redaction placeholder. */
export function isRedactedValue(value: unknown): boolean {
  return typeof value === "string" && value.includes(REDACTED_PLACEHOLDER);
}
