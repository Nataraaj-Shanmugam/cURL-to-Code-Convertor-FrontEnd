import { useState, useRef, useCallback } from "react";
import type { ParsedCurl } from "@/types/curl";

interface EditingState {
  [key: string]: boolean;
}

export interface EditedValues {
  [key: string]: unknown;
}

interface CollapsedState {
  [key: string]: boolean;
}

const MAX_HISTORY = 50;

// If body data is a JSON string, parse it into an object for node-level editing.
export const parseBodyData = (data: ParsedCurl | undefined): ParsedCurl => {
  const clone = JSON.parse(JSON.stringify(data || {})) as ParsedCurl;
  if (typeof clone.data === "string") {
    try {
      const parsed = JSON.parse(clone.data) as unknown;
      if (typeof parsed === "object" && parsed !== null) {
        clone.data = parsed as object;
      }
    } catch {
      // Not valid JSON — keep as string
    }
  }
  return clone;
};

export const useEditorState = (initialData: ParsedCurl | undefined) => {
  const initial = parseBodyData(initialData);

  const [originalParsed] = useState<ParsedCurl>((initialData ?? {}) as ParsedCurl);
  const [parsed, setParsedInternal] = useState<ParsedCurl>(initial);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<EditingState>({});
  const [editedValues, setEditedValues] = useState<EditedValues>({});
  const [bodyCollapsed, setBodyCollapsed] = useState<CollapsedState>({});
  const [allExpanded, setAllExpanded] = useState(false);

  // Undo/redo history stored in refs to avoid stale-closure issues
  const historyRef = useRef<ParsedCurl[]>([structuredClone(initial)]);
  const historyIndexRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncHistoryFlags = () => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  };

  // Call this instead of setParsedInternal when the change should be undoable
  const setParsed = useCallback((newState: ParsedCurl) => {
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(structuredClone(newState));
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current = historyRef.current.slice(-MAX_HISTORY);
    }
    historyIndexRef.current = historyRef.current.length - 1;
    setParsedInternal(newState);
    syncHistoryFlags();
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      const prev = historyRef.current[historyIndexRef.current];
      if (prev) setParsedInternal(structuredClone(prev));
      syncHistoryFlags();
    }
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      const next = historyRef.current[historyIndexRef.current];
      if (next) setParsedInternal(structuredClone(next));
      syncHistoryFlags();
    }
  }, []);

  // Reset clears history — it's an intentional full revert
  const resetParsed = useCallback((newState: ParsedCurl) => {
    historyRef.current = [structuredClone(newState)];
    historyIndexRef.current = 0;
    setParsedInternal(newState);
    syncHistoryFlags();
  }, []);

  const toggleSelect = useCallback((path: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleEditChange = useCallback((path: string, value: unknown) => {
    setEditedValues(prev => ({ ...prev, [path]: value }));
  }, []);

  const toggleBodyCollapse = useCallback((path: string) => {
    setBodyCollapsed(prev => ({ ...prev, [path]: !prev[path] }));
  }, []);

  return {
    originalParsed,
    parsed,
    setParsed,
    resetParsed,
    undo,
    redo,
    canUndo,
    canRedo,
    selected,
    setSelected,
    editing,
    setEditing,
    editedValues,
    setEditedValues,
    bodyCollapsed,
    setBodyCollapsed,
    allExpanded,
    setAllExpanded,
    toggleSelect,
    handleEditChange,
    toggleBodyCollapse,
  };
};
