import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
// Self-hosted fonts (Google Fonts is unreachable from mainland China).
// Noto Serif SC is split into unicode-range subsets, so browsers only fetch the glyphs a page uses.
import "@fontsource/noto-serif-sc/chinese-simplified-400.css";
import "@fontsource/noto-serif-sc/chinese-simplified-600.css";
import "@fontsource/instrument-serif/latin-400.css";
import "@fontsource/instrument-serif/latin-400-italic.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "./styles/global.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
