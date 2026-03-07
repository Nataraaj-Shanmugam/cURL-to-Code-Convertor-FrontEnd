import { Code2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border py-6 mt-8">
      <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-primary" />
          <span>&copy; {currentYear} CurlCraft Assured</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/playground" className="hover:text-foreground transition-colors">
            Playground
          </Link>
          <span className="text-border">|</span>
          <span>cURL to REST Assured</span>
        </div>
      </div>
    </footer>
  );
}
