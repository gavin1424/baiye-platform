import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const components = await readFile(new URL("../src/components.tsx", import.meta.url), "utf8");
const merchantLogin = await readFile(new URL("../src/pages/MerchantLoginPage.tsx", import.meta.url), "utf8");
const adminLogin = await readFile(new URL("../src/pages/AuthPages.tsx", import.meta.url), "utf8");

test("legacy public auth routes redirect to merchant phone-password auth", () => {
  assert.match(app, /path="\/login" element={<Navigate to="\/merchant\/login" replace \/>}/);
  assert.match(app, /path="\/register" element={<Navigate to="\/merchant\/register" replace \/>}/);
  assert.doesNotMatch(app, /Navigate to="\/login"/);
});

test("platform admin login and guards stay on their dedicated route", () => {
  assert.match(app, /path="\/admin\/login" element={<AdminLoginPage \/>}/);
  assert.match(app, /if \(!authReady\) return <Navigate to="\/admin\/login" replace \/>/);
  assert.match(app, /session\.role === "guest"\) return <Navigate to="\/admin\/login" replace \/>/);
  assert.match(adminLogin, /export function AdminLoginPage\(\)/);
  assert.match(adminLogin, /<h1>平台管理員登入<\/h1>/);
});

test("mobile My entry uses merchant auth and merchant session auto-resolve", () => {
  assert.match(components, /label: "我的",\s+to: session\.role === "admin" \? "\/admin" : "\/merchant\/login"/);
  assert.match(merchantLogin, /merchantOrderingApi<LoginResponse>\("\/api\/merchant-auth\/session"\)/);
  assert.match(merchantLogin, /navigate\(data\.next_url \|\| "\/merchant\/dashboard"/);
  assert.match(merchantLogin, /<h1>商家管理者登入<\/h1>/);
  assert.match(merchantLogin, /<label>手機號碼/);
  assert.match(merchantLogin, /<label>8 位數字密碼/);
  assert.match(merchantLogin, /登入商家管理中心/);
  assert.match(merchantLogin, /還沒有商家帳號？/);
  assert.match(merchantLogin, /to="\/merchant\/register">商家免費註冊/);
});


