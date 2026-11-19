/**
 * Structural equality for JSON-like values (the shape `ParsedCurl` is made of).
 *
 * - Object key order is ignored; array order is significant.
 * - A key whose value is `undefined` is treated as absent, so `{ a: undefined }` equals `{}`
 *   (reverting a field to a value the original never had leaves exactly that shape behind).
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;

  const aIsArray = Array.isArray(a);
  if (aIsArray !== Array.isArray(b)) return false;

  if (aIsArray) {
    const arrA = a as unknown[];
    const arrB = b as unknown[];
    return arrA.length === arrB.length && arrA.every((item, i) => deepEqual(item, arrB[i]));
  }

  const recA = a as Record<string, unknown>;
  const recB = b as Record<string, unknown>;
  const keysA = Object.keys(recA).filter(k => recA[k] !== undefined);
  const keysB = Object.keys(recB).filter(k => recB[k] !== undefined);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(k => Object.prototype.hasOwnProperty.call(recB, k) && deepEqual(recA[k], recB[k]));
}
