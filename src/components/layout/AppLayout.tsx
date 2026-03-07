import { ReactNode } from "react";
import NavBar from "./NavBar";
import Footer from "./Footer";

interface Props {
  children: ReactNode;
}

export default function AppLayout({ children }: Props) {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>
      <NavBar />
      <main id="main-content" className="flex-1 container mx-auto px-4 py-6">{children}</main>
      <Footer />
    </div>
  );
}