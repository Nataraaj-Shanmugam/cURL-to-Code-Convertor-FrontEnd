import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Edit2, Trash2, Save } from "lucide-react";
import { useEditorContext } from "./EditorContext";

interface EditableFieldProps {
  label: string;
  value: unknown;
  path: string;
  /** basePath used to build `fieldPath` when isTopLevel */
  basePath?: string;
  isTopLevel?: boolean;
}

function EditableField({ label, value, path }: EditableFieldProps) {
  const { editing, editedValues, selected, toggleSelect, toggleEdit, handleEditChange, deleteSingle } =
    useEditorContext();

  const isEditing = editing[path];
  const currentValue = isEditing ? editedValues[path] : value;
  const isComplex = typeof value === "object" && value !== null;
  const isNonDeletable = ["method", "url", "base_url", "endpoint"].includes(label);

  return (
    <div className="flex items-start gap-3 p-2 hover:bg-accent/30 rounded-md group transition-colors">
      <Checkbox
        checked={selected.has(path)}
        onCheckedChange={() => toggleSelect(path)}
        className="mt-1"
        disabled={isNonDeletable}
        aria-label={`Select ${label} for deletion`}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-sm text-foreground">{label}</span>
          {isNonDeletable && (
            <span className="text-xs px-1.5 py-0.5 bg-accent text-accent-foreground rounded">
              Required
            </span>
          )}
        </div>

        {isEditing ? (
          isComplex ? (
            <Textarea
              value={
                typeof currentValue === "string"
                  ? currentValue
                  : JSON.stringify(currentValue, null, 2)
              }
              onChange={e => {
                try {
                  handleEditChange(path, JSON.parse(e.target.value) as unknown);
                } catch {
                  handleEditChange(path, e.target.value);
                }
              }}
              className="font-mono text-xs min-h-[100px] resize-y"
            />
          ) : (
            <Input
              value={String(currentValue ?? "")}
              onChange={e => handleEditChange(path, e.target.value)}
              className="font-mono text-xs"
            />
          )
        ) : (
          <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-muted/50 p-2 rounded border border-border">
            {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value ?? "N/A")}
          </pre>
        )}
      </div>

      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => toggleEdit(path, value)}
          aria-label={isEditing ? `Save ${label}` : `Edit ${label}`}
        >
          {isEditing ? <Save className="h-3 w-3" /> : <Edit2 className="h-3 w-3" />}
        </Button>
        {!isNonDeletable && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => deleteSingle(path)}
            aria-label={`Delete ${label}`}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default memo(EditableField);
