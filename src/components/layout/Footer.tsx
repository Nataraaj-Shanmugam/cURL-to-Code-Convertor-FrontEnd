export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border py-4 mt-8">
      <div className="container mx-auto text-center text-sm text-muted-foreground">
        © {currentYear} Modernized Frontend · Built with ❤️ and Shadcn/UI
      </div>
    </footer>
  );
}