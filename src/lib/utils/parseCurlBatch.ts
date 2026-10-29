import { apiClient } from "@/lib/api/apiClient";
import { ENV } from "@/lib/env";
import type { ParsedCurl } from "@/types/curl";
import type { BatchParseFailure, ParsedCurlEntry } from "@/types/batch";

export interface ParseCurlBatchResult {
  /** Commands that parsed, in submission order. */
  items: ParsedCurlEntry[];
  /** Commands that did not parse, in submission order. `index` is the position in the input array. */
  failures: BatchParseFailure[];
}

/**
 * The browser caps parallel connections per host, but the client-side request timeout starts when
 * fetch() is called, not when the connection is granted. Limiting concurrency keeps a large import
 * from timing out requests that were merely queued.
 */
const MAX_CONCURRENT_PARSES = 5;

type ParseOutcome =
  | { ok: true; parsed: ParsedCurl }
  | { ok: false; message: string };

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error) return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

async function parseOne(curl: string): Promise<ParseOutcome> {
  try {
    const { data: result } = await apiClient.post(ENV.PARSE_ENDPOINT, { curl });
    if (!result?.success) {
      return { ok: false, message: errorMessage(result?.error, "Failed to parse cURL") };
    }
    const parsed = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, message: "The parser returned no data for this command" };
    }
    return { ok: true, parsed: parsed as ParsedCurl };
  } catch (err) {
    return { ok: false, message: errorMessage(err, "Failed to parse cURL command") };
  }
}

/**
 * Parses every command through the parse endpoint. One bad command never discards the others:
 * successes and failures are returned side by side, each in input order.
 */
export async function parseCurlBatch(curls: string[]): Promise<ParseCurlBatchResult> {
  const outcomes: ParseOutcome[] = new Array(curls.length);
  let next = 0;

  const worker = async () => {
    while (next < curls.length) {
      const index = next++;
      outcomes[index] = await parseOne(curls[index] ?? "");
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENT_PARSES, curls.length) }, worker)
  );

  const items: ParsedCurlEntry[] = [];
  const failures: BatchParseFailure[] = [];
  outcomes.forEach((outcome, index) => {
    const curl = curls[index] ?? "";
    if (outcome?.ok) items.push({ parsed: outcome.parsed, originalCurl: curl });
    else failures.push({ index, curl, message: outcome?.message ?? "Failed to parse cURL" });
  });
  return { items, failures };
}
