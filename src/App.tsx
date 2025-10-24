import { Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ui/theme-provider";
import AppLayout from "@/components/layout/AppLayout";
import Home from "@/pages/Home";
import Playground from "@/pages/Playground";

export default function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="ui-theme">
      <AppLayout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/playground" element={<Playground />} />
        </Routes>
      </AppLayout>
    </ThemeProvider>
  );
}