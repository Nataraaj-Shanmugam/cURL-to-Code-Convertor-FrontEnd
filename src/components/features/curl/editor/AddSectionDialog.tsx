import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface AddSectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  missingSections: Array<[string, string]>;
  selectedSection: string;
  onSectionChange: (value: string) => void;
  onSave: () => void;
}

export function AddSectionDialog({
  open,
  onOpenChange,
  missingSections,
  selectedSection,
  onSectionChange,
  onSave
}: AddSectionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Missing Section</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Select Section</label>
            <Select value={selectedSection} onValueChange={onSectionChange}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a section" />
              </SelectTrigger>
              <SelectContent>
                {missingSections.map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={!selectedSection}>
              Add Section
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}