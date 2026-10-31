import { memo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RevealToggleProps {
  /** What is being revealed, e.g. "Authorization" -> "Reveal value of Authorization". */
  label: string;
  revealed: boolean;
  onToggle: () => void;
  className?: string;
}

/** Eye button for a masked secret. The label stays fixed; `aria-pressed` carries the state. */
export function RevealToggle({ label, revealed, onToggle, className }: RevealToggleProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-6 w-6 shrink-0", className)}
      aria-label={`Reveal value of ${label}`}
      aria-pressed={revealed}
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
  const hasSecret = maskedText !== text;
  const Tag = as;
  return (
    <div className="flex items-start gap-2">
      <Tag className={cn("flex-1 min-w-0", className)}>{hasSecret && !revealed ? maskedText : text}</Tag>
      {hasSecret && <RevealToggle label={label} revealed={revealed} onToggle={() => setRevealed((r) => !r)} />}
    </div>
  );
}

export const MaskedText = memo(MaskedTextImpl);
