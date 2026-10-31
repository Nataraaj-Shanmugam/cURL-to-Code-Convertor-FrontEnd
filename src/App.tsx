import { lazy, Suspense } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "@/components/ui/theme-provider";
import AppLayout from "@/components/layout/AppLayout";
import Home from "@/pages/Home";
import NotFound from "@/pages/NotFound";
import Feedback from "@/pages/Feedback";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Toaster } from "sonner";
import RouteEffects from "@/components/layout/RouteEffects";
import { PageHeadingLevelProvider } from "@/components/layout/PageHeading";

const Playground = lazy(() => import("@/pages/Playground"));
const EditorPage = lazy(() => import("@/pages/EditorPage"));
const BatchEditorPage = lazy(() => import("@/pages/BatchEditorPage"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

/**
 * The batch editor page is not edited here, so the shell supplies its <h1>. It is visually hidden
 * because the page already shows its own heading; the page's main title is demoted to <h2>.
 */
function BatchEditorRoute() {
  return (
    <PageHeadingLevelProvider value="h2">
      <h1 className="sr-only">Batch editor</h1>
      <BatchEditorPage />
    </PageHeadingLevelProvider>
  );
}

export default function App() {
  const location = useLocation();

  return (
    <ErrorBoundary>
    <ThemeProvider attribute="class" defaultTheme="system" storageKey="ui-theme">
      <AppLayout>
        <RouteEffects />
        <div key={location.pathname} className="animate-page-enter">
          <Suspense fallback={<PageLoader />}>
            <Routes location={location}>
              <Route path="/" element={<Home />} />
              <Route path="/playground" element={<Playground />} />
              <Route path="/editor" element={<EditorPage />} />
              <Route path="/batch-editor" element={<BatchEditorRoute />} />
              <Route path="/feedback" element={<Feedback />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </div>
      </AppLayout>
      <Toaster richColors position="top-right" />
    </ThemeProvider>
    </ErrorBoundary>
  );
}
