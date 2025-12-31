// Feedback.tsx
import { useState } from "react";
import { Send, CheckCircle2, AlertCircle, Mail, MessageSquare, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { feedbackApi } from "@/lib/api/feedback";

const FEEDBACK_CATEGORIES = [
  { value: "ui_ux", label: "UI/UX Issues" },
  { value: "bug", label: "Functionality Bug" },
  { value: "performance", label: "Performance Issue" },
  { value: "feature", label: "Feature Request" },
  { value: "documentation", label: "Documentation" },
  { value: "other", label: "Other" },
];

export default function Feedback() {
  const [formData, setFormData] = useState({
    email: "",
    category: "",
    details: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async () => {
    // Validation
    if (!formData.category) {
      setErrorMessage("Please select a feedback category");
      setSubmitStatus("error");
      return;
    }
    
    if (!formData.details.trim()) {
      setErrorMessage("Please provide feedback details");
      setSubmitStatus("error");
      return;
    }

    if (formData.details.trim().length < 10) {
      setErrorMessage("Please provide at least 10 characters of feedback");
      setSubmitStatus("error");
      return;
    }

    setSubmitting(true);
    setSubmitStatus("idle");
    setErrorMessage("");

    try {
      // Get additional context
      const metadata = {
        userAgent: navigator.userAgent,
        pageUrl: window.location.href,
        timestamp: new Date().toISOString(),
        screenResolution: `${window.screen.width}x${window.screen.height}`,
      };

      const response = await feedbackApi.submit({
        ...formData,
        metadata,
      });

      if (response.success) {
        setSubmitStatus("success");
        setFormData({ email: "", category: "", details: "" });
        
        // Reset success message after 5 seconds
        setTimeout(() => {
          setSubmitStatus("idle");
        }, 5000);
      } else {
        setSubmitStatus("error");
        setErrorMessage(response.error?.message || "Failed to submit feedback. Please try again.");
      }
    } catch (error) {
      console.error("Feedback submission error:", error);
      setSubmitStatus("error");
      setErrorMessage(
        error instanceof Error 
          ? error.message 
          : "Network error. Please check your connection and try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (submitStatus === "error") {
      setSubmitStatus("idle");
      setErrorMessage("");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-28">
        <div className="max-w-3xl mx-auto text-center space-y-6 mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-500 shadow-xl mb-6">
            <MessageSquare className="w-10 h-10 text-white" strokeWidth={2} />
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 dark:from-cyan-400 dark:via-teal-400 dark:to-emerald-400">
              We Value Your Feedback
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 leading-relaxed">
            Help us improve CurlCraft Assured by sharing your thoughts, reporting issues, or suggesting new features
          </p>
        </div>

        {/* Feedback Form */}
        <div className="max-w-2xl mx-auto">
          <Card className="shadow-2xl border-2">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl">Submit Feedback</CardTitle>
              <CardDescription>
                Your feedback helps us build a better experience for everyone
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-6">
                {/* Email Field */}
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
                    <Mail className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    Email Address
                    <span className="text-xs text-muted-foreground font-normal">(optional - for follow-up)</span>
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    className="h-11"
                  />
                </div>

                {/* Category Field */}
                <div className="space-y-2">
                  <label htmlFor="category" className="text-sm font-medium flex items-center gap-2">
                    <Tag className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    Feedback Category
                    <span className="text-xs text-destructive">*</span>
                  </label>
                  <Select value={formData.category} onValueChange={(value) => handleChange("category", value)}>
                    <SelectTrigger id="category" className="h-11">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {FEEDBACK_CATEGORIES.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Details Field */}
                <div className="space-y-2">
                  <label htmlFor="details" className="text-sm font-medium flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    Feedback Details
                    <span className="text-xs text-destructive">*</span>
                  </label>
                  <Textarea
                    id="details"
                    placeholder="Please describe your feedback in detail. Include steps to reproduce if reporting a bug, or explain your feature request clearly."
                    value={formData.details}
                    onChange={(e) => handleChange("details", e.target.value)}
                    className="min-h-[180px] resize-y"
                    maxLength={2000}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Minimum 10 characters</span>
                    <span>{formData.details.length} / 2000</span>
                  </div>
                </div>

                {/* Status Messages */}
                {submitStatus === "success" && (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                        Thank you for your feedback!
                      </p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                        We've received your submission and will review it shortly.
                      </p>
                    </div>
                  </div>
                )}

                {submitStatus === "error" && (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-900 dark:text-red-100">
                        Submission Failed
                      </p>
                      <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                        {errorMessage}
                      </p>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full h-12 text-base font-semibold"
                  size="lg"
                >
                  {submitting ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2" />
                      Submit Feedback
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Additional Info */}
          {/* <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Fields marked with <span className="text-destructive">*</span> are required
            </p>
          </div> */}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="container mx-auto px-4 py-12 pb-20">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-center">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">How quickly will you respond?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  We review all feedback at our earliest. If you provided an email, we'll reach out if we need clarification or when the issue is resolved.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">What information should I include?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  For bugs: describe what happened, what you expected, and steps to reproduce. For features: explain the problem you're trying to solve and your suggested solution.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Is my feedback anonymous?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  If you don't provide an email, your feedback is anonymous. We collect basic technical information (browser type, page URL) to help us understand context.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}