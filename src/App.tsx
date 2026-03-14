import { lazy, Suspense } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "@/components/ui/theme-provider";
import AppLayout from "@/components/layout/AppLayout";
import Home from "@/pages/Home";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Toaster } from "sonner";

const Playground = lazy(() => import("@/pages/Playground"));
const EditorPage = lazy(() => import("@/pages/EditorPage"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

export default function App() {
  const location = useLocation();

  return (
    <ErrorBoundary>
    <ThemeProvider attribute="class" defaultTheme="system" storageKey="ui-theme">
      <AppLayout>
        <div key={location.pathname} className="animate-page-enter">
          <Suspense fallback={<PageLoader />}>
            <Routes location={location}>
              <Route path="/" element={<Home />} />
              <Route path="/playground" element={<Playground />} />
              <Route path="/editor" element={<EditorPage />} />
            </Routes>
          </Suspense>
        </div>
      </AppLayout>
      <Toaster richColors position="top-right" />
    </ThemeProvider>
    </ErrorBoundary>
  );
}
