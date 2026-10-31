import { useState, useRef, useEffect, useMemo, memo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, MessageSquare, ShieldAlert } from "lucide-react";
import { curlApi, generationErrorMessage } from "@/lib/api/curl";
import type { ParsedCurl } from "@/types/curl";
import FeedbackDialog from "@/components/features/feedback/FeedbackDialog";
import { collectSecretValues, countRedactions } from "@/lib/utils/redaction";
import { detectDataFormat } from "@/lib/utils/dataFormatDetector";
import {
  ADVANCED_FIELDS,
  DEFAULT_FORM,
  buildGenerateConfig,
  isNonBodyMethod,
  readGenerateResponse,
  requestSignature,
  validateForm,
  type CodeGenForm,
  type FormField,
  type GeneratedResult,
} from "@/lib/utils/codeGeneration";
import AdvancedSection from "./codegen/AdvancedSection";
import ResultPanel from "./codegen/ResultPanel";

interface CodeGenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parsedData: ParsedCurl;
  /** Overrides the default rule (no POJOs for GET/DELETE/HEAD/OPTIONS). */
  isPojoDisabled?: boolean;
}

/** DOM id of each field, so a failed submit can move focus to the first one that needs fixing. */
const FIELD_IDS: Record<FormField, string> = {
  option: "option-full",
  className: "class-name",
  methodName: "method-name",
  pojoClassName: "pojo-class-name",
  statusCode: "status-code",
  maxResponseTimeMs: "max-response-time",
  groupId: "pom-group-id",
  artifactId: "pom-artifact-id",
  version: "pom-version",
};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-destructive mt-1">
      {message}
    </p>
  );
}

function CodeGenerationDialogInner({ open, onOpenChange, parsedData, isPojoDisabled }: CodeGenerationDialogProps) {
  const [form, setForm] = useState<CodeGenForm>(DEFAULT_FORM);
  const [touched, setTouched] = useState<ReadonlySet<FormField>>(new Set());
  const [attempted, setAttempted] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [focusField, setFocusField] = useState<FormField | null>(null);

  const [currentStep, setCurrentStep] = useState<"config" | "result">("config");
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const errorRef = useRef<HTMLDivElement>(null);
  const resultHeadingRef = useRef<HTMLSpanElement>(null);
  // Every generate/cancel/close/request-change bumps this; a response only counts if it still matches.
  const requestId = useRef(0);

  const secretValues = useMemo(() => collectSecretValues(parsedData), [parsedData]);
  const redactedCount = countRedactions(parsedData);
  const pojoDisabled = isPojoDisabled ?? isNonBodyMethod(parsedData.method);
  const detectedFormat = useMemo(() => detectDataFormat(parsedData), [parsedData]);
  const effectiveFormat = form.dataFormatOverride ?? detectedFormat;

  // Errors are derived from the fields in use right now, never stored (a hidden field cannot block Generate).
  const errors = validateForm(form, { pojoDisabled });
  const shownErrors = Object.fromEntries(
    Object.entries(errors).filter(([field]) => attempted || touched.has(field as FormField)),
  ) as Partial<Record<FormField, string>>;
  const errorCount = Object.keys(errors).length;

  const patchForm = (patch: Partial<CodeGenForm>, touchedField?: FormField) => {
    setForm((prev) => ({ ...prev, ...patch }));
    if (touchedField) setTouched((prev) => new Set(prev).add(touchedField));
    setError("");
  };

  // The result belongs to the request it was generated from. When the request is edited, drop the result
  // and any call still in flight; the config the user chose stays.
  const signature = useMemo(() => requestSignature(parsedData), [parsedData]);
  const lastSignature = useRef(signature);
  useEffect(() => {
    if (lastSignature.current === signature) return;
    lastSignature.current = signature;
    requestId.current++;
    setIsGenerating(false);
    setResult(null);
    setCurrentStep("config");
    setError("");
  }, [signature]);

  useEffect(() => () => void requestId.current++, []);

  // Move focus to the result area when generation completes so screen readers announce it
  useEffect(() => {
    if (currentStep === "result") resultHeadingRef.current?.focus();
  }, [currentStep]);

  // A failed generate is shown at the footer; make sure it is on screen.
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [error]);

  // After a failed submit, move focus to the first field that needs fixing (its section is opened first).
  useEffect(() => {
    if (!focusField) return;
    const el = document.getElementById(FIELD_IDS[focusField]);
    el?.scrollIntoView?.({ block: "center" });
    el?.focus();
    setFocusField(null);
  }, [focusField, advancedOpen]);

  const handleGenerateCodeWithConfig = async () => {
    setError("");
    const firstError = Object.keys(errors)[0] as FormField | undefined;
    if (firstError) {
      setAttempted(true);
      if (ADVANCED_FIELDS.some((f) => errors[f])) setAdvancedOpen(true);
      setFocusField(firstError);
      return;
    }

    const id = ++requestId.current;
    setIsGenerating(true);
    try {
      const config = buildGenerateConfig(form, { dataFormat: effectiveFormat, pojoDisabled });
      const response = await curlApi.generateFromParsed(parsedData, config);
      if (id !== requestId.current) return; // cancelled, closed or superseded: ignore the late result
      if (response.success) {
        setResult(readGenerateResponse(response, config));
        setCurrentStep("result");
      } else {
        setError("Failed to generate code: " + generationErrorMessage(response.error));
      }
    } catch (err: unknown) {
      if (id !== requestId.current) return;
      setError(err instanceof Error ? err.message : "Failed to generate code. Please try again.");
    } finally {
      if (id === requestId.current) setIsGenerating(false);
    }
  };

  /** Stop waiting for the response. The request itself finishes in the background; its result is dropped. */
  const cancelGeneration = () => {
    requestId.current++;
    setIsGenerating(false);
  };

  const handleBack = () => {
    setCurrentStep("config");
    setError("");
  };

  /**
   * Closing keeps the config and any generated result (they are dropped only if the request is edited), so Esc or a
   * stray click never throws work away. A call still in flight is cancelled.
   */
  const handleClose = () => {
    if (isGenerating) cancelGeneration();
    onOpenChange(false);
  };

  const selectOption = (option: "full" | "method") => patchForm({ option });
  const fieldClass = (field: FormField) => `font-mono ${shownErrors[field] ? "border-destructive" : ""}`;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="max-w-lg md:max-w-3xl lg:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {currentStep === "config" ? (
              "Code Generation Configuration"
            ) : (
              // tabIndex -1 allows programmatic focus without entering the tab order
              <span ref={resultHeadingRef} tabIndex={-1} className="outline-none">
                Generated Code
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Screen-reader live region */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {isGenerating
            ? "Generating code, please wait…"
            : currentStep === "result"
              ? "Code generation complete. Review the generated code below."
              : error
                ? `Error: ${error}`
                : ""}
        </div>

        {redactedCount > 0 && (
          <div
            role="alert"
            className="shrink-0 flex items-start gap-2 p-3 rounded-md border border-amber-500/40 bg-amber-500/10 text-sm text-amber-900 dark:text-amber-200"
          >
            <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <span>
              {redactedCount} secret value{redactedCount === 1 ? " was" : "s were"} redacted from this request and not
              re-entered. The generated code will contain <code className="font-mono">[REDACTED]</code> in their place.
            </span>
          </div>
        )}

        {currentStep === "config" ? (
          <>
            <div className="space-y-6 overflow-y-auto flex-1 min-h-0 pr-2">
              {/* Generation Type Selection */}
              <div className="space-y-3">
                <label className="text-sm font-medium">
                  Generation Type <span className="text-destructive">*</span>
                </label>

                <div className="space-y-2">
                  <label
                    htmlFor="option-full"
                    className="flex items-start gap-3 cursor-pointer p-3 rounded-md border hover:bg-accent transition-colors"
                  >
                    <input
                      id="option-full"
                      type="radio"
                      name="codeOption"
                      value="full"
                      checked={form.option === "full"}
                      onChange={() => selectOption("full")}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <span className="font-medium">Full Test Class</span>
                      <p className="text-xs text-muted-foreground mt-1">
                        Complete Java class with imports, @BeforeClass setup, and @Test method
                      </p>
                    </div>
                  </label>

                  <label
                    htmlFor="option-method"
                    className="flex items-start gap-3 cursor-pointer p-3 rounded-md border hover:bg-accent transition-colors"
                  >
                    <input
                      id="option-method"
                      type="radio"
                      name="codeOption"
                      value="method"
                      checked={form.option === "method"}
                      onChange={() => selectOption("method")}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <span className="font-medium">Test Method Only</span>
                      <p className="text-xs text-muted-foreground mt-1">Just the @Test method with required imports</p>
                    </div>
                  </label>
                </div>
                <FieldError id="option-error" message={shownErrors.option} />
              </div>

              {/* Configuration Options */}
              {form.option && (
                <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                  <h3 className="font-semibold text-sm">Configuration</h3>

                  {form.option === "full" && (
                    <div>
                      <label htmlFor="class-name" className="text-sm font-medium mb-2 block">
                        Test Class Name <span className="text-destructive">*</span>
                      </label>
                      <Input
                        id="class-name"
                        value={form.className}
                        onChange={(e) => patchForm({ className: e.target.value }, "className")}
                        placeholder="ApiTest"
                        className={fieldClass("className")}
                        aria-invalid={!!shownErrors.className}
                        aria-describedby={shownErrors.className ? "class-name-error" : undefined}
                      />
                      <FieldError id="class-name-error" message={shownErrors.className} />
                    </div>
                  )}

                  <div>
                    <label htmlFor="method-name" className="text-sm font-medium mb-2 block">
                      Method Name <span className="text-destructive">*</span>
                    </label>
                    <Input
                      id="method-name"
                      value={form.methodName}
                      onChange={(e) => patchForm({ methodName: e.target.value }, "methodName")}
                      placeholder="testApiRequest"
                      className={fieldClass("methodName")}
                      aria-invalid={!!shownErrors.methodName}
                      aria-describedby={shownErrors.methodName ? "method-name-error" : undefined}
                    />
                    <FieldError id="method-name-error" message={shownErrors.methodName} />
                  </div>

                  {/* POJO Generation */}
                  <div className={`space-y-3 p-3 border rounded-md ${pojoDisabled ? "opacity-60" : ""}`}>
                    <label className={`flex items-start gap-3 ${pojoDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
                      <Checkbox
                        checked={form.needPojo && !pojoDisabled}
                        disabled={pojoDisabled}
                        onCheckedChange={(checked) => patchForm({ needPojo: !!checked })}
                        className="mt-0.5"
                        aria-label="Generate POJO Classes"
                      />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">Generate POJO Classes</span>
                          {pojoDisabled && (
                            <Badge variant="secondary" className="text-xs">
                              Not available for GET/DELETE/HEAD
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Create Lombok-based POJOs with @Data and @Builder annotations
                        </p>
                      </div>
                    </label>

                    {form.needPojo && !pojoDisabled && (
                      <div className="pl-7 pt-2">
                        <label htmlFor="pojo-class-name" className="text-sm font-medium mb-2 block">
                          POJO Class Name <span className="text-destructive">*</span>
                        </label>
                        <Input
                          id="pojo-class-name"
                          value={form.pojoClassName}
                          onChange={(e) => patchForm({ pojoClassName: e.target.value }, "pojoClassName")}
                          placeholder="RequestBody"
                          className={fieldClass("pojoClassName")}
                          aria-invalid={!!shownErrors.pojoClassName}
                          aria-describedby={shownErrors.pojoClassName ? "pojo-class-name-error" : undefined}
                        />
                        <FieldError id="pojo-class-name-error" message={shownErrors.pojoClassName} />
                        <p className="text-xs text-muted-foreground mt-1">
                          Base name for your POJO classes (e.g., UserRequest, OrderDetails)
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Additional Options */}
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <Checkbox
                        checked={form.assertionRequired}
                        onCheckedChange={(checked) => patchForm({ assertionRequired: !!checked })}
                        className="mt-0.5"
                        aria-label="Include Assertions"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium">Include Assertions</span>
                        <p className="text-xs text-muted-foreground mt-1">Add TestNG assertions for response validation</p>
                      </div>
                    </label>

                    {form.assertionRequired && (
                      <div className="pl-7">
                        <label htmlFor="status-code" className="text-sm font-medium mb-2 block">
                          Expected Status Code
                        </label>
                        <Input
                          id="status-code"
                          type="number"
                          value={form.statusCode}
                          onChange={(e) => patchForm({ statusCode: e.target.value }, "statusCode")}
                          placeholder="200"
                          min="100"
                          max="599"
                          className={`w-32 ${shownErrors.statusCode ? "border-destructive" : ""}`}
                          aria-invalid={!!shownErrors.statusCode}
                          aria-describedby={shownErrors.statusCode ? "status-code-error" : undefined}
                        />
                        <FieldError id="status-code-error" message={shownErrors.statusCode} />
                      </div>
                    )}

                    <label className="flex items-start gap-3 cursor-pointer">
                      <Checkbox
                        checked={form.loggingRequired}
                        onCheckedChange={(checked) => patchForm({ loggingRequired: !!checked })}
                        className="mt-0.5"
                        aria-label="Include Logging"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium">Include Logging</span>
                        <p className="text-xs text-muted-foreground mt-1">Add console output for debugging</p>
                      </div>
                    </label>
                  </div>

                  <AdvancedSection
                    open={advancedOpen}
                    onOpenChange={setAdvancedOpen}
                    form={form}
                    onChange={patchForm}
                    errors={shownErrors}
                    detectedFormat={detectedFormat}
                    effectiveFormat={effectiveFormat}
                  />
                </div>
              )}
            </div>

            {/* Pinned footer: Generate stays visible however long the form is. */}
            <div className="shrink-0 border-t pt-4 space-y-3">
              {(error || (attempted && errorCount > 0)) && (
                <div
                  ref={errorRef}
                  role="alert"
                  className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm border border-destructive/30"
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <span>
                    {error ||
                      `Fix the ${errorCount} highlighted field${errorCount === 1 ? "" : "s"} above, then generate again.`}
                  </span>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                {isGenerating && (
                  <Button variant="outline" onClick={cancelGeneration}>
                    Stop waiting
                  </Button>
                )}
                <Button onClick={handleGenerateCodeWithConfig} disabled={!form.option || isGenerating} className="bg-primary">
                  {isGenerating ? "Generating..." : "Generate Code"}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            {result && <ResultPanel result={result} secretValues={secretValues} />}
            <div className="shrink-0 flex justify-between gap-2 pt-4 border-t">
              <Button variant="outline" onClick={handleBack}>
                ← Back to Config
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setFeedbackOpen(true)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Feedback
                </Button>
                <Button variant="outline" onClick={handleClose}>
                  Close
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>

      <FeedbackDialog
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        generatedCode={result?.testCode ?? ""}
        knownSecrets={secretValues}
      />
    </Dialog>
  );
}

export default memo(CodeGenerationDialogInner);
