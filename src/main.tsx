import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "./App";
import { AppStoreProvider } from "./store";
import { LineLiffOrderingEntryPage } from "./pages/LineLiffOrderingEntryPage";
import "./styles.css";
import "./qr-ordering.css";

const isLineLiffOrderingEntry = window.location.pathname.replace(/\/+$/, "") === "/liff-ordering";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isLineLiffOrderingEntry ? (
      <LineLiffOrderingEntryPage />
    ) : (
      <HashRouter>
        <AppStoreProvider>
          <App />
        </AppStoreProvider>
      </HashRouter>
    )}
  </React.StrictMode>,
);
