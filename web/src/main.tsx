import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import { loadProductionFonts } from "./lib/fonts";

// Load the same bundled font bytes that the production PDF embeds before canvas layout.
loadProductionFonts().catch(() => undefined).then(() => createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
));
