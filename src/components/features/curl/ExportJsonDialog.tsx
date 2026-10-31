import { memo, useId, useMemo, useRef, useState } from "react";
import { Download, ShieldCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ParsedCurl } from "@/types/curl";
import { listSecretFields, maskParsedCurl, redactParsedCurl } from "@/lib/utils/redaction";
import { MaskedString, RevealToggle } from "./editor/SecretValue";

interface ExportJsonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parsedData: ParsedCurl;
}

export const EXPORT_FILE_NAME = "parsed-curl-edited.json";
export const EXPORT_REDACTED_FILE_NAME = "parsed-curl-edited.redacted.json";

function ExportJsonDialog({ open, onOpenChange, parsedData }: ExportJsonDialogProps) {
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  // Safe by default: the file is redacted unless the user asks for the real values.
  const [redactDownload, setRedactDownload] = useState(true);
  const redactToggleRef = useRef<HTMLButtonElement>(null);
  const redactId = useId();
  const fileName = redactDownload ? EXPORT_REDACTED_FILE_NAME : EXPORT_FILE_NAME;

  const secretFields = useMemo(() => listSecretFields(parsedData), [parsedData]);
  const shown = useMemo(() => maskParsedCurl(parsedData, revealed), [parsedData, revealed]);

  const toggle = (id: string) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setRevealed(new Set());
      setRedactDownload(true);
    }
    onOpenChange(next);
  };

  const handleDownload = () => {
    const data = redactDownload ? redactParsedCurl(parsedData) : parsedData;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
        onOpenAutoFocus={(event) => {
          // Start on the one decision this dialog asks for, not on the first eye button.
          event.preventDefault();
          redactToggleRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Export JSON</DialogTitle>
          <DialogDescription>Download the parsed request, as edited, as a JSON file.</DialogDescription>
        </DialogHeader>

        <div
          className={`flex items-start gap-3 rounded-lg border p-3 ${
            redactDownload ? "border-border bg-muted/40" : "border-amber-500/50 bg-amber-500/10"
          }`}
        >
          <Checkbox
            id={redactId}
            ref={redactToggleRef}
            checked={redactDownload}
            onCheckedChange={(checked) => setRedactDownload(checked === true)}
            aria-label="Redact secrets in the downloaded file"
            aria-describedby={`${redactId}-hint`}
            className="mt-0.5"
          />
          <div className="space-y-0.5">
            <label htmlFor={redactId} className="flex items-center gap-1.5 text-sm font-semibold">
              {redactDownload ? (
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-amber-600" aria-hidden="true" />
              )}
              Redact secrets in the downloaded file
            </label>
            <p id={`${redactId}-hint`} className="text-xs text-muted-foreground">
              {redactDownload
                ? "Recommended. Tokens, keys, passwords and cookies are replaced with [REDACTED]."
                : "The file will contain the real secret values. Keep it somewhere safe."}{" "}
              File: <span className="font-mono">{fileName}</span>
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {secretFields.length > 0 && (
            <section aria-label="Secret values" className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                {secretFields.length} secret value{secretFields.length === 1 ? " is" : "s are"} hidden below.
              </p>
              <ul className="space-y-1">
                {secretFields.map((field) => (
                  <li key={field.id} className="flex items-center gap-2 text-xs font-mono">
                    <RevealToggle
                      label={field.label}
                      revealed={revealed.has(field.id)}
                      onToggle={() => toggle(field.id)}
                    />
                    <span className="break-all">{field.label}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <pre
            className="text-xs font-mono bg-slate-950 text-slate-50 p-4 rounded-md overflow-auto max-h-80 whitespace-pre-wrap break-all"
          >
            <MaskedString text={JSON.stringify(shown, null, 2)} />
          </pre>
        </div>

        <div className="flex items-center justify-end gap-3 flex-wrap pt-3 border-t">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
            <Button onClick={handleDownload} className="gap-1.5">
              <Download className="w-4 h-4" aria-hidden="true" />
              Download JSON
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default memo(ExportJsonDialog);
