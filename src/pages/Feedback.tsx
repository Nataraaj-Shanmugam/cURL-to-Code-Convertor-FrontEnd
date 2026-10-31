import { useState } from "react";
import { useLocation } from "react-router-dom";
import { CheckCircle2, MessageSquare } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import FeedbackForm from "@/components/features/feedback/FeedbackForm";
import { FEEDBACK_CATEGORIES, type FeedbackCategory, type FeedbackLocationState } from "@/constants/feedback";

const isCategory = (value: unknown): value is FeedbackCategory =>
  FEEDBACK_CATEGORIES.some((category) => category.value === value);

export default function Feedback() {
  const state = (useLocation().state ?? {}) as FeedbackLocationState;
  const [submitted, setSubmitted] = useState(false);
  // Remount the form (clearing it) when the user chooses to send another message.
  const [formKey, setFormKey] = useState(0);

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-mono">Feedback</h1>
          <p className="text-sm text-muted-foreground">
            Report a problem, suggest a feature, or tell us how it is going.
          </p>
        </div>
      </div>

      {submitted && (
        <Alert variant="success" icon={<CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />}>
          <AlertTitle>Thank you for your feedback!</AlertTitle>
          <AlertDescription>We have received it and will review it shortly.</AlertDescription>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => {
              setSubmitted(false);
              setFormKey((key) => key + 1);
            }}
          >
            Send more feedback
          </Button>
        </Alert>
      )}

      {!submitted && (
        <Card>
          <CardHeader>
            <CardTitle as="h2" className="text-lg">
              Send feedback
            </CardTitle>
            <CardDescription>
              Your feedback helps us improve CurlCraft Assured. If you leave an email we can follow up.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <FeedbackForm
              key={formKey}
              onSubmitted={() => setSubmitted(true)}
              defaultCategory={isCategory(state.category) ? state.category : undefined}
              curlCommand={typeof state.curlCommand === "string" ? state.curlCommand : undefined}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
