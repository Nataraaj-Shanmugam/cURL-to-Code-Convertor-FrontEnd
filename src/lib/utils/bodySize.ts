/**
 * Size thresholds for the request-body tree. Every node of the tree is several DOM elements, so a
 * large body has to start collapsed, and a very large one (a pasted bulk payload) is better read
 * as raw JSON than as a tree.
 */

/** Bodies with more nodes than this start with every object/array collapsed. */
export const LARGE_BODY_NODES = 200;

/** Bodies with more nodes than this open in the raw-JSON view (the tree is still one click away). */
export const HUGE_BODY_NODES = 20_000;

/** An object or array shows at most this many children at first, then "Show more" adds a page. */
export const BODY_CHILD_PAGE = 100;

/** Number of nodes (every key or array item, at any depth) in `value`, counting up to `cap`. */
export const countBodyNodes = (value: unknown, cap = Infinity): number => {
  let count = 0;
  const stack: unknown[] = [value];
  while (stack.length > 0 && count <= cap) {
    const node = stack.pop();
    if (typeof node !== "object" || node === null) continue;
    const children = Array.isArray(node) ? node : Object.values(node as Record<string, unknown>);
    count += children.length;
    for (const child of children) if (typeof child === "object" && child !== null) stack.push(child);
  }
  return count;
};

export const isLargeBody = (data: unknown): boolean => countBodyNodes(data, LARGE_BODY_NODES) > LARGE_BODY_NODES;
export const isHugeBody = (data: unknown): boolean => countBodyNodes(data, HUGE_BODY_NODES) > HUGE_BODY_NODES;
