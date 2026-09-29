import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createServer } from "vite";

const root = join(process.cwd(), "dist", "client");
const adsPaths = new Set(["google-ads", "merchant", "ordering", "ai", "platform", "pricing", "about", "faq", "contact", "privacy", "terms", "refund"]);
const vite = await createServer({ configFile: "vite.config.mjs", server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: "custom" });
const { AdsPage, AdsInfoPage, AdsLegalPage } = await vite.ssrLoadModule("/src/pages/AdsPage.tsx");
function renderAds(path) {
  const element = path === "google-ads" ? createElement(AdsPage) : path === "privacy" || path === "terms" ? createElement(AdsLegalPage, { topic: path }) : createElement(AdsInfoPage, { topic: path });
  return renderToString(element);
}
const paths = [
  "google-ads", "merchant", "ordering", "ai", "platform", "pricing", "about",
  "contact", "faq", "privacy", "terms", "refund", "categories", "businesses",
  "collaborations", "marketplace", "shop", "demo-sites", "login", "register",
  "forgot-password", "how-it-works", "success-stories", "partner", "partner/apply",
  "partner/login", "partner/contract", "partner/dashboard", "member/login", "report", "join",
];
for (const path of paths) {
  const destination = join(root, path);
  mkdirSync(destination, { recursive: true });
  const source = adsPaths.has(path) ? "ads.html" : "index.html";
  let html = readFileSync(join(root, source), "utf8")
    .replaceAll('href="https://baiyeconnect.com/"', `href="https://baiyeconnect.com/${path}"`)
    .replaceAll('content="https://baiyeconnect.com/"', `content="https://baiyeconnect.com/${path}"`)
    .replaceAll('href="https://baiyeconnect.com/google-ads"', `href="https://baiyeconnect.com/${path}"`)
    .replaceAll('content="https://baiyeconnect.com/google-ads"', `content="https://baiyeconnect.com/${path}"`);
  if (adsPaths.has(path)) {
    html = html.replace(/<link rel="stylesheet" crossorigin href="(\/assets\/ads-[^"]+\.css)">/, (_, asset) => `<style>${readFileSync(join(root, asset.slice(1)), "utf8")}</style>`);
    html = html.replace(/<link rel="modulepreload"[^>]+>/g, "");
    html = html.replace('<div id="root"></div>', `<div id="root">${renderAds(path)}</div>`);
  }
  writeFileSync(join(destination, "index.html"), html);
}
await vite.close();
copyFileSync(join(root, "index.html"), join(root, "404.html"));
