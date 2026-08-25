import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "./App";
import { AppStoreProvider } from "./store";
import { applyDemoDocumentMetadata, installDemoNetworkGuard } from "./demo-mode";
import "./styles.css";

installDemoNetworkGuard();
applyDemoDocumentMetadata();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <AppStoreProvider>
        <App />
      </AppStoreProvider>
    </HashRouter>
  </React.StrictMode>,
);
