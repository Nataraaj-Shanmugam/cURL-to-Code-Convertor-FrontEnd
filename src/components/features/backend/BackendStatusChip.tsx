import { RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBackendStatus, type BackendStatus } from "@/contexts/BackendStatusContext";

const LABELS: Record<BackendStatus, string> = {
  checking: "Checking generator",
  waking: "Generator waking up",
  ready: "Generator ready",
  unavailable: "Generator unavailable",
};

const DOT: Record<BackendStatus, string> = {
  checking: "bg-muted-foreground",
  // Pulses only for people who haven't asked for reduced motion.
  waking: "bg-warning motion-safe:animate-pulse",
  ready: "bg-success",
  unavailable: "bg-destructive",
};

interface Props {
  /** Dot only (label kept for screen readers and as a tooltip); for tight spaces like the mobile bar. */
  compact?: boolean;
  className?: string;
  "data-testid"?: string;
}

/** Small pill showing whether the backend is awake. When unavailable it becomes a Retry button. */
export default function BackendStatusChip({ compact = false, className, "data-testid": testId }: Props) {
  const { status, retry } = useBackendStatus();
  const label = LABELS[status];
  const base = cn(
    "inline-flex items-center gap-1.5 rounded-full border border-border text-xs font-medium",
    compact ? "h-7 px-2" : "h-7 px-2.5",
    className
  );
  const dot = <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", DOT[status])} />;

  if (status === "unavailable") {
    return (
      <button
        type="button"
        onClick={retry}
        data-testid={testId}
        data-status={status}
        title={`${label}. Retry connecting`}
        aria-label={`${label}. Retry connecting`}
        className={cn(
          base,
          "text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        {dot}
        {!compact && <span>{label}</span>}
        <RotateCw aria-hidden="true" className="h-3 w-3" />
        {!compact && <span>Retry</span>}
      </button>
    );
  }

  return (
    <span data-testid={testId} data-status={status} title={label} className={cn(base, "text-muted-foreground")}>
      {dot}
      <span className={compact ? "sr-only" : undefined}>{label}</span>
    </span>
  );
}
