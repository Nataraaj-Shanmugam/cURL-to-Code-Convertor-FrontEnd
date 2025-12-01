export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative border-t border-border/50 py-6 mt-auto">
      {/* Gradient line at top */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
      
      <div className="container mx-auto px-4">
      
          <div className="w-full flex justify-center">
            <span>© {currentYear} CurlCraft Assured</span>
            <span className="hidden md:inline">·</span>
            <span className="hidden md:inline">All rights reserved</span>
          </div>

        {/* Tech Stack Tags */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
          {['React', 'TypeScript', 'Tailwind CSS', 'REST Assured'].map((tech) => (
            <span
              key={tech}
              className="px-3 py-1 text-xs font-medium rounded-full bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all duration-200 cursor-default"
            >
              {tech}
            </span>
          ))}
        </div>
      </div>
    </footer>
  );
}