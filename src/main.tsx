import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import "@fontsource/dm-sans/300.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "@fontsource/jetbrains-mono/700.css";
import "./index.css";
import { migrateLegacyEditorState } from "@/lib/utils/editorStorage";
import { installChunkLoadRecovery } from "@/lib/utils/chunkLoadRecovery";

// A lazy chunk missing after a deploy reloads the page once (see chunkLoadRecovery.ts).
installChunkLoadRecovery();

// Earlier versions kept the editor state, secrets included, in localStorage with no expiry.
migrateLegacyEditorState();

// A data router is required by useBlocker (unsaved-edits guard). One catch-all route renders
// <App/>, which keeps its own <Routes>, so the route table and lazy loading are unchanged.
const router = createBrowserRouter([{ path: "*", element: <App /> }], {
  future: { v7_relativeSplatPath: true },
});

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element #root not found in document");

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <RouterProvider router={router} future={{ v7_startTransition: true }} />
  </React.StrictMode>
);
