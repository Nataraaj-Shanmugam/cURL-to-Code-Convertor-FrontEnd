import { memo, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Copy, CheckCircle2, AlertCircle } from "lucide-react";
import { apiClient, GENERATE_TIMEOUT_MS } from "@/lib/api/apiClient";
import { ENV } from "@/lib/env";
import { isInsecureCurl, withRelaxedHttps } from "@/lib/utils/insecureFlag";
import { collectSecretValues, redactText } from "@/lib/utils/redaction";
import {
  defaultStatusForMethod,
  javaIdentifierError,
  statusCodeError,
} from "@/lib/utils/codegenValidation";
import { deriveMethodName, uniqueName } from "@/lib/hooks/useBatchEditor";
import type { BatchItem } from "@/types/batch";

interface BatchCodeGenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: BatchItem[];
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="text-sm font-mono bg-slate-950 text-slate-50 p-4 rounded-lg overflow-x-auto max-h-[50vh] whitespace-pre-wrap break-all">
      {code}
    </pre>
  );
}

interface GenerationFailure {
  name: string;
  message: string;
}

/**
 * Suggests one unique method name per request from its *current* method and endpoint, so an edited
 * request is not named after what it used to be. Names the user types are kept in state instead.
 */
function suggestMethodNames(items: BatchItem[]): Record<string, string> {
  const taken = new Set<string>();
  const names: Record<string, string> = {};
  items.forEach((item, index) => {
    const name = uniqueName(deriveMethodName(item.parsed, index), taken);
    taken.add(name);
    names[item.id] = name;
  });
  return names;
}

function FailureList({ failures }: { failures: GenerationFailure[] }) {
  if (failures.length === 0) return null;
  return (
    <ul className="space-y-0.5 text-xs">
      {failures.map((failure, i) => (
        <li key={i}>
          <span className="font-semibold">{failure.name}:</span> {failure.message}
        </li>
      ))}
    </ul>
  );
}

function BatchCodeGenerationDialog({
  open,
  onOpenChange,
  items,
}: BatchCodeGenerationDialogProps) {
  const [step, setStep] = useState<"config" | "result">("config");
  const [className, setClassName] = useState("BatchApiTest");
  const [methodNames, setMethodNames] = useState<Record<string, string>>(() =>
    suggestMethodNames(items)
  );
  // Only statuses the user typed are stored; the rest follow each request's (possibly edited) method.
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [failures, setFailures] = useState<GenerationFailure[]>([]);
  const [redactOutput, setRedactOutput] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [combinedCode, setCombinedCode] = useState("");
  const [combinedPom, setCombinedPom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"test" | "pom">("test");
  const [copied, setCopied] = useState(false);

  const statusFor = (item: BatchItem) =>
    statusOverrides[item.id] ?? defaultStatusForMethod(item.parsed.method);

  // Every name must compile: a Java identifier, and no two methods in the class may share one.
  const classNameError = javaIdentifierError(className);
  const rowErrors = useMemo(() => {
    const seen = new Set<string>();
    return Object.fromEntries(
      items.map((item) => {
        const name = (methodNames[item.id] ?? "").trim();
        let method = javaIdentifierError(name);
        if (!method && seen.has(name)) method = "Already used by another request";
        if (!method) seen.add(name);
        const status = statusCodeError(statusOverrides[item.id] ?? defaultStatusForMethod(item.parsed.method));
        return [item.id, { method, status }] as const;
      })
    );
  }, [items, methodNames, statusOverrides]);
  const hasErrors =
    !!classNameError || items.some((item) => rowErrors[item.id]?.method || rowErrors[item.id]?.status);

  // Secrets of every request in the batch, so values that no pattern recognises are still masked.
  const secretValues = useMemo(
    () => Array.from(new Set(items.flatMap((item) => collectSecretValues(item.parsed)))),
    [items]
  );

  const handleGenerateAll = async () => {
    if (hasErrors) return;
    setError(null);
    setFailures([]);
    setIsGenerating(true);
    setProgress(0);
    const failed: GenerationFailure[] = [];

    // `insecure` records, per request, whether its cURL used -k/--insecure.
    const results: { code: string; insecure: boolean }[] = [];
    let lastPom = "";

    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      const config = {
        ...item.config,
        option: "method",
        className: className.trim(),
        methodName: (methodNames[item.id] ?? "").trim(),
        statusCode: statusFor(item).trim(),
      };

      try {
        const { data: result } = await apiClient.post(
          ENV.GENERATE_ENDPOINT,
          { parsed_data: item.parsed, config },
          { timeout: GENERATE_TIMEOUT_MS }
        );
        if (result.success && result.generated_code) {
          results.push({
            code: result.generated_code as string,
            insecure: isInsecureCurl(item.parsed),
          });
          if (result.pom_dependencies) lastPom = result.pom_dependencies as string;
        } else {
          const errMsg = typeof result.error === "object" && result.error !== null ? (result.error as { message: string }).message : result.error ?? "Unknown error";
          failed.push({ name: item.name, message: String(errMsg) });
          results.push({
            code: `// Error generating code for: ${item.name}\n// ${errMsg}`,
            insecure: false,
          });
        }
      } catch (e) {
        failed.push({ name: item.name, message: e instanceof Error ? e.message : "Unknown error" });
        results.push({
          code: `// Error for: ${item.name}\n// ${e instanceof Error ? e.message : "Unknown error"}`,
          insecure: false,
        });
      }

      setProgress(i + 1);
    }

    setIsGenerating(false);
    setFailures(failed);
    if (failed.length === items.length) {
      // Nothing was generated: stay on the config step instead of presenting error comments as code.
      setError(
        items.length === 1
          ? "Code generation failed."
          : `Code generation failed for all ${items.length} requests.`
      );
      return;
    }

    // Merge all methods into a single class
    const imports = new Set<string>();
    const methods: string[] = [];

    for (const { code, insecure } of results) {
      // Extract import lines
      const importLines = code
        .split("\n")
        .filter((l) => l.trimStart().startsWith("import "));
      importLines.forEach((l) => { if (l) imports.add(l.trim()); });

      // Extract method body (between @Test and next top-level declaration or end)
      const methodMatch = code.match(
        /(@Test[\s\S]*?(?=\n\s*@Test|\n\s*public\s+class|\n\s*@Before|\n\s*\/\*\*\s*\*\s*@|$))/
      );
      const method = methodMatch && methodMatch[1] ? methodMatch[1].trim() : code;
      // Relax TLS validation per request: RestAssured.useRelaxedHTTPSValidation() is global static
      // state and would relax every other request in the class too.
      methods.push(insecure ? withRelaxedHttps(method) : method);
    }

    const merged = `${Array.from(imports).join("\n")}

public class ${className.trim()} {

${methods.map((m) => "    " + m.replace(/\n/g, "\n    ")).join("\n\n")}
}`;

    setCombinedCode(merged);
    setCombinedPom(lastPom);
    setStep("result");
  };

  const handleCopy = async () => {
    const shown = activeTab === "test" ? combinedCode : combinedPom;
    const code = redactOutput ? redactText(shown, { knownSecrets: secretValues }) : shown;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setStep("config");
    setCombinedCode("");
    setCombinedPom("");
    setError(null);
    setFailures([]);
    setProgress(0);
    setActiveTab("test");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === "config"
              ? `Generate Code for ${items.length} Request${items.length !== 1 ? "s" : ""}`
              : "Generated Batch Code"}
          </DialogTitle>
        </DialogHeader>

        {step === "config" ? (
          <div className="flex-1 overflow-y-auto space-y-4">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm border border-destructive/30">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{error}</p>
                  <FailureList failures={failures} />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="batch-class-name" className="text-sm font-medium mb-2 block">
                Test Class Name
              </label>
              <Input
                id="batch-class-name"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="BatchApiTest"
                className="font-mono"
                aria-invalid={classNameError ? true : undefined}
                aria-describedby={classNameError ? "batch-class-name-error" : undefined}
              />
              {classNameError && (
                <p id="batch-class-name-error" className="text-xs text-destructive mt-1">
                  {classNameError}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Methods and expected status</p>
              <div className="border rounded-md overflow-hidden max-h-64 overflow-y-auto">
                {items.map((item) => {
                  const errors = rowErrors[item.id];
                  return (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-start gap-x-3 gap-y-1 px-3 py-2 border-b last:border-0"
                    >
                      <Badge className="shrink-0 text-[10px] font-mono mt-1" variant="secondary">
                        {item.parsed.method?.toUpperCase() || "GET"}
                      </Badge>
                      <span className="text-xs text-muted-foreground truncate flex-1 min-w-[8rem] mt-1.5">
                        {item.name}
                      </span>
                      <div className="w-full sm:w-48 shrink-0">
                        <Input
                          value={methodNames[item.id] ?? ""}
                          onChange={(e) =>
                            setMethodNames((prev) => ({ ...prev, [item.id]: e.target.value }))
                          }
                          className="font-mono text-xs h-7"
                          placeholder="methodName"
                          aria-label={`Method name for ${item.name}`}
                          aria-invalid={errors?.method ? true : undefined}
                          aria-describedby={errors?.method ? `method-error-${item.id}` : undefined}
                        />
                        {errors?.method && (
                          <p id={`method-error-${item.id}`} className="text-xs text-destructive mt-1">
                            {errors.method}
                          </p>
                        )}
                      </div>
                      <div className="w-24 shrink-0">
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={100}
                          max={599}
                          value={statusFor(item)}
                          onChange={(e) =>
                            setStatusOverrides((prev) => ({ ...prev, [item.id]: e.target.value }))
                          }
                          className="font-mono text-xs h-7"
                          placeholder="200"
                          aria-label={`Expected status for ${item.name}`}
                          aria-invalid={errors?.status ? true : undefined}
                          aria-describedby={errors?.status ? `status-error-${item.id}` : undefined}
                        />
                        {errors?.status && (
                          <p id={`status-error-${item.id}`} className="text-xs text-destructive mt-1">
                            {errors.status}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleGenerateAll}
                disabled={isGenerating || hasErrors}
                className="gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating... ({progress}/{items.length})
                  </>
                ) : (
                  "Generate All"
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col">
            {failures.length > 0 && (
              <div
                role="alert"
                className="flex items-start gap-2 p-3 mb-3 bg-destructive/10 text-destructive rounded-md text-sm border border-destructive/30"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">
                    Code could not be generated for {failures.length} of {items.length} requests.
                    They appear below as comments and have no test method.
                  </p>
                  <FailureList failures={failures} />
                </div>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm mb-3 cursor-pointer">
              <Checkbox
                checked={redactOutput}
                onCheckedChange={(checked) => setRedactOutput(checked === true)}
                aria-label="Redact secrets when copying"
              />
              Redact secrets when copying
              <span className="text-xs text-muted-foreground">
                (the code shown below is not masked)
              </span>
            </label>
            <Tabs
              value={activeTab}
              onValueChange={(v: string) => setActiveTab(v as "test" | "pom")}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between mb-3">
                <TabsList>
                  <TabsTrigger value="test">Combined Test Class</TabsTrigger>
                  {combinedPom && (
                    <TabsTrigger value="pom">pom.xml</TabsTrigger>
                  )}
                </TabsList>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="gap-2"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>

              <TabsContent value="test" className="flex-1 overflow-auto mt-0">
                <CodeBlock code={combinedCode} />
              </TabsContent>
              {combinedPom && (
                <TabsContent value="pom" className="flex-1 overflow-auto mt-0">
                  <CodeBlock code={combinedPom} />
                </TabsContent>
              )}
            </Tabs>

            <div className="flex justify-between pt-3 border-t mt-3">
              <Button variant="outline" onClick={() => setStep("config")}>
                Back to Config
              </Button>
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default memo(BatchCodeGenerationDialog);
