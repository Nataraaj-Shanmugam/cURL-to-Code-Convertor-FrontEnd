import { Link } from "react-router-dom";
import { Compass, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center gap-6">
      <div className="rounded-full bg-muted p-5">
        <Compass className="w-10 h-10 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="space-y-2 max-w-sm">
        <h1 className="text-2xl font-bold">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          There is nothing at this address. It may have moved, or the link may be mistyped.
        </p>
      </div>
      <Button asChild size="lg" className="gap-2">
        <Link to="/playground">
          <Terminal className="w-4 h-4" aria-hidden="true" />
          Go to the Playground
        </Link>
      </Button>
    </div>
  );
}
