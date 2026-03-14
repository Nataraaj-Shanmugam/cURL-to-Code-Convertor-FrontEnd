import { useEffect } from "react";
import CurlPlayground from "@/components/features/curl/CurlPlayground";

export default function Playground() {
  useEffect(() => {
    document.title = "Playground — cURLCraft Assured";
  }, []);
  return <CurlPlayground />;
}