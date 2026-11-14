import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The one width and gutter for both editors (single request and batch), so switching between them
 * does not shift the page. The page container (AppLayout) supplies the side padding.
 */
export default function EditorShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-6xl", className)}>{children}</div>;
}
