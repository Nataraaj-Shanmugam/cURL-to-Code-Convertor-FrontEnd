import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface AddEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: string;
  newKey: string;
  newValue: string;
  onKeyChange: (value: string) => void;
  onValueChange: (value: string) => void;
  onSave: () => void;
}

export function AddEntryDialog({
  open,
  onOpenChange,
  section,
  newKey,
  newValue,
  onKeyChange,
  onValueChange,
  onSave
}: AddEntryDialogProps) {
  const isFlag = section === "flags" || section === "ssl_config";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isFlag ? "Add Flag" : "Add New Entry"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              {isFlag ? "Flag Name" : "Key"}
            </label>
            <Input
              value={newKey}
              onChange={(e) => onKeyChange(e.target.value)}
              placeholder={isFlag ? "e.g., insecure" : "e.g., Authorization"}
            />
          </div>
          {!isFlag && (
            <div>
              <label className="text-sm font-medium mb-2 block">Value</label>
              <Input
                value={newValue}
                onChange={(e) => onValueChange(e.target.value)}
                placeholder="Enter value"
              />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={!newKey.trim()}>
              {isFlag ? "Add Flag" : "Add Entry"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}