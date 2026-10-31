import { Code2 } from "lucide-react";
import { Link } from "react-router-dom";
import { GITHUB_URL, PORTFOLIO_URL } from "@/constants/links";

const linkClass = "hover:text-foreground transition-colors underline-offset-4 hover:underline";

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border py-6 mt-8">
      <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-primary" aria-hidden="true" />
          <span>&copy; {currentYear} CurlCraft Assured</span>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link to="/playground" className={linkClass}>
            Playground
          </Link>
          <Link to="/feedback" className={linkClass}>
            Feedback
          </Link>
          <ExternalLink href={GITHUB_URL}>GitHub</ExternalLink>
          <ExternalLink href={PORTFOLIO_URL}>nataraaj.dev</ExternalLink>
        </nav>
      </div>
    </footer>
  );
}
