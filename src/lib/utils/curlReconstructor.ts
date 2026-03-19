import type { ParsedCurl } from "@/types/curl";

function shellEscape(s: string): string {
  // Use single-quote wrapping; escape embedded single quotes as '\''
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

function buildUrl(parsed: ParsedCurl): string {
  let url = parsed.base_url || "";
  let path = parsed.endpoint || "";
  if (parsed.path_parameters && Array.isArray(parsed.path_parameters)) {
    parsed.path_parameters.forEach((param) => {
      if (param && typeof param === "object") {
        const p = param as Record<string, unknown>;
        const name = String(p.name || p.key || "");
        const value = String(p.value || "");
        if (name) path = path.replace(`{${name}}`, value);
      }
    });
  }
  url = url.replace(/\/$/, "") + path;
  if (parsed.query_params && typeof parsed.query_params === "object") {
    const params = new URLSearchParams();
    Object.entries(parsed.query_params).forEach(([k, v]) => {
      if (Array.isArray(v)) v.forEach((item) => params.append(k, String(item)));
      else params.append(k, String(v));
    });
    const qs = params.toString();
    if (qs) url += "?" + qs;
  }
  return url;
}

export function reconstructCurl(parsed: ParsedCurl): string {
  const parts: string[] = ["curl"];
  const method = (parsed.method || "GET").toUpperCase();

  if (method !== "GET") parts.push(`-X ${method}`);

  // URL
  const url = buildUrl(parsed);
  parts.push(shellEscape(url));

  // Headers
  if (parsed.headers && typeof parsed.headers === "object") {
    Object.entries(parsed.headers).forEach(([k, v]) => {
      parts.push(`-H ${shellEscape(`${k}: ${v}`)}`);
    });
  }

  // Cookies
  if (parsed.cookies && typeof parsed.cookies === "object") {
    const cookieStr = Object.entries(parsed.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
    if (cookieStr) parts.push(`-b ${shellEscape(cookieStr)}`);
  }

  // Body
  if (parsed.data) {
    const bodyStr =
      typeof parsed.data === "object"
        ? JSON.stringify(parsed.data, null, 2)
        : String(parsed.data);
    parts.push(`-d ${shellEscape(bodyStr)}`);
  } else if (parsed.form_data && typeof parsed.form_data === "object") {
    Object.entries(parsed.form_data).forEach(([k, v]) => {
      parts.push(`-F ${shellEscape(`${k}=${v}`)}`);
    });
  }

  return parts.join(" \\\n  ");
}
