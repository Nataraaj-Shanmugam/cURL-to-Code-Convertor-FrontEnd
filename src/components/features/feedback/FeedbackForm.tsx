import { useId, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { StarRating } from "@/components/ui/star-rating";
import { apiClient } from "@/lib/api/apiClient";
import { ENV } from "@/lib/env";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_DETAILS_MAX,
  FEEDBACK_DETAILS_MIN,
  RATING_LABELS,
  type FeedbackCategory,
} from "@/constants/feedback";
import { redactCurlString, redactText } from "@/lib/utils/redaction";

export interface FeedbackFormProps {
  /** Called after the backend accepted the feedback. */
  onSubmitted: () => void;
  /** Shows a Cancel button (the dialog); the page has none. */
  onCancel?: () => void;
  defaultCategory?: FeedbackCategory;
  curlCommand?: string;
  generatedCode?: string;
  /** Exact secret values from the request, scrubbed from the attached code in addition to pattern matching. */
  knownSecrets?: readonly string[];
}

/**
 * The feedback form, shared by the /feedback page and the dialog opened from the code result.
 * Payload follows production's contract: { email, category, details, metadata }. The star rating
 * and the request attachment are optional extras and are only sent when the user chose them.
 */
export default function FeedbackForm({
  onSubmitted,
  onCancel,
  defaultCategory,
  curlCommand,
  generatedCode,
  knownSecrets,
}: FeedbackFormProps) {
  const uid = useId();
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState<FeedbackCategory | "">(defaultCategory ?? "");
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  // Attaching the request is opt-in, and whatever is attached has its secrets redacted.
  const [attachRequest, setAttachRequest] = useState(false);
  const canAttach = Boolean(curlCommand || generatedCode);
  const attachedCurl = curlCommand ? redactCurlString(curlCommand, { knownSecrets }) : undefined;
  const attachedCode = generatedCode ? redactText(generatedCode, { knownSecrets }) : undefined;

  const trimmedDetails = details.trim();
  const clearError = () => error && setError("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!category) return setError("Please select a feedback category");
    if (!trimmedDetails) return setError("Please provide feedback details");
    if (trimmedDetails.length < FEEDBACK_DETAILS_MIN) {
      return setError(`Please provide at least ${FEEDBACK_DETAILS_MIN} characters of feedback`);
    }

    setError("");
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        email: email.trim(),
        category,
        details: trimmedDetails,
        metadata: {
          userAgent: navigator.userAgent,
          pageUrl: window.location.href,
          timestamp: new Date().toISOString(),
          screenResolution: `${window.screen.width}x${window.screen.height}`,
        },
      };
      if (rating > 0) payload.rating = rating;
      if (attachRequest) {
        if (attachedCurl) payload.curl_command = attachedCurl;
        if (attachedCode) payload.generated_code = attachedCode;
      }

      const { data: result } = await apiClient.post(ENV.FEEDBACK_ENDPOINT, payload);
      if (result.success) {
        onSubmitted();
      } else {
        const message = typeof result.error === "object" ? result.error?.message : undefined;
        setError(message || result.message || "Failed to submit feedback");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  const categoryLabelId = `${uid}-category-label`;
  const errorId = `${uid}-error`;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {error && (
        <Alert variant="destructive" id={errorId}>
          <span>{error}</span>
        </Alert>
      )}

      {/* Rating (optional) */}
      <div className="flex flex-col items-center gap-2">
        <StarRating
          value={rating}
          onChange={(next) => {
            setRating(next);
            clearError();
          }}
          labels={RATING_LABELS}
          aria-label="Rating (optional)"
        />
        <span aria-live="polite" className="text-xs text-muted-foreground min-h-[1em]">
          {rating > 0 ? RATING_LABELS[rating] : ""}
        </span>
      </div>

      {/* Category */}
      <div className="space-y-2">
        <p id={categoryLabelId} className="text-sm font-medium text-foreground">
          Category <span className="text-destructive" aria-hidden="true">*</span>
          <span className="sr-only">(required)</span>
        </p>
        <RadioGroup
          value={category}
          onValueChange={(next) => {
            setCategory(next as FeedbackCategory);
            clearError();
          }}
          aria-labelledby={categoryLabelId}
          aria-required="true"
          className="grid-cols-1 sm:grid-cols-2"
        >
          {FEEDBACK_CATEGORIES.map(({ value, label }) => (
            <label key={value} className="flex min-h-[28px] cursor-pointer items-center gap-2 text-sm">
              <RadioGroupItem value={value} aria-label={label} />
              {label}
            </label>
          ))}
        </RadioGroup>
      </div>

      {/* Details */}
      <div className="space-y-2">
        <label htmlFor={`${uid}-details`} className="text-sm font-medium">
          Details <span className="text-destructive" aria-hidden="true">*</span>
          <span className="sr-only">(required)</span>
        </label>
        <Textarea
          id={`${uid}-details`}
          value={details}
          onChange={(e) => {
            setDetails(e.target.value);
            clearError();
          }}
          placeholder="Tell us what happened or what you would like. For a bug, include the steps to reproduce it."
          maxLength={FEEDBACK_DETAILS_MAX}
          className="min-h-[120px] resize-y"
          rows={5}
          required
          aria-describedby={`${uid}-details-hint`}
          aria-invalid={error && trimmedDetails.length < FEEDBACK_DETAILS_MIN ? true : undefined}
        />
        <div id={`${uid}-details-hint`} className="flex justify-between text-xs text-muted-foreground">
          <span>Minimum {FEEDBACK_DETAILS_MIN} characters</span>
          <span>
            {details.length} / {FEEDBACK_DETAILS_MAX}
          </span>
        </div>
      </div>

      {/* Email */}
      <div className="space-y-2">
        <label htmlFor={`${uid}-email`} className="text-sm font-medium">
          Email <span className="text-muted-foreground font-normal">(optional, for follow-up)</span>
        </label>
        <Input
          id={`${uid}-email`}
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
              id={`${uid}-attach`}
              checked={attachRequest}
              onCheckedChange={(checked) => setAttachRequest(checked === true)}
              className="mt-0.5"
            />
            <span>
              {curlCommand && generatedCode ? "Include my cURL command and generated code" : "Include my cURL command"}
              <span className="block text-xs text-muted-foreground">
                Off by default. Secrets (tokens, API keys, passwords, cookies) are redacted before anything is sent.
              </span>
            </span>
          </label>
          {attachRequest && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Preview what will be attached</summary>
              <pre
                tabIndex={0}
                role="region"
                aria-label="Attached request preview"
                className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded border bg-background p-2 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {[attachedCurl, attachedCode].filter(Boolean).join("\n\n")}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-2 border-t sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting} className="gap-2">
          {isSubmitting ? (
            "Submitting..."
          ) : (
            <>
              <Send className="w-4 h-4" aria-hidden="true" />
              Submit Feedback
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
