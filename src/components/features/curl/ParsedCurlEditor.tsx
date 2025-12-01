// src/components/features/curl/ParsedCurlEditor.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion } from "@/components/ui/accordion";
import { Settings } from "lucide-react";
import { useParsedCurlEditor } from "@/lib/hooks/useParsedCurlEditor";
import CodeGenerationDialog from "./CodeGenerationDialog";
import { EditorHeader } from "./editor/EditorHeader";
import { EditorActionBar } from "./editor/EditorActionBar";
import { AddEntryDialog } from "./editor/AddEntryDialog";
import { AddSectionDialog } from "./editor/AddSectionDialog";
import { SectionRenderer } from "./editor/SectionRenderer";

interface ParsedCurlEditorProps {
  initialData: any;
  originalCurl?: string;
  onBack?: () => void;
  onSave?: (data: any) => void;
}

export default function ParsedCurlEditor({
  initialData,
  originalCurl,
  onBack,
  onSave,
}: ParsedCurlEditorProps) {
  const navigate = useNavigate();
  const [showCodeDialog, setShowCodeDialog] = useState(false);
  const [showQuickNav, setShowQuickNav] = useState(true);

  // Redirect if no data (FIXES CRITICAL ISSUE #1)
  useEffect(() => {
    if (!initialData || Object.keys(initialData).length === 0) {
      navigate('/');
    }
  }, [initialData, navigate]);

  const {
    parsed,
    selected,
    editing,
    editedValues,
    showAddDialog,
    addDialogSection,
    newKey,
    newValue,
    showNewSectionDialog,
    newSectionName,
    openSections,
    bodyCollapsed,
    allExpanded,
    canUndo,
    canRedo,
    setNewKey,
    setNewValue,
    setShowAddDialog,
    setShowNewSectionDialog,
    setNewSectionName,
    setOpenSections,
    setSelected,
    handleReset,
    deleteSection,
    toggleSelect,
    toggleEdit,
    deleteSelected,
    deleteSingle,
    handleEditChange,
    exportData,
    handleAddEntry,
    saveNewEntry,
    handleAddSection,
    saveNewSection,
    toggleBodyCollapse,
    handleBodyExpandCollapseAll,
    hasActiveFlags,
    getActiveFlags,
    getMissingSections,
    undo,
    redo,
    isPojoDisabled,
  } = useParsedCurlEditor(initialData);

  // Keyboard shortcuts (NEW FEATURE)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          undo();
        } else if (e.key === 'y') {
          e.preventDefault();
          redo();
        } else if (e.key === 's') {
          e.preventDefault();
          handleSave();
        } else if (e.key === 'g') {
          e.preventDefault();
          handleGenerateCode();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const handleSave = () => {
    if (onSave) {
      onSave(parsed);
    }
  };

  const handleGenerateCode = () => {
    setShowCodeDialog(true);
  };

  const missingSections = getMissingSections();

  // Don't render if no data (will redirect via useEffect)
  if (!parsed || Object.keys(parsed).length === 0) {
    return null;
  }

  const stats = {
    headers: getSectionCount(parsed.headers),
    params: getSectionCount(parsed.query_parameters),
    hasAuth: !!(
      parsed.auth ||
      parsed.headers?.Authorization ||
      parsed.headers?.authorization
    ),
    hasBody: !!(parsed.data && getSectionCount(parsed.data) > 0),
  };

  return (
    <div className="max-w-7xl mx-auto pb-12">
      {/* Header with original cURL */}
      <div className="mb-8 space-y-6">
        <EditorHeader originalCurl={originalCurl} />
      </div>

      {/* Action Bar with Undo/Redo */}
      <div className="mb-6">
        <EditorActionBar
          onBack={onBack}
          onReset={handleReset}
          onSave={onSave ? handleSave : undefined}
          onAddSection={handleAddSection}
          onGenerateCode={handleGenerateCode}
          onExport={exportData}
          onClearSelection={() => setSelected(new Set())}
          onDeleteSelected={deleteSelected}
          onUndo={undo}
          onRedo={redo}
          selectedCount={selected.size}
          missingSectionsCount={missingSections.length}
          canUndo={canUndo}
          canRedo={canRedo}
          showQuickNav={showQuickNav}
          onToggleQuickNav={() => setShowQuickNav(!showQuickNav)}
        />
      </div>

      {/* Code Generation Dialog with POJO disabled support */}
      <CodeGenerationDialog
        open={showCodeDialog}
        onOpenChange={setShowCodeDialog}
        parsedData={parsed}
        isPojoDisabled={isPojoDisabled()}
      />

      {/* Add Entry Dialog */}
      <AddEntryDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        section={addDialogSection}
        newKey={newKey}
        newValue={newValue}
        onKeyChange={setNewKey}
        onValueChange={setNewValue}
        onSave={saveNewEntry}
      />

      {/* Add Section Dialog */}
      <AddSectionDialog
        open={showNewSectionDialog}
        onOpenChange={setShowNewSectionDialog}
        missingSections={missingSections}
        selectedSection={newSectionName}
        onSectionChange={setNewSectionName}
        onSave={saveNewSection}
      />

      {/* Main Editor Card */}
      <Card className="shadow-lg border-2 animate-fade-in">
        <CardHeader className="border-b-2 bg-gradient-to-r from-primary/5 to-primary/10">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl text-primary flex items-center gap-2">
                <Settings className="w-6 h-6" />
                Edit Parsed Request
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Edit values, manage sections, and generate code
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <Accordion
            type="multiple"
            value={openSections}
            onValueChange={setOpenSections}
            className="space-y-4"
          >
            {/* Render all sections using SectionRenderer */}
            <SectionRenderer
              parsed={parsed}
              selected={selected}
              editing={editing}
              editedValues={editedValues}
              openSections={openSections}
              bodyCollapsed={bodyCollapsed}
              allExpanded={allExpanded}
              stats={stats}
              onToggleSelect={toggleSelect}
              onToggleEdit={toggleEdit}
              onDeleteSingle={deleteSingle}
              onEditChange={handleEditChange}
              onDeleteSection={deleteSection}
              onAddEntry={handleAddEntry}
              onBodyExpandCollapseAll={handleBodyExpandCollapseAll}
              onToggleBodyCollapse={toggleBodyCollapse}
              hasActiveFlags={hasActiveFlags}
              getActiveFlags={getActiveFlags}
            />
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper function
function getSectionCount(data: any): number {
  if (!data) return 0;
  if (Array.isArray(data)) return data.length;
  if (typeof data === "object")
    return Object.keys(data).filter(
      (k) => data[k] !== null && data[k] !== undefined
    ).length;
  return 1;
}