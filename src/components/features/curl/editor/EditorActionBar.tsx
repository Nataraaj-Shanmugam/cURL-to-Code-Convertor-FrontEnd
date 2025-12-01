import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  AlertCircle,
  Search,
  Save,
  FolderPlus,
  Code,
  Download,
  Trash2,
  Undo,
  Redo
} from "lucide-react";

interface EditorActionBarProps {
  onBack?: () => void;
  onReset: () => void;
  onSave?: () => void;
  onAddSection: () => void;
  onGenerateCode: () => void;
  onExport: () => void;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
  onUndo: () => void;
  onRedo: () => void;
  selectedCount: number;
  missingSectionsCount: number;
  canUndo: boolean;
  canRedo: boolean;
  showQuickNav: boolean;
  onToggleQuickNav: () => void;
}

export function EditorActionBar({
  onBack,
  onReset,
  onSave,
  onAddSection,
  onGenerateCode,
  onExport,
  onClearSelection,
  onDeleteSelected,
  onUndo,
  onRedo,
  selectedCount,
  missingSectionsCount,
  canUndo,
  canRedo,
  showQuickNav,
  onToggleQuickNav
}: EditorActionBarProps) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div className="flex gap-2 flex-wrap">
        {onBack && (
          <Button variant="outline" onClick={onBack} className="gap-2">
            <ChevronRight className="w-4 h-4 rotate-180" />
            Back
          </Button>
        )}
        
        <Button
          variant="outline"
          onClick={onUndo}
          disabled={!canUndo}
          className="gap-2"
          title="Undo (Ctrl+Z)"
        >
          <Undo className="w-4 h-4" />
          Undo
        </Button>

        <Button
          variant="outline"
          onClick={onRedo}
          disabled={!canRedo}
          className="gap-2"
          title="Redo (Ctrl+Y)"
        >
          <Redo className="w-4 h-4" />
          Redo
        </Button>
        
        <Button
          variant="outline"
          onClick={onReset}
          className="text-orange-600 hover:text-orange-700 gap-2"
        >
          <AlertCircle className="w-4 h-4" />
          Reset
        </Button>
        
        {!showQuickNav && (
          <Button
            variant="outline"
            onClick={onToggleQuickNav}
            className="gap-2"
          >
            <Search className="w-4 h-4" />
            Show Navigation
          </Button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {onSave && (
          <Button
            onClick={onSave}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </Button>
        )}
        
        <Button
          onClick={onAddSection}
          disabled={missingSectionsCount === 0}
          className="bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-400 gap-2"
        >
          <FolderPlus className="w-4 h-4" />
          Add Section {missingSectionsCount > 0 && `(${missingSectionsCount})`}
        </Button>
        
        <Button
          onClick={onGenerateCode}
          className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
        >
          <Code className="w-4 h-4" />
          Generate Code
        </Button>
        
        <Button variant="outline" onClick={onExport} className="gap-2">
          <Download className="w-4 h-4" />
          Export JSON
        </Button>
        
        <Button
          variant="outline"
          onClick={onClearSelection}
          disabled={selectedCount === 0}
        >
          Clear ({selectedCount})
        </Button>
        
        <Button
          variant="destructive"
          onClick={onDeleteSelected}
          disabled={selectedCount === 0}
          className="gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Delete ({selectedCount})
        </Button>
      </div>
    </div>
  );
}