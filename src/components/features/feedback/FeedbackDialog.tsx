import { useState, memo } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import FeedbackForm from "./FeedbackForm";

interface FeedbackDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    curlCommand?: string;
    generatedCode?: string;
    /** Exact secret values from the request, scrubbed from the attached code in addition to pattern matching. */
    knownSecrets?: readonly string[];
}

/** The feedback form in a dialog, opened from the code result. The /feedback page shows the same form. */
function FeedbackDialog({
    open,
    onOpenChange,
    curlCommand,
    generatedCode,
    knownSecrets,
}: FeedbackDialogProps) {
    const [submitted, setSubmitted] = useState(false);
    // Bumped on every close so the form starts empty (and the attachment opt-in off) next time,
    // even if the parent keeps this component mounted.
    const [formKey, setFormKey] = useState(0);

    const handleOpenChange = (next: boolean) => {
        if (!next) {
            setSubmitted(false);
            setFormKey((key) => key + 1);
        }
        onOpenChange(next);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {submitted ? "Thank you!" : "How was your experience?"}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        Tell us what worked and what did not.
                    </DialogDescription>
                </DialogHeader>

                {submitted ? (
                    <div className="flex flex-col items-center gap-4 py-6 animate-fade-up">
                        <div className="rounded-full bg-primary/10 p-3">
                            <CheckCircle2 className="w-8 h-8 text-primary" aria-hidden="true" />
                        </div>
                        <p className="text-sm text-muted-foreground text-center">
                            Your feedback helps us improve CurlCraft Assured.
                        </p>
                        <Button variant="outline" onClick={() => handleOpenChange(false)}>
                            Close
                        </Button>
                    </div>
                ) : (
                    <FeedbackForm
                        key={formKey}
                        onSubmitted={() => setSubmitted(true)}
                        onCancel={() => handleOpenChange(false)}
                        curlCommand={curlCommand}
                        generatedCode={generatedCode}
                        knownSecrets={knownSecrets}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

export default memo(FeedbackDialog);
