import { memo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Edit2, Trash2, Save } from "lucide-react";
import { useEditorContext } from "./EditorContext";
import { MaskedString, RevealToggle } from "./SecretValue";
import { MASK, countRedactions, isSecretField, redactFieldValue } from "@/lib/utils/redaction";

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

  // Secrets are masked until the user reveals them. A value restored from a saved session arrives
  // already redacted: it is flagged so the user re-enters it instead of generating code with a placeholder.
  const [revealed, setRevealed] = useState(false);
  const isSecret = isSecretField(path, value);
  const needsReentry = countRedactions(value) > 0;
  const hidden = isSecret && !revealed;
  const displayValue = hidden ? redactFieldValue(path, value, { placeholder: MASK }) : value;

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
          {needsReentry && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/40">
              Redacted: re-enter value
            </span>
          )}
          {isSecret && <RevealToggle label={label} revealed={revealed} onToggle={() => setRevealed(r => !r)} />}
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
              type={hidden ? "password" : "text"}
              autoComplete="off"
              onFocus={needsReentry ? e => e.target.select() : undefined}
              aria-label={`Value of ${label}`}
              className="font-mono text-xs"
            />
          )
        ) : (
          <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-muted/50 p-2 rounded border border-border">
            <MaskedString
              text={typeof displayValue === "object" ? JSON.stringify(displayValue, null, 2) : String(displayValue ?? "N/A")}
            />
          </pre>
        )}
      </div>

      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => {
            // A multi-line editor can't be masked, so editing a secret object means seeing it.
            if (!isEditing && isSecret && isComplex) setRevealed(true);
            toggleEdit(path, value);
          }}
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
