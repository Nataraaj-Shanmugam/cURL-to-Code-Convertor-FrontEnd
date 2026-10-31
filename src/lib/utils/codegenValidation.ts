/**
 * Validation and defaults for the code-generation settings the batch dialog collects. They mirror
 * the rules of the single-request dialog.
 */

const JAVA_IDENTIFIER = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

/** Returns an error message, or null when `value` is usable as a Java class or method name. */
export function javaIdentifierError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Required";
  if (!JAVA_IDENTIFIER.test(trimmed)) {
    return "Must be a valid Java identifier (no spaces or special characters)";
  }
  return null;
}
