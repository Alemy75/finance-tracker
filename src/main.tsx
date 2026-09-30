import React from "react";
import ReactDOM from "react-dom/client";
import { MotionGlobalConfig } from "motion/react";
import App from "./App";
import "./index.css";

// Dev-only: `?instant` finishes every motion animation at once (handy for automated checks in background tabs).
if (import.meta.env.DEV && new URLSearchParams(location.search).has("instant")) MotionGlobalConfig.skipAnimations = true;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
