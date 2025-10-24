import { Link, useLocation } from "react-router-dom";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

const navLinks = [
  { path: "/", label: "Home" },
  { path: "/playground", label: "Playground" },
];

export default function NavBar() {
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");

  return (
    <header className="border-b border-border sticky top-0 z-30 bg-background/80 backdrop-blur-sm">
      <div className="container mx-auto flex items-center justify-between py-3 px-4">
        <Link to="/" className="text-lg font-semibold hover:opacity-80 transition-opacity">
          ⚡ Modern FE
        </Link>

        <nav className="flex items-center gap-4">
          {navLinks.map(({ path, label }) => (
            <Link
              key={path}
              to={path}
              className={`text-sm font-medium transition-colors ${
                location.pathname === path 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-primary"
              }`}
            >
              {label}
            </Link>
          ))}

          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="ml-2"
              aria-label="Toggle theme"
            >
              {theme === "light" ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}