import { memo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, CheckCircle2 } from "lucide-react";
import type { ParsedCurl } from "@/types/curl";
import { buildFullUrl } from "@/lib/utils/urlBuilder";
import { reconstructCurl } from "@/lib/utils/curlReconstructor";

interface RequestPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parsedData: ParsedCurl;
}

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  POST: "bg-green-500/15 text-green-600 dark:text-green-400",
  PUT: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  PATCH: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  DELETE: "bg-red-500/15 text-red-600 dark:text-red-400",
  HEAD: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  OPTIONS: "bg-gray-500/15 text-gray-600 dark:text-gray-400",
};

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="text-xs font-mono bg-slate-950 text-slate-50 p-4 rounded-md overflow-auto max-h-60 whitespace-pre-wrap break-all">
      {code}
    </pre>
  );
}

function RequestPreviewDialog({ open, onOpenChange, parsedData }: RequestPreviewDialogProps) {
  const [copied, setCopied] = useState(false);
  const [openSections, setOpenSections] = useState<string[]>(["headers"]);

  const method = (parsedData.method || "GET").toUpperCase();
  const fullUrl = buildFullUrl(parsedData);
  const reconstructed = reconstructCurl(parsedData);

  const hasHeaders = parsedData.headers && Object.keys(parsedData.headers).length > 0;
  const hasCookies = parsedData.cookies && Object.keys(parsedData.cookies).length > 0;
  const hasBody =
    !!parsedData.data ||
    (parsedData.form_data && Object.keys(parsedData.form_data).length > 0);

  const bodyStr = parsedData.data
    ? typeof parsedData.data === "object"
      ? JSON.stringify(parsedData.data, null, 2)
      : String(parsedData.data)
    : parsedData.form_data
    ? JSON.stringify(parsedData.form_data, null, 2)
    : "";

  const handleCopyCurl = async () => {
    try {
      await navigator.clipboard.writeText(reconstructed);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Request Preview</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Method + URL bar */}
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/40">
            <span
              className={`px-2.5 py-1 rounded text-xs font-bold font-mono shrink-0 ${
                METHOD_COLORS[method] ?? "bg-gray-500/15 text-gray-600"
              }`}
            >
              {method}
            </span>
            {fullUrl ? (
              <span className="font-mono text-sm break-all text-foreground">
                {fullUrl}
              </span>
            ) : (
              <span className="font-mono text-sm text-muted-foreground italic">
                No URL
              </span>
            )}
          </div>

          {/* Collapsible sections */}
          <Accordion
            type="multiple"
            value={openSections}
            onValueChange={setOpenSections}
            className="space-y-2"
          >
            {/* Headers */}
            {hasHeaders && (
              <AccordionItem value="headers">
                <AccordionTrigger className="px-3 py-2 text-sm font-medium">
                  <div className="flex items-center gap-2">
                    Headers
                    <Badge variant="secondary" className="text-xs">
                      {Object.keys(parsedData.headers!).length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="px-3 pb-3 space-y-1.5">
                    {Object.entries(parsedData.headers!).map(([k, v]) => (
                      <div key={k} className="flex gap-2 text-xs font-mono">
                        <span className="text-muted-foreground shrink-0">{k}:</span>
                        <span className="break-all">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Cookies */}
            {hasCookies && (
              <AccordionItem value="cookies">
                <AccordionTrigger className="px-3 py-2 text-sm font-medium">
                  <div className="flex items-center gap-2">
                    Cookies
                    <Badge variant="secondary" className="text-xs">
                      {Object.keys(parsedData.cookies!).length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="px-3 pb-3 space-y-1.5">
                    {Object.entries(parsedData.cookies!).map(([k, v]) => (
                      <div key={k} className="flex gap-2 text-xs font-mono">
                        <span className="text-muted-foreground shrink-0">{k}=</span>
                        <span className="break-all">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Request Body */}
            {hasBody && (
              <AccordionItem value="body">
                <AccordionTrigger className="px-3 py-2 text-sm font-medium">
                  Request Body
                </AccordionTrigger>
                <AccordionContent>
                  <div className="px-3 pb-3">
                    <CodeBlock code={bodyStr} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Reconstructed cURL */}
            <AccordionItem value="curl">
              <AccordionTrigger className="px-3 py-2 text-sm font-medium">
                Reconstructed cURL
              </AccordionTrigger>
              <AccordionContent>
                <div className="px-3 pb-3 space-y-2">
                  <CodeBlock code={reconstructed} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyCurl}
                    className="gap-2"
                  >
                    {copied ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy cURL
                      </>
                    )}
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Empty state */}
          {!hasHeaders && !hasCookies && !hasBody && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No headers, cookies, or body to preview.
            </p>
          )}
        </div>

        <div className="flex justify-end pt-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default memo(RequestPreviewDialog);
