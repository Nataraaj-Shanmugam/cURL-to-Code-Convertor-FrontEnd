import { useEffect } from "react";
import CurlPlayground from "@/components/features/curl/CurlPlayground";
import BackendStatusChip from "@/components/features/backend/BackendStatusChip";

export default function Playground() {
  useEffect(() => {
    document.title = "Playground — cURLCraft Assured";
  }, []);
  return (
    <>
      <div className="max-w-5xl mx-auto px-4 flex justify-end" aria-live="polite">
        <BackendStatusChip data-testid="backend-status-playground" />
      </div>
      <CurlPlayground />
    </>
  );
}
