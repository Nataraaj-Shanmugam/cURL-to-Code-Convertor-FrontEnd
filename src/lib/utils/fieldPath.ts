/**
 * Field paths for the request editor.
 *
 * A path is a list of segments (`["data", "items", "0", "sku"]`). Editor state (editing, edited
 * values, selection, collapsed nodes) is keyed by a string id, so segments are joined with `.`
 * and any `.` or `\` inside a segment is escaped with `\`. That keeps keys such as `filter.name`
 * or `X-Api.Version` addressable and makes array items plain numeric segments.
 *
 * Walkers never step into `__proto__`, `prototype` or `constructor`, and only follow own
 * properties, so a key taken from a request can't reach `Object.prototype`.
 */

export type PathSegments = readonly string[];
/** An escaped path string (`headers.X-Api\.Version`) or its segments. */
export type FieldPath = string | PathSegments;

const FORBIDDEN_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

export const isForbiddenSegment = (segment: string): boolean => FORBIDDEN_SEGMENTS.has(segment);

const escapeSegment = (segment: string): string => segment.replace(/\\/g, "\\\\").replace(/\./g, "\\.");

export const encodePath = (segments: PathSegments): string => segments.map(escapeSegment).join(".");

export const decodePath = (path: string): string[] => {
  const segments: string[] = [];
  let current = "";
  for (let i = 0; i < path.length; i++) {
    const ch = path[i]!;
    if (ch === "\\" && i + 1 < path.length) {
      current += path[++i];
    } else if (ch === ".") {
      segments.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  segments.push(current);
  return segments;
};

export const toSegments = (path: FieldPath): string[] =>
  typeof path === "string" ? decodePath(path) : [...path];

/** Canonical string id for a path, used as the key of per-field editor state. */
export const toPathId = (path: FieldPath): string =>
  typeof path === "string" ? encodePath(decodePath(path)) : encodePath(path);

/** Non-empty, no empty segments, nothing that resolves to an object's prototype machinery. */
export const isSafePath = (segments: PathSegments): boolean =>
  segments.length > 0 && segments.every(s => s !== "" && !isForbiddenSegment(s));

const isContainer = (value: unknown): value is Record<string, unknown> | unknown[] =>
  typeof value === "object" && value !== null;

const arrayIndex = (arr: unknown[], segment: string): number | null => {
  if (!/^\d+$/.test(segment)) return null;
  const idx = Number(segment);
  return idx < arr.length ? idx : null;
};

const hasOwn = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);

const childOf = (container: unknown, segment: string): unknown => {
  if (Array.isArray(container)) {
    const idx = arrayIndex(container, segment);
    return idx === null ? undefined : container[idx];
  }
  if (isContainer(container) && hasOwn(container, segment)) return (container as Record<string, unknown>)[segment];
  return undefined;
};

/** The value at `segments`, or undefined when the path does not exist or is unsafe. */
export const getAtPath = (root: unknown, segments: PathSegments): unknown => {
  if (!isSafePath(segments)) return undefined;
  let node: unknown = root;
  for (const segment of segments) {
    node = childOf(node, segment);
    if (node === undefined) return undefined;
  }
  return node;
};

export const hasPath = (root: unknown, segments: PathSegments): boolean => {
  if (!isSafePath(segments)) return false;
  let node: unknown = root;
  for (const segment of segments) {
    if (Array.isArray(node)) {
      if (arrayIndex(node, segment) === null) return false;
    } else if (!isContainer(node) || !hasOwn(node, segment)) {
      return false;
    }
    node = childOf(node, segment);
  }
  return true;
};

/**
 * Sets the value at `segments` in place. The parent must already exist (unless `shapeFrom` is
 * given, see below). Array parents only accept an existing index. Returns false when nothing was
 * written.
 *
 * `shapeFrom`: a reference document (e.g. the original request) used to recreate missing parents
 * with the right container type, as `revert` needs after a parent was deleted.
 */
export const setAtPath = (
  root: unknown,
  segments: PathSegments,
  value: unknown,
  shapeFrom?: unknown,
): boolean => {
  if (!isSafePath(segments) || !isContainer(root)) return false;
  let node: Record<string, unknown> | unknown[] = root;
  let ref: unknown = shapeFrom;
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i]!;
    ref = childOf(ref, segment);
    let next = childOf(node, segment);
    if (!isContainer(next)) {
      if (shapeFrom === undefined || !isContainer(ref) || Array.isArray(node)) return false;
      next = Array.isArray(ref) ? [] : {};
      (node as Record<string, unknown>)[segment] = next;
    }
    node = next as Record<string, unknown> | unknown[];
  }
  const last = segments[segments.length - 1]!;
  if (Array.isArray(node)) {
    const idx = /^\d+$/.test(last) ? Number(last) : null;
    // Writing one past the end is allowed when reverting a removed trailing item.
    if (idx === null || idx > node.length || (idx === node.length && shapeFrom === undefined)) return false;
    node[idx] = value;
    return true;
  }
  (node as Record<string, unknown>)[last] = value;
  return true;
};

/** Removes the value at `segments` in place (array items are spliced out). */
export const deleteAtPath = (root: unknown, segments: PathSegments): boolean => {
  if (!hasPath(root, segments)) return false;
  const parent = segments.length === 1 ? root : getAtPath(root, segments.slice(0, -1));
  const last = segments[segments.length - 1]!;
  if (Array.isArray(parent)) {
    parent.splice(Number(last), 1);
    return true;
  }
  if (!isContainer(parent)) return false;
  delete (parent as Record<string, unknown>)[last];
  return true;
};

/**
 * Orders paths so that deleting them one after another is safe: within the same array, higher
 * indices come first (splicing a lower index would shift the others).
 */
export const compareForDeletion = (a: PathSegments, b: PathSegments): number => {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x === y) continue;
    if (/^\d+$/.test(x) && /^\d+$/.test(y)) return Number(y) - Number(x);
    return x < y ? -1 : 1;
  }
  return b.length - a.length;
};

/**
 * The path in the body API's notation (`items[0].sku`), relative to `segments[0]`'s value: array
 * indices use brackets, object keys are joined with `.`.
 */
export const toBracketPath = (root: unknown, segments: PathSegments): string => {
  let out = "";
  let node: unknown = root;
  for (const segment of segments) {
    if (Array.isArray(node)) out += `[${segment}]`;
    else out += out ? `.${segment}` : segment;
    node = childOf(node, segment);
  }
  return out;
};

/** Plain dot-joined form, for display and for redaction rules that look at key names. */
export const toDisplayPath = (segments: PathSegments): string => segments.join(".");
