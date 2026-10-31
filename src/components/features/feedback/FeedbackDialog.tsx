import { useState, memo } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Star, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { apiClient } from "@/lib/api/apiClient";
import { ENV } from "@/lib/env";
import { RATING_LABELS } from "@/constants/feedback";
import { redactCurlString, redactText } from "@/lib/utils/redaction";

const feedbackEndpoint = ENV.FEEDBACK_ENDPOINT;

interface FeedbackDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    curlCommand?: string;
    generatedCode?: string;
    /** Exact secret values from the request, scrubbed from the attached code in addition to pattern matching. */
    knownSecrets?: readonly string[];
}

function FeedbackDialog({
    open,
    onOpenChange,
    curlCommand,
    generatedCode,
    knownSecrets,
}: FeedbackDialogProps) {
    const [rating, setRating] = useState(0);
    const [hoveredStar, setHoveredStar] = useState(0);
    const [comment, setComment] = useState("");
    const [email, setEmail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState("");
    // Attaching the request is opt-in, and whatever is attached has its secrets redacted.
    const [attachRequest, setAttachRequest] = useState(false);
    const canAttach = Boolean(curlCommand || generatedCode);
    const attachedCurl = curlCommand ? redactCurlString(curlCommand, { knownSecrets }) : undefined;
    const attachedCode = generatedCode ? redactText(generatedCode, { knownSecrets }) : undefined;

    const handleSubmit = async () => {
        if (rating === 0) {
            setError("Please select a rating");
            return;
        }

        setError("");
        setIsSubmitting(true);

        try {
            const payload: Record<string, unknown> = { rating };
            if (comment.trim()) payload.comment = comment.trim();
            if (email.trim()) payload.email = email.trim();
            if (attachRequest) {
                if (attachedCurl) payload.curl_command = attachedCurl;
                if (attachedCode) payload.generated_code = attachedCode;
            }

            const { data: result } = await apiClient.post(
                feedbackEndpoint,
                payload,
                // Submitting feedback is not idempotent: one retry at most, for a dropped connection or a waking backend.
                { retries: 1 },
            );

            if (result.success) {
                setSubmitted(true);
            } else {
                setError(result.message || "Failed to submit feedback");
            }
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : "Failed to submit feedback";
            setError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setRating(0);
        setHoveredStar(0);
        setComment("");
        setEmail("");
        setError("");
        setAttachRequest(false);
        setSubmitted(false);
        onOpenChange(false);
    };


    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {submitted ? "Thank You!" : "How was your experience?"}
                    </DialogTitle>
                </DialogHeader>

                <div>
                    {submitted ? (
                        <div className="flex flex-col items-center gap-4 py-6 animate-fade-up">
                            <div className="rounded-full bg-primary/10 p-3">
                                <CheckCircle2 className="w-8 h-8 text-primary" />
                            </div>
                            <p className="text-sm text-muted-foreground text-center">
                                Your feedback helps us improve CurlCraft Assured.
                            </p>
                            <Button variant="outline" onClick={handleClose}>
                                Close
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-5 animate-fade-up">

                            {error && (
                                <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm border border-destructive/30">
                                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            {/* Star Rating */}
                            <div className="flex flex-col items-center gap-2">
                                <div role="radiogroup" aria-label="Rating" className="flex gap-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            type="button"
                                            role="radio"
                                            aria-checked={rating === star}
                                            aria-label={`${RATING_LABELS[star]} — ${star} out of 5`}
                                            onClick={() => {
                                                setRating(star);
                                                setError("");
                                            }}
                                            onMouseEnter={() => setHoveredStar(star)}
                                            onMouseLeave={() => setHoveredStar(0)}
                                            className="p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                                        >
                                            <Star
                                                className={`w-8 h-8 transition-colors ${
                                                    star <= (hoveredStar || rating)
                                                        ? "fill-yellow-400 text-yellow-400"
                                                        : "text-muted-foreground/30"
                                                }`}
                                            />
                                        </button>
                                    ))}
                                </div>
                                <span aria-live="polite" className="text-xs text-muted-foreground min-h-[1em]">
                                    {(hoveredStar || rating) > 0 ? RATING_LABELS[hoveredStar || rating] : ''}
                                </span>
                            </div>

                            {/* Comment */}
                            <div className="space-y-2">
                                <label
                                    htmlFor="feedback-comment"
                                    className="text-sm font-medium"
                                >
                                    Comments{" "}
                                    <span className="text-muted-foreground font-normal">
                                        (optional)
                                    </span>
                                </label>
                                <Textarea
                                    id="feedback-comment"
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    placeholder="Tell us what you liked or what we can improve..."
                                    maxLength={2000}
                                    className="resize-none"
                                    rows={3}
                                />
                            </div>

                            {/* Email */}
                            <div className="space-y-2">
                                <label
                                    htmlFor="feedback-email"
                                    className="text-sm font-medium"
                                >
                                    Email{" "}
                                    <span className="text-muted-foreground font-normal">
                                        (optional)
                                    </span>
                                </label>
                                <Input
                                    id="feedback-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    maxLength={254}
                                />
                            </div>

                            {/* Opt-in attachment */}
                            {canAttach && (
                                <div className="space-y-2 rounded-md border border-border bg-muted/50 p-3">
                                    <label className="flex items-start gap-2 text-sm">
                                        <Checkbox
                                            id="feedback-attach-request"
                                            checked={attachRequest}
                                            onCheckedChange={(checked) => setAttachRequest(checked === true)}
                                            className="mt-0.5"
                                        />
                                        <span>
                                            Include my cURL command and generated code
                                            <span className="block text-xs text-muted-foreground">
                                                Off by default. Secrets (tokens, API keys, passwords, cookies) are
                                                redacted before anything is sent.
                                            </span>
                                        </span>
                                    </label>
                                    {attachRequest && (
                                        <details className="text-xs">
                                            <summary className="cursor-pointer text-muted-foreground">
                                                Preview what will be attached
                                            </summary>
                                            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded border bg-background p-2 font-mono">
                                                {[attachedCurl, attachedCode].filter(Boolean).join("\n\n")}
                                            </pre>
                                        </details>
                                    )}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex justify-end gap-2 pt-2 border-t">
                                <Button variant="outline" onClick={handleClose}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSubmit}
                                    disabled={rating === 0 || isSubmitting}
                                    className="bg-primary"
                                >
                                    {isSubmitting ? (
                                        "Submitting..."
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4 mr-2" />
                                            Submit Feedback
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default memo(FeedbackDialog);
