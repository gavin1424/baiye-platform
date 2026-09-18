import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";

const issuer = "創百業智慧鏈";
const account = "www.asdfg14@gmail.com";
const appName = "創百業 Owner Admin";
const enrollmentDir = join(tmpdir(), "baiye-owner-totp-enrollment");
const secretPath = join(enrollmentDir, "owner-totp.secret");
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32(bytes) {
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let index = 0; index < bits.length; index += 5) {
    output += alphabet[Number.parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
  }
  return output;
}

if (existsSync(secretPath)) {
  throw new Error("An unfinished Owner TOTP enrollment already exists. Complete or securely remove it before creating another.");
}

mkdirSync(enrollmentDir, { recursive: true, mode: 0o700 });
const secret = base32(randomBytes(32));
writeFileSync(secretPath, secret, { encoding: "utf8", mode: 0o600, flag: "wx" });

const label = `${issuer}:${account}`;
const uri = `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
const qr = renderToStaticMarkup(React.createElement(QRCodeSVG, { value: uri, size: 320, level: "M", marginSize: 4 }));
const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${appName}｜TOTP Enrollment</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#061a38;color:#fff;font-family:system-ui,sans-serif}.card{width:min(520px,calc(100% - 32px));box-sizing:border-box;padding:32px;border:1px solid #d9a74e;border-radius:24px;background:#0a2853;text-align:center;box-shadow:0 24px 70px #0008}.eyebrow{color:#e1ae59;font-weight:800;letter-spacing:.12em}h1{margin:8px 0 4px;font-size:30px}.meta{margin:0 0 20px;color:#c8d5e6}.qr{display:inline-grid;padding:12px;border-radius:16px;background:#fff}.notice{margin:20px 0 0;padding:14px;border-radius:12px;background:#102f5d;color:#e6edf7;line-height:1.6}.state{display:inline-block;margin-top:16px;color:#f3c775;font-weight:900}</style></head><body><main class="card"><div class="eyebrow">${appName}</div><h1>設定驗證器</h1><p class="meta">Issuer：${issuer}<br>Account：${account}</p><div class="qr">${qr}</div><p class="notice">請使用手機驗證器掃描此 QR Code。掃描完成後回覆我「已完成掃描」；在你確認前不會寫入 Cloudflare Secret。</p><span class="state">OWNER_TOTP_ENROLLMENT_REQUIRED</span></main></body></html>`;

const server = createServer((request, response) => {
  if (request.url !== "/") { response.writeHead(404).end(); return; }
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store, max-age=0",
    "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'none'",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "x-robots-tag": "noindex, nofollow",
  });
  response.end(html);
});

server.listen(47831, "127.0.0.1", () => {
  console.log("Owner TOTP enrollment is available at http://127.0.0.1:47831/");
  console.log("OWNER_TOTP_ENROLLMENT_REQUIRED");
});
