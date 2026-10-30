import { memo, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ParsedCurl } from "@/types/curl";
import { listSecretFields, maskParsedCurl, redactParsedCurl } from "@/lib/utils/redaction";
import { RevealToggle } from "./editor/SecretValue";

interface ExportJsonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parsedData: ParsedCurl;
}

export const EXPORT_FILE_NAME = "parsed-curl-edited.json";

function ExportJsonDialog({ open, onOpenChange, parsedData }: ExportJsonDialogProps) {
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [redactDownload, setRedactDownload] = useState(false);

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
      setRedactDownload(false);
    }
    onOpenChange(next);
  };

  const handleDownload = () => {
    const data = redactDownload ? redactParsedCurl(parsedData) : parsedData;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = EXPORT_FILE_NAME;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Export JSON</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {secretFields.length > 0 && (
            <section aria-label="Secret values" className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                {secretFields.length} secret value{secretFields.length === 1 ? " is" : "s are"} hidden below. The
                downloaded file contains the real values unless you choose to redact them.
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
            {JSON.stringify(shown, null, 2)}
          </pre>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap pt-3 border-t">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={redactDownload}
              onCheckedChange={(checked) => setRedactDownload(checked === true)}
              aria-label="Redact secrets in the downloaded file"
            />
            Redact secrets in the downloaded file
          </label>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
            <Button onClick={handleDownload} className="gap-1.5">
              <Download className="w-4 h-4" />
              Download JSON
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default memo(ExportJsonDialog);
