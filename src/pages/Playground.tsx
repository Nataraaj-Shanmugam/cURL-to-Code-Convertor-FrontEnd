import CurlPlayground from "@/components/features/curl/CurlPlayground";

// The document title is set by RouteEffects. The backend status chip lives in the NavBar (once);
// CurlPlayground explains a waking or unavailable backend in a banner above the input.
export default function Playground() {
  return <CurlPlayground />;
}
