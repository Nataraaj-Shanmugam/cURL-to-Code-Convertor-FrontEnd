import { Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ui/theme-provider";
import AppLayout from "@/components/layout/AppLayout";
import Home from "@/pages/Home";
import Playground from "@/pages/Playground";
import EditorPage from "@/pages/EditorPage";

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" storageKey="ui-theme">
      <AppLayout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/playground" element={<Playground />} />
          <Route path="/editor" element={<EditorPage />} />
        </Routes>
      </AppLayout>
    </ThemeProvider>
  );
}