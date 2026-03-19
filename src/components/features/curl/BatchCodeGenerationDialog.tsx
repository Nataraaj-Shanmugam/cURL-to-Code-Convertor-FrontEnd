import { memo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Copy, CheckCircle2, AlertCircle } from "lucide-react";
import { apiClient, GENERATE_TIMEOUT_MS } from "@/lib/api/apiClient";
import { ENV } from "@/lib/env";
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

function BatchCodeGenerationDialog({
  open,
  onOpenChange,
  items,
}: BatchCodeGenerationDialogProps) {
  const [step, setStep] = useState<"config" | "result">("config");
  const [className, setClassName] = useState("BatchApiTest");
  const [methodNames, setMethodNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((item) => [item.id, item.config.methodName]))
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [combinedCode, setCombinedCode] = useState("");
  const [combinedPom, setCombinedPom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"test" | "pom">("test");
  const [copied, setCopied] = useState(false);

  const handleGenerateAll = async () => {
    setError(null);
    setIsGenerating(true);
    setProgress(0);

    const results: string[] = [];
    let lastPom = "";

    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      const config = {
        ...item.config,
        option: "method",
        className,
        methodName: methodNames[item.id] ?? item.config.methodName,
      };

      try {
        const { data: result } = await apiClient.post(
          ENV.GENERATE_ENDPOINT,
          { parsed_data: item.parsed, config },
          { timeout: GENERATE_TIMEOUT_MS }
        );
        if (result.success && result.generated_code) {
          results.push(result.generated_code as string);
          if (result.pom_dependencies) lastPom = result.pom_dependencies as string;
        } else {
          const errMsg = typeof result.error === "object" ? (result.error as { message: string }).message : result.error ?? "Unknown error";
          results.push(`// Error generating code for: ${item.name}\n// ${errMsg}`);
        }
      } catch (e) {
        results.push(`// Error for: ${item.name}\n// ${e instanceof Error ? e.message : "Unknown error"}`);
      }

      setProgress(i + 1);
    }

    // Merge all methods into a single class
    const imports = new Set<string>();
    const methods: string[] = [];

    for (const code of results) {
      // Extract import lines
      const importLines = code
        .split("\n")
        .filter((l) => l.trimStart().startsWith("import "));
      importLines.forEach((l) => { if (l) imports.add(l.trim()); });

      // Extract method body (between @Test and next top-level declaration or end)
      const methodMatch = code.match(
        /(@Test[\s\S]*?(?=\n\s*@Test|\n\s*public\s+class|\n\s*@Before|\n\s*\/\*\*\s*\*\s*@|$))/
      );
      if (methodMatch && methodMatch[1]) {
        methods.push(methodMatch[1].trim());
      } else {
        // Fallback: include everything that looks like a method
        methods.push(code);
      }
    }

    const merged = `${Array.from(imports).join("\n")}

public class ${className} {

    @BeforeClass
    public void setUp() {
        RestAssured.useRelaxedHTTPSValidation();
    }

${methods.map((m) => "    " + m.replace(/\n/g, "\n    ")).join("\n\n")}
}`;

    setCombinedCode(merged);
    setCombinedPom(lastPom);
    setIsGenerating(false);
    setStep("result");
  };

  const handleCopy = async () => {
    const code = activeTab === "test" ? combinedCode : combinedPom;
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
              <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm border border-destructive/30">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">Test Class Name</label>
              <Input
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="BatchApiTest"
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Method Names</p>
              <div className="border rounded-md overflow-hidden max-h-64 overflow-y-auto">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-3 py-2 border-b last:border-0"
                  >
                    <Badge
                      className="shrink-0 text-[10px] font-mono"
                      variant="secondary"
                    >
                      {item.parsed.method?.toUpperCase() || "GET"}
                    </Badge>
                    <span className="text-xs text-muted-foreground truncate flex-1">
                      {item.name}
                    </span>
                    <Input
                      value={methodNames[item.id] || ""}
                      onChange={(e) =>
                        setMethodNames((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                      className="font-mono text-xs h-7 w-48 shrink-0"
                      placeholder="methodName"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleGenerateAll}
                disabled={isGenerating || !className.trim()}
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
                      Copied!
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
