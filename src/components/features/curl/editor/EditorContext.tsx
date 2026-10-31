import { createContext, useContext } from "react";
import type { FieldPath } from "@/lib/utils/fieldPath";

// Shared callbacks injected by ParsedCurlEditor and consumed by sub-components.
// Using context avoids threading 10+ props through multiple levels.

export interface EditorCallbacks {
  editing: Record<string, boolean>;
  editedValues: Record<string, unknown>;
  selected: Set<string>;
  bodyCollapsed: Record<string, boolean>;
  allExpanded: boolean;
  // Paths are escaped path ids or segment arrays (see fieldPath.ts); state records are keyed by id.
  toggleSelect: (path: FieldPath) => void;
  toggleEdit: (path: FieldPath, value: unknown) => void;
  handleEditChange: (path: FieldPath, value: unknown) => void;
  deleteSingle: (path: FieldPath) => void;
  toggleBodyCollapse: (path: FieldPath) => void;
  handleAddEntry: (section: string) => void;
  handleBodyExpandCollapseAll: () => void;
  hasActiveFlags: (v: unknown) => boolean;
  getActiveFlags: (v: unknown) => string[];
  hasValidData: (v: unknown) => boolean;
  requestConfirm: (action: { type: "reset" } | { type: "deleteSection"; key: string }) => void;
}

export const EditorContext = createContext<EditorCallbacks | null>(null);

export const useEditorContext = (): EditorCallbacks => {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditorContext must be used within EditorContext.Provider");
  return ctx;
};
