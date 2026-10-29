import { memo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy, CheckCircle2 } from "lucide-react";
import type { ParsedCurl } from "@/types/curl";
import { buildFullUrl } from "@/lib/utils/urlBuilder";
import { reconstructCurl } from "@/lib/utils/curlReconstructor";
import { MASK, redactFieldValue, redactParsedCurl, redactText } from "@/lib/utils/redaction";
import { MaskedText, RevealToggle } from "./editor/SecretValue";

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

/** One `name: value` row whose value is masked until its own reveal toggle is pressed. */
function SecretRow({ name, separator, path, value }: { name: string; separator: string; path: string; value: unknown }) {
  const [revealed, setRevealed] = useState(false);
  const masked = String(redactFieldValue(path, value, { placeholder: MASK }));
  const text = String(value);
  const hasSecret = masked !== text;
  return (
    <div className="flex items-start gap-2 text-xs font-mono">
      <span className="text-muted-foreground shrink-0">{name}{separator}</span>
      <span className="break-all flex-1 min-w-0">{hasSecret && !revealed ? masked : text}</span>
      {hasSecret && <RevealToggle label={name} revealed={revealed} onToggle={() => setRevealed((r) => !r)} />}
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="text-xs font-mono bg-slate-950 text-slate-50 p-4 rounded-md overflow-auto max-h-60 whitespace-pre-wrap break-all">
      {code}
    </pre>
  );
}

function PreviewCode({ label, code, maskedCode }: { label: string; code: string; maskedCode: string }) {
  const [revealed, setRevealed] = useState(false);
  const hasSecret = code !== maskedCode;
  return (
    <div className="space-y-1.5">
      {hasSecret && (
        <div className="flex justify-end">
          <RevealToggle label={label} revealed={revealed} onToggle={() => setRevealed((r) => !r)} />
        </div>
      )}
      <CodeBlock code={hasSecret && !revealed ? maskedCode : code} />
    </div>
  );
}

function RequestPreviewDialog({ open, onOpenChange, parsedData }: RequestPreviewDialogProps) {
  const [copied, setCopied] = useState(false);
  const [openSections, setOpenSections] = useState<string[]>(["headers"]);
  const [redactCopy, setRedactCopy] = useState(false);

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

  // On screen, secrets are masked (each block has its own reveal toggle). Copy is unchanged unless asked.
  const maskedParsed = redactParsedCurl(parsedData, { placeholder: MASK });
  const maskedUrl = redactText(fullUrl, { placeholder: MASK });
  const maskedReconstructed = reconstructCurl(maskedParsed);
  const maskedBodyStr = maskedParsed.data
    ? typeof maskedParsed.data === "object"
      ? JSON.stringify(maskedParsed.data, null, 2)
      : String(maskedParsed.data)
    : maskedParsed.form_data
    ? JSON.stringify(maskedParsed.form_data, null, 2)
    : "";

  const handleCopyCurl = async () => {
    try {
      await navigator.clipboard.writeText(
        redactCopy ? reconstructCurl(redactParsedCurl(parsedData)) : reconstructed,
      );
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
              <MaskedText
                label="request URL"
                text={fullUrl}
                maskedText={maskedUrl}
                as="span"
                className="font-mono text-sm break-all text-foreground"
              />
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
                      <SecretRow key={k} name={k} separator=":" path={`headers.${k}`} value={v} />
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
                      <SecretRow key={k} name={k} separator="=" path={`cookies.${k}`} value={v} />
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
                    <PreviewCode label="request body" code={bodyStr} maskedCode={maskedBodyStr} />
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
                  <PreviewCode label="reconstructed cURL" code={reconstructed} maskedCode={maskedReconstructed} />
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox
                      checked={redactCopy}
                      onCheckedChange={(checked) => setRedactCopy(checked === true)}
                      aria-label="Redact secrets when copying"
                    />
                    Redact secrets when copying
                  </label>
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
