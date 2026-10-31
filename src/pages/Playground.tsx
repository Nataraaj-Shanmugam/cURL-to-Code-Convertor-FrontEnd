import CurlPlayground from "@/components/features/curl/CurlPlayground";
import BackendStatusChip from "@/components/features/backend/BackendStatusChip";

// The document title is set by RouteEffects.
export default function Playground() {
  return (
    <>
      <div className="max-w-5xl mx-auto px-4 flex justify-end" aria-live="polite">
        <BackendStatusChip data-testid="backend-status-playground" />
      </div>
      <CurlPlayground />
    </>
  );
}
