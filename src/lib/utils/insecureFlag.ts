import type { ParsedCurl } from "@/types/curl";

/**
 * ParsedCurl has no dedicated "insecure" field. The backend groups cURL options into config
 * sections, and the editor's "Add Flag" affordance for both `flags` and `ssl_config` suggests
 * `insecure: true`. The exact key the backend uses could not be verified here (no backend), so we
 * accept every plausible spelling in every section that can carry TLS options.
 */
const FLAG_SECTIONS = ["ssl_config", "flags", "misc_flags", "network_config"] as const;

/** Keys that mean "skip certificate verification" when truthy. */
const INSECURE_KEYS = new Set([
  "k",
  "insecure",
  "ssl_insecure",
  "insecure_ssl",
  "skip_ssl_verification",
  "skip_ssl_verify",
  "skip_verify",
  "no_verify",
  "disable_ssl_verification",
]);

/** Keys that mean "verify certificates" and therefore signal -k when they are explicitly false. */
const VERIFY_KEYS = new Set(["verify", "verify_ssl", "ssl_verify", "verify_peer", "verify_certificate"]);

const normalizeKey = (key: string) => key.trim().toLowerCase().replace(/^-+/, "").replace(/-/g, "_");

/** True when the parsed cURL carried -k / --insecure (certificate verification disabled). */
export function isInsecureCurl(parsed: ParsedCurl | null | undefined): boolean {
  if (!parsed) return false;
  const record = parsed as unknown as Record<string, unknown>;
  for (const section of FLAG_SECTIONS) {
    const value = record[section];
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    for (const [key, flag] of Object.entries(value as Record<string, unknown>)) {
      const name = normalizeKey(key);
      if (INSECURE_KEYS.has(name) && flag === true) return true;
      if (VERIFY_KEYS.has(name) && flag === false) return true;
    }
  }
  return false;
}

const RELAXED_CALL = /relaxedHTTPSValidation\s*\(/;
const GIVEN_CALL = /\bgiven\(\)/;

/**
 * Makes one generated test method accept any TLS certificate.
 *
 * `RestAssured.useRelaxedHTTPSValidation()` mutates static global state, so calling it for one
 * method would silently relax every method that runs after it. The request-scoped
 * `.relaxedHTTPSValidation()` on the method's own `given()` chain affects only that request.
 */
export function withRelaxedHttps(methodCode: string): string {
  if (RELAXED_CALL.test(methodCode)) return methodCode; // the backend already emitted it
  if (GIVEN_CALL.test(methodCode)) {
    return methodCode.replace(GIVEN_CALL, "given().relaxedHTTPSValidation()");
  }
  // Unexpected code shape: do not drop the user's -k silently.
  return `// NOTE: the original cURL used -k/--insecure; add .relaxedHTTPSValidation() to this request.\n${methodCode}`;
}
