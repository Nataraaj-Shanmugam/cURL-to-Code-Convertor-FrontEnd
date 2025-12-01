import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Edit2, Save, Trash2 } from "lucide-react";

interface EditableFieldProps {
  label: string;
  value: any;
  path: string;
  isEditing: boolean;
  currentValue: any;
  isSelected: boolean;
  isNonDeletable: boolean;
  onToggleSelect: (path: string) => void;
  onToggleEdit: (path: string, value: any) => void;
  onEditChange: (path: string, value: any) => void;
  onDelete: (path: string) => void;
}

export function EditableField({
  label,
  value,
  path,
  isEditing,
  currentValue,
  isSelected,
  isNonDeletable,
  onToggleSelect,
  onToggleEdit,
  onEditChange,
  onDelete
}: EditableFieldProps) {
  const isComplex = typeof value === 'object' && value !== null;

  return (
    <div className="flex items-start gap-3 p-3 hover:bg-accent/50 rounded-xl group transition-all duration-200 border-2 border-transparent hover:border-primary/20">
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => onToggleSelect(path)}
        className="mt-1.5"
        disabled={isNonDeletable}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-semibold text-sm text-foreground">{label}</span>
          {isNonDeletable && (
            <Badge
              variant="outline"
              className="text-xs px-2 py-0 border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400"
            >
              Required
            </Badge>
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
              onChange={(e) => {
                try {
                  onEditChange(path, JSON.parse(e.target.value));
                } catch {
                  onEditChange(path, e.target.value);
                }
              }}
              className="font-mono text-xs min-h-[120px] resize-y border-2 focus:border-primary rounded-lg"
            />
          ) : (
            <Input
              value={String(currentValue ?? "")}
              onChange={(e) => onEditChange(path, e.target.value)}
              className="font-mono text-xs border-2 focus:border-primary"
            />
          )
        ) : (
          <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-muted/50 p-3 rounded-lg border-2 border-border shadow-sm">
            {typeof value === "object"
              ? JSON.stringify(value, null, 2)
              : String(value ?? "N/A")}
          </pre>
        )}
      </div>

      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 hover:bg-primary hover:text-primary-foreground"
          onClick={() => onToggleEdit(path, value)}
          title={isEditing ? "Save" : "Edit"}
        >
          {isEditing ? <Save className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
        </Button>
        {!isNonDeletable && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 hover:bg-red-500 hover:text-white"
            onClick={() => onDelete(path)}
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}