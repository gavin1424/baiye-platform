import test from "node:test";
import assert from "node:assert/strict";
import { blocksP2P, calculateCouponDiscount, isAllowedInstitutionType, validateDeliveryUrl } from "../src/member-integrations.js";
import { EASYWALLET_API_MODE, UBER_DIRECT_MODE, easywalletProvider, uberDirectProvider } from "../src/integration-providers.js";

test("coupon discount never exceeds order total",()=>{assert.equal(calculateCouponDiscount(30000),10000);assert.equal(calculateCouponDiscount(8000),8000);assert.equal(calculateCouponDiscount(-1),0)});
test("delivery URLs require official HTTPS domains",()=>{assert.ok(validateDeliveryUrl("uber_eats","https://www.ubereats.com/tw/store/example"));assert.ok(validateDeliveryUrl("foodpanda","https://www.foodpanda.com.tw/restaurant/example"));assert.equal(validateDeliveryUrl("uber_eats","javascript:alert(1)"),null);assert.equal(validateDeliveryUrl("foodpanda","https://example.com/store"),null)});
test("financing blocks private lenders and P2P",()=>{assert.equal(isAllowedInstitutionType("bank"),true);assert.equal(isAllowedInstitutionType("private_lender"),false);assert.equal(blocksP2P({business_model:"p2p"}),true)});
test("real provider adapters stay disabled",async()=>{assert.equal(EASYWALLET_API_MODE,"disabled");assert.equal(UBER_DIRECT_MODE,"disabled");assert.equal((await easywalletProvider.createPayment()).ok,false);assert.equal((await uberDirectProvider.createDelivery()).ok,false)});
