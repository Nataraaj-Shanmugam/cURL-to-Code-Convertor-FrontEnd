import type {
  PostmanCollection,
  PostmanItem,
  PostmanRequest,
  PostmanUrl,
  ImportedRequest,
} from "@/types/import";

function buildUrlString(url: string | PostmanUrl | undefined): string {
  if (!url) return "";
  if (typeof url === "string") return url;
  if (url.raw) return url.raw;
  const protocol = url.protocol || "https";
  const host = Array.isArray(url.host)
    ? url.host.join(".")
    : url.host || "";
  const path = Array.isArray(url.path)
    ? "/" + url.path.join("/")
    : url.path || "";
  const query = url.query
    ?.filter((q) => !q.disabled)
    .map((q) => `${q.key}=${q.value}`)
    .join("&");
  return `${protocol}://${host}${path}${query ? "?" + query : ""}`;
}

function shellEscape(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

function requestToCurl(req: PostmanRequest): string {
  const parts: string[] = ["curl"];
  const method = (req.method || "GET").toUpperCase();
  if (method !== "GET") parts.push(`-X ${method}`);

  const url = buildUrlString(req.url);
  parts.push(shellEscape(url));

  req.header?.filter((h) => !h.disabled).forEach((h) => {
    parts.push(`-H ${shellEscape(`${h.key}: ${h.value}`)}`);
  });

  if (req.body) {
    if (req.body.mode === "raw" && req.body.raw) {
      parts.push(`-d ${shellEscape(req.body.raw)}`);
    } else if (req.body.mode === "urlencoded" && req.body.urlencoded) {
      const data = req.body.urlencoded
        .filter((f) => !f.disabled)
        .map((f) => `${f.key}=${f.value}`)
        .join("&");
      parts.push(`-d ${shellEscape(data)}`);
    } else if (req.body.mode === "formdata" && req.body.formdata) {
      req.body.formdata.filter((f) => !f.disabled).forEach((f) => {
        parts.push(`-F ${shellEscape(`${f.key}=${f.value}`)}`);
      });
    }
  }

  return parts.join(" \\\n  ");
}

let counter = 0;

function extractItems(
  items: PostmanItem[],
  folder?: string
): ImportedRequest[] {
  const results: ImportedRequest[] = [];
  for (const item of items) {
    if (item.item) {
      results.push(...extractItems(item.item, item.name || folder));
    } else if (item.request) {
      const req = item.request;
      const url = buildUrlString(req.url);
      results.push({
        id: item.id || String(counter++),
        name: item.name || "Request",
        method: (req.method || "GET").toUpperCase(),
        url,
        curlCommand: requestToCurl(req),
        folder,
      });
    }
  }
  return results;
}

export function parsePostmanCollection(
  collection: PostmanCollection
): ImportedRequest[] {
  counter = 0;
  return extractItems(collection.item || []);
}
