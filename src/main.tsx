import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient } from "@tanstack/react-query";
import { MotionGlobalConfig } from "motion/react";
import App from "./App";
import { createDi } from "@/lib/di";
import "./index.css";

// Dev-only: `?instant` finishes every motion animation at once (handy for automated checks in background tabs).
if (import.meta.env.DEV && new URLSearchParams(location.search).has("instant")) MotionGlobalConfig.skipAnimations = true;

const queryClient = new QueryClient({
  defaultOptions: {
    // The app is offline-first: local reads must run without network and every failure is shown, not retried.
    queries: { networkMode: "always", retry: false, refetchOnWindowFocus: false },
    mutations: { networkMode: "always" }
  }
});

const di = createDi().build({
  queryClient,
  captureException: (error) => console.error(error)
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App di={di} />
  </React.StrictMode>
);
