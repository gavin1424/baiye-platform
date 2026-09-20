import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const workerUrl = process.env.VITE_PLATFORM_API_URL;
const publicUrl = (process.env.VITE_PUBLIC_SITE_URL || "").replace(/\/$/, "");
const expectedWorker = "https://chuang-baiye-ordering-staging.baiye-platform.workers.dev";

if (workerUrl !== expectedWorker) throw new Error("Demo build must use the isolated ordering staging Worker.");
if (!/^https:\/\/baiye-beef-noodle-demo\.pages\.dev$/.test(publicUrl)) throw new Error("Demo build must use the dedicated Pages URL.");

const distDir = path.resolve("dist/client");
const indexPath = path.join(distDir, "index.html");
let html = await readFile(indexPath, "utf8");
const title = "百工牛肉麵｜牛肉麵・乾麵・小菜・湯品";
const description = "百工牛肉麵線上菜單：牛肉麵、乾麵、拌麵、小菜、湯品與飲品，手機即可查看菜單並點餐。";
html = html
  .replace(/<title>.*?<\/title>/s, `<title>${title}</title>`)
  .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${description}">`)
  .replace(/<meta name="robots"[^>]*>/, '<meta name="robots" content="index,follow">')
  .replace(/<link rel="canonical"[^>]*>/, '<link rel="canonical" href="https://baiye-beef-noodle-demo.pages.dev/">');
await writeFile(indexPath, html, "utf8");

const headersPath = path.join(distDir, "_headers");
let headers = await readFile(headersPath, "utf8");
headers = headers.replace(
  "https://chuang-baiye-ai.baiye-platform.workers.dev",
  expectedWorker,
);
await writeFile(headersPath, headers, "utf8");
await writeFile(path.join(distDir, "robots.txt"), "User-agent: *\nAllow: /\n", "utf8");
