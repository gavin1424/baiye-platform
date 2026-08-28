import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculateCouponDiscount, validateDeliveryUrl, blocksP2P } from "../src/member-integrations.js";

const integrations = readFileSync(new URL("../src/member-integrations.js", import.meta.url), "utf8");
const payment = readFileSync(new URL("../src/payment-state.js", import.meta.url), "utf8");
const migration = readFileSync(new URL("../migrations/0013_growth_completion.sql", import.meta.url), "utf8");

test("G1 coupon discount is capped by gross",()=>assert.equal(calculateCouponDiscount(8000,10000),8000));
test("G2 coupon discount is never negative",()=>assert.equal(calculateCouponDiscount(-1,10000),0));
test("G3 Uber Eats requires official HTTPS",()=>assert.equal(validateDeliveryUrl("uber_eats","https://evil.example/order"),null));
test("G4 foodpanda official HTTPS is accepted",()=>assert.ok(validateDeliveryUrl("foodpanda","https://www.foodpanda.com.tw/restaurant/x")));
test("G5 LINE links require line.me",()=>assert.equal(validateDeliveryUrl("line","https://example.com/order"),null));
test("G6 javascript URLs are rejected",()=>assert.equal(validateDeliveryUrl("custom","javascript:alert(1)"),null));
test("G7 short URLs are rejected",()=>assert.equal(validateDeliveryUrl("custom","https://bit.ly/x"),null));
test("G8 private lender is blocked",()=>assert.equal(blocksP2P({institution_type:"private_lender"}),true));
test("G9 peer-to-peer is blocked",()=>assert.equal(blocksP2P({business_model:"peer_to_peer"}),true));
test("G10 bank is allowed through P2P gate",()=>assert.equal(blocksP2P({institution_type:"bank"}),false));
test("G11 customer notify cannot confirm payment",()=>assert.match(integrations,/pending_merchant_confirmation/));
test("G12 payment confirm updates order paid",()=>assert.match(payment,/action==="confirm"\?"paid"/));
test("G13 payment confirm redeems reserved coupon",()=>assert.match(payment,/status='redeemed'/));
test("G14 refund supports all three coupon policies",()=>{for(const p of ["restore_coupon","do_not_restore","manual_review"])assert.match(migration,new RegExp(p))});
test("G15 payment transitions are idempotent",()=>assert.match(payment,/merchant_integration_operations/));
test("G16 integration operations have unique scope and key",()=>assert.match(migration,/UNIQUE\(merchant_id,scope,idempotency_key\)/));
test("G17 campaign funding remains merchant-only",()=>assert.match(integrations,/V1 僅允許 merchant-funded/));
test("G18 EasyWallet API remains disabled",()=>assert.match(integrations,/EASYWALLET_API_MODE_DISABLED/));
test("G19 real financing referral remains disabled",()=>assert.match(integrations,/FINANCING_REAL_REFERRAL_DISABLED/));
test("G20 sensitive financing lead viewing is audited",()=>assert.match(integrations,/lead_viewed_sensitive/));
