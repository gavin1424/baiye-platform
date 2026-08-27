import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const output = join(process.cwd(), "dist", "client");
const workerUrl = String(process.env.VITE_PLATFORM_API_URL || "").replace(/\/$/, "");
if (!/^https:\/\/chuang-baiye-(?:ai|growth|commerce)-staging(?:\.[a-z0-9-]+)?\.workers\.dev$/i.test(workerUrl)) {
  throw new Error("VITE_PLATFORM_API_URL 必須是隔離的 staging Worker URL");
}

const indexPath = join(output, "index.html");
let html = readFileSync(indexPath, "utf8");
html = html.replace(
  "</head>",
  '  <meta name="robots" content="noindex,nofollow" />\n</head>',
);
writeFileSync(indexPath, html);

const headersPath = join(output, "_headers");
let headers = readFileSync(headersPath, "utf8");
headers = headers.replace(
  "https://chuang-baiye-ai.baiye-platform.workers.dev",
  workerUrl,
);
writeFileSync(headersPath, headers);
writeFileSync(join(output, "robots.txt"), "User-agent: *\nDisallow: /\n");
