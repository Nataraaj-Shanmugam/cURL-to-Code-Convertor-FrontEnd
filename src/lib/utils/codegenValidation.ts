/**
 * Validation and defaults for the code-generation settings the batch dialog collects. They mirror
 * the rules of the single-request dialog (a Java identifier, a status code in 100-599).
 */

const JAVA_IDENTIFIER = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

/** Reserved words and literals: valid identifier syntax, but the compiler (and the backend) reject them. */
const JAVA_KEYWORDS = new Set([
  "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char", "class", "const", "continue",
  "default", "do", "double", "else", "enum", "extends", "final", "finally", "float", "for", "goto", "if",
  "implements", "import", "instanceof", "int", "interface", "long", "native", "new", "package", "private",
  "protected", "public", "return", "short", "static", "strictfp", "super", "switch", "synchronized", "this",
  "throw", "throws", "transient", "try", "void", "volatile", "while", "_", "true", "false", "null",
]);

/** Returns an error message, or null when `value` is usable as a Java class or method name. */
export function javaIdentifierError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Required";
  if (!JAVA_IDENTIFIER.test(trimmed)) {
    return "Must be a valid Java identifier (no spaces or special characters)";
  }
  if (JAVA_KEYWORDS.has(trimmed)) return `"${trimmed}" is a Java keyword and can't be used as a name`;
  return null;
}

/** Returns an error message, or null when `value` is a whole HTTP status code from 100 to 599. */
export function statusCodeError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Required";
  if (!/^\d{3}$/.test(trimmed) || Number(trimmed) < 100 || Number(trimmed) > 599) {
    return "Must be a status code from 100 to 599";
  }
  return null;
}

/** The status a successful call usually returns: 201 for POST, 204 for DELETE, 200 otherwise. */
export function defaultStatusForMethod(method: string | undefined): string {
  switch ((method || "GET").toUpperCase()) {
    case "POST":
      return "201";
    case "DELETE":
      return "204";
    default:
      return "200";
  }
}
