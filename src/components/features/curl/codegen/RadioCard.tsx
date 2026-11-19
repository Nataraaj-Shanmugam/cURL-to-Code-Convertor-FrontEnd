import type { ReactNode } from "react";
import { RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

interface RadioCardProps {
  /** DOM id of the radio itself (also what a failed submit focuses). */
  id: string;
  value: string;
  selected: boolean;
  title: ReactNode;
  children?: ReactNode;
}

/**
 * One option of a themed RadioGroup, drawn as a card. The radio's name is the title; the
 * description text is its accessible description. Must sit inside a <RadioGroup>.
 */
export default function RadioCard({ id, value, selected, title, children }: RadioCardProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors",
        selected ? "border-primary bg-primary/5" : "hover:bg-accent",
      )}
    >
      <RadioGroupItem value={value} id={id} aria-labelledby={`${id}-title`} aria-describedby={`${id}-desc`} className="mt-1" />
      <div className="flex-1">
        <span id={`${id}-title`} className="text-sm font-medium">
          {title}
        </span>
        <div id={`${id}-desc`} className="space-y-0.5 text-xs text-muted-foreground">
          {children}
        </div>
      </div>
    </label>
  );
}
