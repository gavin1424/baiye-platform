import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "dist", "client");
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
  const adsPaths = new Set(["google-ads", "merchant", "ordering", "ai", "platform", "pricing", "about", "faq", "contact", "privacy", "terms", "refund"]);
  const source = adsPaths.has(path) ? "ads.html" : "index.html";
  const html = readFileSync(join(root, source), "utf8")
    .replaceAll('href="https://baiyeconnect.com/"', `href="https://baiyeconnect.com/${path}"`)
    .replaceAll('content="https://baiyeconnect.com/"', `content="https://baiyeconnect.com/${path}"`)
    .replaceAll('href="https://baiyeconnect.com/google-ads"', `href="https://baiyeconnect.com/${path}"`)
    .replaceAll('content="https://baiyeconnect.com/google-ads"', `content="https://baiyeconnect.com/${path}"`);
  writeFileSync(join(destination, "index.html"), html);
}
copyFileSync(join(root, "index.html"), join(root, "404.html"));
