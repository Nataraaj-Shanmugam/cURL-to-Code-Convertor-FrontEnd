import { lazy, Suspense } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "@/components/ui/theme-provider";
import AppLayout from "@/components/layout/AppLayout";
import { AnimatePresence, motion } from "framer-motion";
import Home from "@/pages/Home";

const Playground = lazy(() => import("@/pages/Playground"));
const EditorPage = lazy(() => import("@/pages/EditorPage"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export default function App() {
  const location = useLocation();

  return (
    <ThemeProvider attribute="class" defaultTheme="system" storageKey="ui-theme">
      <AppLayout>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <Suspense fallback={<PageLoader />}>
              <Routes location={location}>
                <Route path="/" element={<Home />} />
                <Route path="/playground" element={<Playground />} />
                <Route path="/editor" element={<EditorPage />} />
              </Routes>
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </AppLayout>
    </ThemeProvider>
  );
}