import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const workerUrl = process.env.VITE_PLATFORM_API_URL;
const publicUrl = (process.env.VITE_PUBLIC_SITE_URL || "").replace(/\/$/, "");
const expectedWorker = "https://chuang-baiye-ai.baiye-platform.workers.dev";

if (workerUrl !== expectedWorker) throw new Error("The branded storefront build must use the production ordering Worker.");
if (!/^https:\/\/baiye-beef-noodle-demo\.pages\.dev$/.test(publicUrl)) throw new Error("The branded storefront build must use its dedicated Pages URL.");

const distDir = path.resolve("dist/client");
const indexPath = path.join(distDir, "index.html");
let html = await readFile(indexPath, "utf8");
const title = "百工牛肉麵｜桌邊 QR 點餐";
const description = "百工牛肉麵桌邊 QR 點餐：查看今日菜單、選擇規格與加料並送出訂單。";
html = html
  .replace(/<title>.*?<\/title>/s, `<title>${title}</title>`)
  .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${description}">`)
  .replace(/<meta name="robots"[^>]*>/, '<meta name="robots" content="noindex,nofollow">')
  .replace(/<link rel="canonical"[^>]*>/, '<link rel="canonical" href="https://baiye-beef-noodle-demo.pages.dev/">');
if (!html.includes('name="robots"')) {
  html = html.replace("</head>", '    <meta name="robots" content="noindex,nofollow">\n  </head>');
}
await writeFile(indexPath, html, "utf8");

const headersPath = path.join(distDir, "_headers");
const headers = await readFile(headersPath, "utf8");
if (!headers.includes(expectedWorker)) throw new Error("Storefront CSP must allow the production ordering Worker.");
for (const lineOrigin of ["https://api.line.me", "https://liff.line.me", "https://access.line.me"]) {
  if (!headers.includes(lineOrigin)) throw new Error(`Storefront CSP must allow the LINE LIFF origin: ${lineOrigin}`);
}
await writeFile(headersPath, headers, "utf8");
await writeFile(path.join(distDir, "robots.txt"), "User-agent: *\nDisallow: /\n", "utf8");
