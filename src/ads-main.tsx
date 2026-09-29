import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AdsInfoPage, AdsLegalPage, AdsPage } from "./pages/AdsPage";

import "./ads-reset.css";

createRoot(document.getElementById("root")!).render(<React.StrictMode><BrowserRouter><Routes>
  <Route path="/google-ads" element={<AdsPage />} />
  <Route path="/merchant" element={<AdsInfoPage topic="merchant" />} />
  <Route path="/ordering" element={<AdsInfoPage topic="ordering" />} />
  <Route path="/ai" element={<AdsInfoPage topic="ai" />} />
  <Route path="/platform" element={<AdsInfoPage topic="platform" />} />
  <Route path="/refund" element={<AdsInfoPage topic="refund" />} />
  <Route path="/pricing" element={<AdsInfoPage topic="pricing" />} />
  <Route path="/about" element={<AdsInfoPage topic="about" />} />
  <Route path="/faq" element={<AdsInfoPage topic="faq" />} />
  <Route path="/contact" element={<AdsInfoPage topic="contact" />} />
  <Route path="/privacy" element={<AdsLegalPage topic="privacy" />} />
  <Route path="/terms" element={<AdsLegalPage topic="terms" />} />
</Routes></BrowserRouter></React.StrictMode>);
