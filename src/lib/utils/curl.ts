import type { ParsedCurl, ParsedCurlResponse, FilterState } from "@/types/curl";

/**
 * Recursively removes empty, null, false values from objects
 * Used to clean up parsed cURL data before display
 */
export const cleanObject = (obj: any): any => {
  if (Array.isArray(obj)) {
    const arr = obj
      .map(cleanObject)
      .filter(
        (v) =>
          v !== undefined &&
          v !== null &&
          v !== "" &&
          v !== false &&
          !(Array.isArray(v) && v.length === 0)
      );
    return arr.length ? arr : undefined;
  }

  if (obj && typeof obj === "object") {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleanVal = cleanObject(value);
      const keep =
        cleanVal !== undefined &&
        cleanVal !== null &&
        cleanVal !== "" &&
        cleanVal !== false &&
        !(Array.isArray(cleanVal) && cleanVal.length === 0) &&
        !(typeof cleanVal === "object" && Object.keys(cleanVal).length === 0);

      if (keep) {
        // Remove surrounding quotes from keys
        cleaned[key.replace(/^"+|"+$/g, "")] = cleanVal;
      }
    }
    return Object.keys(cleaned).length ? cleaned : undefined;
  }

  if (typeof obj === "boolean" && obj === false) return undefined;
  return obj;
};

/**
 * Filters parsed cURL object based on user-selected checkboxes
 * Used to generate filtered output for code generation
 */
export const filterParsed = (
  obj: any,
  allowed: FilterState,
  path: string[] = []
): any => {
  if (typeof obj !== "object" || obj === null) return obj;
  
  const result: any = Array.isArray(obj) ? [] : {};
  
  for (const [key, value] of Object.entries(obj)) {
    const fullPath = [...path, key].join(".");
    // Include field if not explicitly filtered out
    if (allowed[fullPath] !== false) {
      result[key] = filterParsed(value, allowed, [...path, key]);
    }
  }
  
  return result;
};

/**
 * Normalizes various API response formats into a consistent ParsedCurl structure
 * Handles different backend response shapes gracefully
 */
export const normalizeParsedCurl = (raw: ParsedCurlResponse): ParsedCurl | null => {
  if (!raw) return null;

  let baseUrl = "";
  let endpoint = "/";
  let queryParams: Record<string, any> = {};

  try {
    const url = new URL(raw.url || raw.full_url || "");
    baseUrl = `${url.protocol}//${url.host}`;
    endpoint = url.pathname || "/";
    queryParams = Object.fromEntries(url.searchParams.entries());
  } catch {
    baseUrl = raw.base_url || "";
    endpoint = raw.endpoint || "/";
  }

  const normalized: ParsedCurl = {
    // ---- Core request details ----
    method: raw.method || "GET",
    url: raw.url || "",
    base_url: baseUrl,
    endpoint,
    path_template: raw.path_template || endpoint,
    path_parameters: raw.path_parameters || [],

    // ---- Request data ----
    query_params: raw.query_params || queryParams,
    headers: raw.headers || {},
    data: raw.data || raw.raw_data || "",
    raw_data: raw.raw_data || null,
    form_data: raw.form_data || {},
    cookies: raw.cookies || {},
    auth: raw.auth || null,
    proxy: raw.proxy || null,
    user_agent: raw.user_agent || null,
    referer: raw.referer || null,
    flags: raw.flags || {},

    // ---- Config blocks ----
    network_config: {
      timeout: raw.timeout ?? raw.network_config?.timeout ?? null,
      connect_timeout: raw.connect_timeout ?? raw.network_config?.connect_timeout ?? null,
      max_time: raw.max_time ?? raw.network_config?.max_time ?? null,
      retry: raw.retry ?? raw.network_config?.retry ?? null,
      retry_delay: raw.retry_delay ?? raw.network_config?.retry_delay ?? null,
      retry_max_time: raw.retry_max_time ?? raw.network_config?.retry_max_time ?? null,
      max_redirs: raw.max_redirs ?? raw.network_config?.max_redirs ?? null,
    },

    ssl_config: {
      cert: raw.cert ?? raw.ssl_config?.cert ?? null,
      key: raw.key ?? raw.ssl_config?.key ?? null,
      cacert: raw.cacert ?? raw.ssl_config?.cacert ?? null,
      capath: raw.capath ?? raw.ssl_config?.capath ?? null,
      ssl_version: raw.ssl_version ?? raw.ssl_config?.ssl_version ?? null,
    },

    // ---- Meta and raw ----
    all_options: raw.all_options || [],
    meta: raw.meta || null,
  };

  return cleanObject(normalized);
};
