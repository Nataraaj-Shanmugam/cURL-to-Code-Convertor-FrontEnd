import * as React from "react";
import { METHOD_COLORS, METHOD_COLOR_FALLBACK } from "@/constants/curl";
import { cn } from "@/lib/utils";

export interface MethodBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** HTTP method; matched case-insensitively. Anything unknown gets the neutral colour. */
  method: string;
}

/** The only place HTTP-method colours and badge sizing are decided. */
function MethodBadge({ method, className, ...props }: MethodBadgeProps) {
  const key = method.trim().toUpperCase();
  return (
    <span
      data-method={key}
      className={cn(
        "inline-flex items-center justify-center rounded px-2 py-0.5 font-mono text-[11px] font-bold leading-4",
        METHOD_COLORS[key] ?? METHOD_COLOR_FALLBACK,
        className,
      )}
      {...props}
    >
      {key}
    </span>
  );
}

export { MethodBadge };
