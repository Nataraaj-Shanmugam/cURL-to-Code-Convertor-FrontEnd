import { Fragment, memo, useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MASK } from "@/lib/utils/redaction";

/** What a screen reader announces in place of a mask (instead of "bullet bullet bullet ..."). */
export const MASK_SR_LABEL = "hidden value";

/**
 * Renders text that may contain MASK: each mask is drawn as bullets hidden from assistive tech, with
 * a visually hidden "hidden value" read in its place.
 */
export function MaskedString({ text }: { text: string }) {
  if (!text.includes(MASK)) return <>{text}</>;
  const parts = text.split(MASK);
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {i < parts.length - 1 && (
            <>
              <span aria-hidden="true">{MASK}</span>
              <span className="sr-only">{MASK_SR_LABEL}</span>
            </>
          )}
        </Fragment>
      ))}
    </>
  );
}

interface RevealToggleProps {
  /** What is being revealed, e.g. "Authorization" -> "Reveal value of Authorization". */
  label: string;
  revealed: boolean;
  onToggle: () => void;
  className?: string;
  /** Id of the element whose text this toggle reveals. */
  controls?: string;
}

/** Eye button for a masked secret. The label stays fixed; `aria-pressed` carries the state. */
export function RevealToggle({ label, revealed, onToggle, className, controls }: RevealToggleProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-6 w-6 shrink-0", className)}
      aria-label={`Reveal value of ${label}`}
      aria-pressed={revealed}
      aria-controls={controls}
      title={revealed ? `Hide value of ${label}` : `Reveal value of ${label}`}
      onClick={onToggle}
    >
      {revealed ? <EyeOff className="h-3 w-3" aria-hidden="true" /> : <Eye className="h-3 w-3" aria-hidden="true" />}
    </Button>
  );
}

interface MaskedTextProps {
  label: string;
  /** The real text. Only rendered while revealed. */
  text: string;
  /** What to show while hidden. When equal to `text` there is nothing to hide and no toggle is drawn. */
  maskedText: string;
  as?: "pre" | "span";
  className?: string;
}

/** A block of text with secrets masked and one reveal toggle for the whole block. */
function MaskedTextImpl({ label, text, maskedText, as = "pre", className }: MaskedTextProps) {
  const [revealed, setRevealed] = useState(false);
  const id = useId();
  const hasSecret = maskedText !== text;
  const Tag = as;
  return (
    <div className="flex items-start gap-2">
      <Tag id={id} className={cn("flex-1 min-w-0", className)}>
        {hasSecret && !revealed ? <MaskedString text={maskedText} /> : text}
      </Tag>
      {hasSecret && (
        <RevealToggle label={label} revealed={revealed} onToggle={() => setRevealed((r) => !r)} controls={id} />
      )}
    </div>
  );
}

export const MaskedText = memo(MaskedTextImpl);
