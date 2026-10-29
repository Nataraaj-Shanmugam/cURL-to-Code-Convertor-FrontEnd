import { useState, useCallback, useMemo } from "react";
import type { BatchItem, ParsedCurlEntry } from "@/types/batch";
import type { ParsedCurl, CodeGenConfig } from "@/types/curl";

const DEFAULT_CONFIG: CodeGenConfig = {
  option: "full",
  className: "BatchApiTest",
  methodName: "testApiRequest",
  assertionRequired: true,
  statusCode: "200",
  loggingRequired: true,
  needPojo: false,
};

export function deriveMethodName(parsed: ParsedCurl, index: number): string {
  const method = (parsed.method || "GET").toLowerCase();
  const endpoint = parsed.endpoint || "";
  const pathPart = endpoint
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  return `test${method.charAt(0).toUpperCase() + method.slice(1)}${
    pathPart ? "_" + pathPart : "_" + index
  }`;
}

/** Returns `base`, or `base_2`, `base_3`, ... — the first spelling not already in `taken`. */
export function uniqueName(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

export function deriveItemName(parsed: ParsedCurl, index: number): string {
  return `${(parsed.method || "GET").toUpperCase()} ${
    parsed.endpoint || parsed.base_url || "Request " + index
  }`;
}

// Ids only need to be unique and stable for the lifetime of the page. They are never reused, so a
// removed item's id can't be mistaken for a later item's.
let nextItemId = 1;

function createItems(entries: ParsedCurlEntry[]): BatchItem[] {
  const taken = new Set<string>();
  return entries.map((entry, i) => {
    // Default method names must be unique: two `testGet_users` would not compile in one class.
    const methodName = uniqueName(deriveMethodName(entry.parsed, i), taken);
    taken.add(methodName);
    return {
      id: `batch-item-${nextItemId++}`,
      originalCurl: entry.originalCurl,
      parsed: entry.parsed,
      config: { ...DEFAULT_CONFIG, methodName },
      name: deriveItemName(entry.parsed, i),
    };
  });
}

interface BatchState {
  items: BatchItem[];
  selectedId: string | null;
}

/**
 * State for the batch editor. Seeded once, at mount, from `initialItems` — the caller is expected
 * to have the parsed items in hand before it renders this hook (the Playground parses before it
 * navigates). Everything after that is driven by the returned actions, and items are always
 * addressed by id, never by position, so removing or reordering can't redirect an edit.
 */
export function useBatchEditor(initialItems: ParsedCurlEntry[]) {
  const [state, setState] = useState<BatchState>(() => {
    const items = createItems(initialItems);
    return { items, selectedId: items[0]?.id ?? null };
  });

  const selectItem = useCallback((id: string) => {
    setState((prev) =>
      prev.selectedId !== id && prev.items.some((item) => item.id === id)
        ? { ...prev, selectedId: id }
        : prev
    );
  }, []);

  /** Shallow-merges `update` into the item with this id. A no-op if the id no longer exists. */
  const updateItem = useCallback((id: string, update: Partial<Omit<BatchItem, "id">>) => {
    setState((prev) => {
      if (!prev.items.some((item) => item.id === id)) return prev;
      return {
        ...prev,
        items: prev.items.map((item) => (item.id === id ? { ...item, ...update } : item)),
      };
    });
  }, []);

  /**
   * Stores edited request data and refreshes the label shown in the sidebar and dialog. The
   * method name is left alone: the user may already have chosen one.
   */
  const updateParsed = useCallback((id: string, parsed: ParsedCurl) => {
    setState((prev) => {
      const index = prev.items.findIndex((item) => item.id === id);
      if (index === -1) return prev;
      const items = prev.items.slice();
      const current = items[index]!;
      items[index] = { ...current, parsed, name: deriveItemName(parsed, index) };
      return { ...prev, items };
    });
  }, []);

  /** Removes the item with this id. If it was selected, selection moves to its neighbour. */
  const removeItem = useCallback((id: string) => {
    setState((prev) => {
      const index = prev.items.findIndex((item) => item.id === id);
      if (index === -1) return prev;
      const items = prev.items.filter((item) => item.id !== id);
      const selectedId =
        prev.selectedId === id
          ? (items[index] ?? items[index - 1] ?? null)?.id ?? null
          : prev.selectedId;
      return { items, selectedId };
    });
  }, []);

  const { items, selectedId } = state;
  const selectedIndex = useMemo(
    () => items.findIndex((item) => item.id === selectedId),
    [items, selectedId]
  );
  const selectedItem = selectedIndex === -1 ? undefined : items[selectedIndex];

  return {
    items,
    selectedId,
    selectedIndex,
    selectedItem,
    selectItem,
    updateItem,
    updateParsed,
    removeItem,
  };
}
