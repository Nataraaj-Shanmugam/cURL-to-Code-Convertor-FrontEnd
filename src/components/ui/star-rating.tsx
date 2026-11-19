import * as React from "react";
import { Star } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

export interface StarRatingProps {
  /** 0 means no rating yet. */
  value: number;
  onChange: (value: number) => void;
  /** Word for each rating, index 1..max (index 0 unused). Used in the accessible names. */
  labels: readonly string[];
  max?: number;
  "aria-label"?: string;
  className?: string;
}

/**
 * Star rating as a radio group: one tab stop, Arrow/Home/End move the selection. Empty stars are a
 * solid outline (>= 3:1 against the background); filled stars keep an outline too, so state never
 * depends on the fill colour alone.
 */
function StarRating({ value, onChange, labels, max = 5, className, "aria-label": ariaLabel = "Rating" }: StarRatingProps) {
  const [hovered, setHovered] = React.useState(0);
  const shown = hovered || value;
  return (
    <RadioGroup
      value={value > 0 ? String(value) : ""}
      onValueChange={(next) => onChange(Number(next))}
      aria-label={ariaLabel}
      className={cn("flex gap-1", className)}
      onMouseLeave={() => setHovered(0)}
    >
      {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
        <RadioGroupItem
          key={star}
          value={String(star)}
          aria-label={`${labels[star]} — ${star} out of ${max}`}
          onMouseEnter={() => setHovered(star)}
          className="rounded p-1 transition-transform hover:scale-110 pointer-coarse:p-2"
        >
          <Star
            aria-hidden="true"
            className={cn(
              "h-8 w-8 transition-colors",
              star <= shown
                ? "fill-amber-400 text-amber-600 dark:text-amber-400"
                : "fill-transparent text-muted-foreground",
            )}
          />
        </RadioGroupItem>
      ))}
    </RadioGroup>
  );
}

export { StarRating };
