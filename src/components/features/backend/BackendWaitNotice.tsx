import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EXPECTED_WAKE_MS, useBackendStatus } from "@/contexts/BackendStatusContext";
import { useElapsedSeconds } from "@/lib/hooks/useElapsedSeconds";

interface Props {
  onCancel: () => void;
}

/**
 * Shown when the user asks for a parse before the backend is awake. The request is held and sent
 * as soon as the backend is ready; the bar is an estimate against the usual wake-up time.
 */
export default function BackendWaitNotice({ onCancel }: Props) {
  const { status, wakingSince } = useBackendStatus();
  const elapsed = useElapsedSeconds(wakingSince);
  const expected = EXPECTED_WAKE_MS / 1000;
  // Never show 100% for an estimate; hold at 95% until the backend actually answers.
  const percent = Math.min(95, Math.round((elapsed / expected) * 100));
  const overdue = elapsed > expected;

  return (
    <div
      role="status"
      data-testid="backend-wait-notice"
      className="space-y-3 rounded-lg border border-warning/50 bg-warning/10 p-4 text-sm"
    >
      <div className="flex items-start gap-2">
        <Loader2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 motion-safe:animate-spin" />
        <div className="space-y-1">
          <p className="font-medium text-foreground">
            {status === "checking"
              ? "Connecting to the generator…"
              : "The generator is waking up — usually under a minute"}
          </p>
          <p className="text-muted-foreground">
            {overdue
              ? "This is taking longer than usual. We'll keep trying for a little longer."
              : "Your cURL will be parsed as soon as it's ready. You can keep editing meanwhile."}
          </p>
        </div>
      </div>

      <div
        role="progressbar"
        aria-label="Waiting for the generator"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`Waiting ${elapsed} second${elapsed === 1 ? "" : "s"}`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-warning transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground tabular-nums">Waiting {elapsed}s</span>
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
