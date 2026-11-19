import { useId, useState } from "react";
import { ChevronRight, Copy, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MaskedText } from "./SecretValue";

/** The saved-copy note shown under the header (single-request editor only). */
export interface PersistenceNote {
  state: "saved" | "cleared";
  onClear: () => void;
}

interface OriginalRequestHeaderProps {
  originalCurl?: string;
  /** The original already carried redaction placeholders when it was saved. */
  originalCurlRedacted: boolean;
  /** The original contains secrets (so Copy gives the redacted form). */
  originalHasSecret: boolean;
  maskedOriginal: string;
  persistence?: PersistenceNote;
  onCopy: () => void;
}

/**
 * One compact header above the editor: the original cURL (collapsed until asked for) and, under
 * it, the one-line note about the saved copy with its Clear action. It replaces a banner plus a
 * card that together pushed the editor down by ~200px.
 */
export default function OriginalRequestHeader({
  originalCurl,
  originalCurlRedacted,
  originalHasSecret,
  maskedOriginal,
  persistence,
  onCopy,
}: OriginalRequestHeaderProps) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  if (!originalCurl && !persistence) return null;

  return (
    <section aria-label="Original request" className="rounded-lg border bg-muted/30 text-sm">
      {originalCurl && (
        <>
          <div className="flex items-center gap-2 px-2 py-1">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={bodyId}
              onClick={() => setOpen((o) => !o)}
              className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:min-h-10"
            >
              <ChevronRight
                aria-hidden="true"
                className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-90")}
              />
              <span className="truncate">
                Original cURL Command
                {originalCurlRedacted && <span className="ml-2 text-xs font-normal">(secrets redacted when saved)</span>}
              </span>
            </button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5"
              // The name starts with the visible text ("Copy redacted") so voice control and screen readers agree with the eye.
              aria-label={originalHasSecret ? "Copy redacted original cURL command" : "Copy original cURL command"}
              onClick={onCopy}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              {originalHasSecret ? "Copy redacted" : "Copy"}
            </Button>
          </div>
          {open && (
            <div id={bodyId} className="px-3 pb-3">
              <MaskedText
                label="original cURL command"
                text={originalCurl}
                maskedText={maskedOriginal}
                scrollable
                className="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded border border-border bg-background p-3 font-mono text-xs"
              />
            </div>
          )}
        </>
      )}
      {persistence && (
        <div
          role="status"
          className={cn(
            "flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs text-muted-foreground",
            originalCurl && "border-t",
          )}
        >
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            {persistence.state === "saved"
              ? "A copy of this request, with secrets redacted, is kept for this browser session so a reload can restore it (re-enter the secrets)."
              : "Saved copy cleared. Reloading this page will not restore this request."}
          </span>
          {persistence.state === "saved" && (
            <Button variant="outline" size="sm" className="h-7" onClick={persistence.onClear}>
              Clear saved request
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
