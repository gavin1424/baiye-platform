import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../src/pages/PartnerPages.tsx", import.meta.url), "utf8");

test("UI01 sign success closes preview", () => assert.match(source, /setPreview\(undefined\);\s*setSignature/));
test("UI02 sign success sets signed state", () => assert.match(source, /setSigned\(true\)/));
test("UI03 one success modal has required heading", () => assert.equal((source.match(/契約簽署成功！/g) || []).length, 1));
test("UI04 welcome notification is inside success modal", () => assert.match(source, /signSuccess &&[\s\S]*歡迎成為創百業會員/));
test("UI05 coupon notification states NT$100", () => assert.match(source, /NT\$100 迎新禮券已放入您的會員帳戶/));
test("UI06 existing member receives non-duplicate copy", () => assert.match(source, /迎新禮券已存在，不會重複發放/));
test("UI07 signing button is double-click protected", () => assert.match(source, /disabled=\{signing\}[\s\S]*簽署處理中…/));
test("UI08 one stable idempotency ref is used", () => assert.match(source, /useRef\(crypto\.randomUUID\(\)\)[\s\S]*"idempotency-key": signIdempotencyKey\.current/));
test("UI09 incomplete sign result does not close preview", () => { const validation=source.indexOf("SIGN_RESULT_INCOMPLETE"),close=source.indexOf("setPreview(undefined);",validation); assert.ok(validation>0&&close>validation); });
test("UI10 success redirects to partner dashboard", () => assert.match(source, /navigate\("\/partner\/dashboard", \{ replace: true \}\)/));
test("UI11 signed refresh hides signing form", () => assert.match(source, /signed && !signSuccess[\s\S]*此版本已完成簽署[\s\S]*!signed &&/));
test("UI12 signed refresh offers private PDF and dashboard", () => { assert.match(source,/查看／下載已簽 PDF/); assert.match(source,/返回承攬夥伴中心/); });
test("UI13 coupon issue warning preserves contract success", () => assert.match(source,/契約已簽署成功，但迎新禮券建立暫時失敗/));
test("UI14 countdown is announced", () => assert.match(source,/秒後自動返回承攬夥伴中心/));
test("UI15 mobile actions retain shared responsive class", () => assert.match(source,/member-welcome-modal[\s\S]*partner-workflow-actions/));
