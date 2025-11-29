// src/components/NavBar.tsx
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "@/components/ui/theme-provider";
import { Moon, Sun, Code2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useBackendStatus } from "@/contexts/BackendStatusContext";

const navLinks = [
  { path: "/", label: "Home" },
  { path: "/playground", label: "Playground", requiresBackend: true },
];

export default function NavBar() {
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { isBackendDown } = useBackendStatus();
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");

  const handleNavClick = (e: React.MouseEvent, path: string, requiresBackend: boolean) => {
    if (requiresBackend && isBackendDown) {
      e.preventDefault();
      alert('Playground is currently unavailable. Backend is down.');
    }
  };

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? "glass-strong shadow-lg border-b border-border/50"
          : "bg-background/80 backdrop-blur-md border-b border-border/30"
      }`}
    >
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        {/* Logo and Brand */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative w-10 h-10">
            {/* Animated glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-xl blur-md opacity-40 group-hover:opacity-70 transition-all duration-300 group-hover:blur-lg animate-pulse-glow"></div>
            
            {/* Logo container */}
            <div className="relative w-10 h-10 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
              <Code2 className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
          </div>
          
          <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 transition-all duration-300 group-hover:scale-105">
            CurlCraft Assured
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1">
          {navLinks.map(({ path, label, requiresBackend }) => {
            const isDisabled = requiresBackend && isBackendDown;
            const isActive = location.pathname === path;
            
            return (
              <Link
                key={path}
                to={path}
                onClick={(e) => handleNavClick(e, path, requiresBackend || false)}
                className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isDisabled
                    ? "text-muted-foreground/50 cursor-not-allowed opacity-50"
                    : isActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
                aria-disabled={isDisabled}
              >
                <span className="relative z-10 flex items-center gap-2">
                  {label}
                  {isDisabled && <AlertCircle className="w-3 h-3" />}
                </span>
                
                {/* Active indicator with gradient */}
                {isActive && !isDisabled && (
                  <>
                    <span className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 animate-pulse"></span>
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-full"></span>
                  </>
                )}
              </Link>
            );
          })}

          {/* Theme Toggle */}
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="ml-2 relative group hover:bg-accent rounded-lg transition-all duration-200 hover:scale-105"
              aria-label="Toggle theme"
            >
              <div className="relative">
                {theme === "light" ? (
                  <Moon className="h-5 w-5 transition-transform duration-200 group-hover:rotate-12" />
                ) : (
                  <Sun className="h-5 w-5 transition-transform duration-200 group-hover:rotate-45" />
                )}
              </div>
              
              {/* Hover glow effect */}
              <span className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 blur-sm"></span>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}