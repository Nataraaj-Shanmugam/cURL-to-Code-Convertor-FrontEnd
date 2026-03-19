import type { ParsedCurl } from "@/types/curl";

export function buildFullUrl(parsed: ParsedCurl): string {
  let url = parsed.base_url || "";
  let path = parsed.endpoint || "";

  // Substitute path parameters: /users/{id} + path_parameters [{name:"id",value:"123"}]
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

  // Append query params
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
