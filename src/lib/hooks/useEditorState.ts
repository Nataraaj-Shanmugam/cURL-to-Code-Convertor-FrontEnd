import { useState, useRef, useCallback, useMemo } from "react";
import type { ParsedCurl } from "@/types/curl";
import { deepEqual } from "@/lib/utils/deepEqual";
import { type FieldPath, toPathId } from "@/lib/utils/fieldPath";
import { normalizeParsedCurl, syncRequestUrl } from "@/lib/utils/requestUrl";

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

// Load-time normalisation: fill in url/base_url/endpoint/query_params the backend left out (see
// normalizeParsedCurl), and if body data is a JSON string, parse it into an object for node-level
// editing. An empty input stays empty (the editor shows its empty state).
export const parseBodyData = (data: ParsedCurl | undefined): ParsedCurl => {
  const raw = JSON.parse(JSON.stringify(data || {})) as ParsedCurl;
  const clone = Object.keys(raw).length > 0 ? normalizeParsedCurl(raw) : raw;
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
  // Both sides are normalised the same way at load. The original used to keep the raw JSON-string
  // body while the working copy held the parsed object, so an untouched body looked "modified"
  // in the diff and Reset restored the raw string.
  const [originalParsed] = useState<ParsedCurl>(() => parseBodyData(initialData));
  const [parsed, setParsedInternal] = useState<ParsedCurl>(() => structuredClone(originalParsed));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<EditingState>({});
  const [editedValues, setEditedValues] = useState<EditedValues>({});
  const [bodyCollapsed, setBodyCollapsed] = useState<CollapsedState>({});
  const [allExpanded, setAllExpanded] = useState(false);

  // Undo/redo history stored in refs to avoid stale-closure issues
  const historyRef = useRef<ParsedCurl[]>([structuredClone(originalParsed)]);
  const historyIndexRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // True when the working copy differs from the normalised original. Undoing or reverting back to
  // the original makes it false again.
  const isDirty = useMemo(() => !deepEqual(parsed, originalParsed), [parsed, originalParsed]);

  const syncHistoryFlags = () => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  };

  // Call this instead of setParsedInternal when the change should be undoable. Every edit goes
  // through here, so this is where url and base_url/endpoint/query_params are kept in sync.
  const setParsed = useCallback((nextState: ParsedCurl) => {
    const current = historyRef.current[historyIndexRef.current];
    const newState = current ? syncRequestUrl(current, nextState) : nextState;
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

  // Per-field state is keyed by the escaped path id (see fieldPath.ts); callers may pass either form.
  const toggleSelect = useCallback((path: FieldPath) => {
    const id = toPathId(path);
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleEditChange = useCallback((path: FieldPath, value: unknown) => {
    const id = toPathId(path);
    setEditedValues(prev => ({ ...prev, [id]: value }));
  }, []);

  const toggleBodyCollapse = useCallback((path: FieldPath) => {
    const id = toPathId(path);
    setBodyCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  return {
    originalParsed,
    parsed,
    isDirty,
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
