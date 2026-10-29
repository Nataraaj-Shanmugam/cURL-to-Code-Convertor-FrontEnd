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

// A data router is required by useBlocker (unsaved-edits guard). One catch-all route renders
// <App/>, which keeps its own <Routes>, so the route table and lazy loading are unchanged.
const router = createBrowserRouter([{ path: "*", element: <App /> }]);

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element #root not found in document");

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
