import { Link, useLocation } from "react-router-dom";
import { useTheme } from "@/components/ui/theme-provider";
import { Moon, Sun, Code2 } from "lucide-react";
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
    <header className="border-b border-border sticky top-0 z-30 bg-background/95 backdrop-blur-md">
      <div className="container mx-auto flex items-center justify-between py-4 px-4">
        {/* Logo and Brand */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-lg blur-md opacity-40 group-hover:opacity-60 transition-opacity"></div>
            <div className="relative w-10 h-10 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 rounded-lg flex items-center justify-center shadow-lg">
              <Code2 className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
          </div>
          <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400">
            CurlCraft Assured
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-6">
          {navLinks.map(({ path, label }) => (
            <Link
              key={path}
              to={path}
              className={`text-sm font-medium transition-colors relative ${
                location.pathname === path 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              {location.pathname === path && (
                <span className="absolute -bottom-[17px] left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600"></span>
              )}
            </Link>
          ))}

          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="ml-2 hover:bg-accent"
              aria-label="Toggle theme"
            >
              {theme === "light" ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}