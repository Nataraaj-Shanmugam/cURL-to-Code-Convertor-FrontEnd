import { Loader2, RotateCw } from "lucide-react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useBackendStatus } from "@/contexts/BackendStatusContext";

/**
 * Says in words what the status chip only hints at: why Parse may be slow or unavailable, what still
 * works, and what Retry does. Nothing is shown while checking or ready.
 */
export default function BackendStatusBanner({ id, hidden = false }: { id?: string; hidden?: boolean }) {
  const { status, retry } = useBackendStatus();
  if (hidden || (status !== "waking" && status !== "unavailable")) return null;

  if (status === "waking") {
    return (
      <Alert
        id={id}
        variant="info"
        data-testid="backend-status-banner"
        icon={<Loader2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 motion-safe:animate-spin" />}
      >
        <AlertTitle>Generator is waking up</AlertTitle>
        <p>
          The hosted generator sleeps when idle and usually needs under a minute to start. You can keep editing; Parse
          will wait for it and run as soon as it is ready.
        </p>
      </Alert>
    );
  }

  return (
    <Alert id={id} variant="destructive" role="alert" data-testid="backend-status-banner">
      <AlertTitle>Generator unavailable</AlertTitle>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="min-w-0 flex-1">
          It didn&apos;t respond in time, so Parse and Generate Code can&apos;t run yet. Your cURL stays on this page. Retry
          checks the generator again.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={retry} className="gap-1.5 bg-background text-foreground">
          <RotateCw aria-hidden="true" className="h-3.5 w-3.5" />
          Retry connection
        </Button>
      </div>
    </Alert>
  );
}
