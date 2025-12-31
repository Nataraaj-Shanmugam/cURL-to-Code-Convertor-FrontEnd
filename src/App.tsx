// src/App.tsx
import { Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { BackendStatusProvider } from "@/contexts/BackendStatusContext";
import AppLayout from "@/components/layout/AppLayout";
import Home from "@/pages/Home";
import Playground from "@/pages/Playground";
import EditorPage from "@/pages/EditorPage";
import Feedback from "@/pages/Feedback";

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" storageKey="ui-theme">
      <BackendStatusProvider>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/playground" element={<Playground />} />
            <Route path="/editor" element={<EditorPage />} />
             <Route path="/feedback" element={<Feedback />} /> {/* ADD THIS ROUTE */}
        
          </Routes>
        </AppLayout>
      </BackendStatusProvider>
    </ThemeProvider>
  );
}