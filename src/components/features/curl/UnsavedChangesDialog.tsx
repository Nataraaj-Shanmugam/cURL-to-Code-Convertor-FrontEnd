import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UnsavedChangesDialogProps {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
}

/** Confirms leaving the editor with unsaved edits. Closing it (Esc, X, overlay) means "stay". */
export default function UnsavedChangesDialog({ open, onStay, onLeave }: UnsavedChangesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={next => !next && onStay()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Discard unsaved edits?</DialogTitle>
          <DialogDescription>
            You have edits that have not been used to generate code. If you leave this page they
            will be lost.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onStay}>
            Keep editing
          </Button>
          <Button variant="destructive" onClick={onLeave}>
            Discard and leave
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
