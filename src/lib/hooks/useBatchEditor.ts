import { useState, useCallback } from "react";
import type { BatchItem } from "@/types/batch";
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

function deriveMethodName(parsed: ParsedCurl, index: number): string {
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

export function useBatchEditor(
  initialItems: { parsed: ParsedCurl; originalCurl: string }[]
) {
  const [items, setItems] = useState<BatchItem[]>(() =>
    initialItems.map((item, i) => ({
      id: String(i),
      originalCurl: item.originalCurl,
      parsed: item.parsed,
      config: {
        ...DEFAULT_CONFIG,
        methodName: deriveMethodName(item.parsed, i),
      },
      name: `${(item.parsed.method || "GET").toUpperCase()} ${
        item.parsed.endpoint || item.parsed.base_url || "Request " + i
      }`,
    }))
  );
  const [selectedIndex, setSelectedIndex] = useState(0);

  const updateItem = useCallback(
    (index: number, update: Partial<BatchItem>) => {
      setItems((prev) =>
        prev.map((item, i) => (i === index ? { ...item, ...update } : item))
      );
    },
    []
  );

  const removeItem = useCallback(
    (index: number) => {
      setItems((prev) => prev.filter((_, i) => i !== index));
      setSelectedIndex((prev) => Math.min(prev, Math.max(0, items.length - 2)));
    },
    [items.length]
  );

  return { items, selectedIndex, setSelectedIndex, updateItem, removeItem };
}
