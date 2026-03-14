import { createContext, useContext } from "react";

// Shared callbacks injected by ParsedCurlEditor and consumed by sub-components.
// Using context avoids threading 10+ props through multiple levels.

export interface EditorCallbacks {
  editing: Record<string, boolean>;
  editedValues: Record<string, unknown>;
  selected: Set<string>;
  bodyCollapsed: Record<string, boolean>;
  allExpanded: boolean;
  toggleSelect: (path: string) => void;
  toggleEdit: (path: string, value: unknown) => void;
  handleEditChange: (path: string, value: unknown) => void;
  deleteSingle: (path: string) => void;
  toggleBodyCollapse: (path: string) => void;
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
