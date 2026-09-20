import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../../src/pages/MemberBenefitsPage.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../../src/member-benefits.css", import.meta.url), "utf8");

test("member benefits page contains the complete public retention journey", () => {
  for (const label of [
    "會員不是名單",
    "從新客變熟客",
    "每一次消費",
    "不同的顧客",
    "加入會員真的有差",
    "謝謝光臨",
    "在對的時間",
    "不用再要求顧客下載",
    "很久沒有回來",
    "不是所有會員",
    "下一次預約",
    "掃碼點餐",
    "不再只靠感覺",
    "AI 幫助商家",
    "一套系統",
    "長期顧客關係",
  ]) assert.match(page, new RegExp(label));
});

test("planned membership capabilities are not represented as live production automation", () => {
  for (const qualifier of ["規劃功能", "Production 尚未開放", "可搭配活動規劃", "AI 可協助分析規劃"]) {
    assert.match(page, new RegExp(qualifier));
  }
  assert.match(page, /優惠券目前尚未在正式環境開放/);
  assert.match(page, /自動分群與自動訊息發送尚未正式開放/);
  assert.equal((page.match(/<strong>—<\/strong>/g) || []).length, 8);
  assert.match(page, /不代表任何商家的真實營運數字/);
});

test("member benefits SEO and responsive safeguards are present", () => {
  assert.match(app, /會員回購經營｜創百業智慧鏈/);
  assert.match(app, /透過會員資料、消費紀錄、優惠券、LINE互動、網站預約與顧客喚回/);
  assert.match(css, /@media\(max-width:430px\)/);
  assert.match(css, /body:has\(\.member-benefits-page\) \.ai-chat-launcher/);
});
