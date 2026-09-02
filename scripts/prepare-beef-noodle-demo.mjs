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
const title = "QR 手機點餐示範｜百工牛肉麵｜創百業智慧鏈";
const description = "體驗創百業智慧鏈 QR 手機點餐：掃碼加入會員、查看菜單、選擇加料、桌邊送單與即時訂單狀態。";
html = html
  .replace(/<title>.*?<\/title>/s, `<title>${title}</title>`)
  .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${description}">`)
  .replace(/<meta name="robots"[^>]*>/, '<meta name="robots" content="noindex,nofollow">')
  .replace(/<link rel="canonical"[^>]*>/, '<link rel="canonical" href="https://baiyeconnect.com/#/features">');
if (!html.includes('name="robots"')) {
  html = html.replace("</head>", '    <meta name="robots" content="noindex,nofollow">\n  </head>');
}
html = html.replace(/\s*<meta name="app-variant"[^>]*>/g, "");
html = html.replace("</head>", '    <meta name="app-variant" content="beef-noodle-demo">\n  </head>');
await writeFile(indexPath, html, "utf8");

const headersPath = path.join(distDir, "_headers");
let headers = await readFile(headersPath, "utf8");
headers = headers.replace(
  "https://chuang-baiye-ai.baiye-platform.workers.dev",
  expectedWorker,
);
await writeFile(headersPath, headers, "utf8");
await writeFile(path.join(distDir, "robots.txt"), "User-agent: *\nDisallow: /\n", "utf8");
