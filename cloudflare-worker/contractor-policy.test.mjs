import test from "node:test";
import assert from "node:assert/strict";
import {
  commissionTier,
  contractorLevelForCompletedSales,
  monthlyRequirementForCompletedSales,
  partnerWorkflowStatus,
  shouldTerminateStarterForInactivity,
  vipReviewStatusForCount,
  vipCycleForActivation,
} from "./src/partner.js";

test("five-level reward uses the completed historical count and is non-retroactive", () => {
  assert.equal(commissionTier(0), 1000);
  assert.equal(commissionTier(10), 1000, "the 11th completed sale earns the original rate");
  assert.equal(commissionTier(11), 1500, "the 12th completed sale earns the advanced rate");
  assert.equal(commissionTier(30), 1500);
  assert.equal(commissionTier(31), 2000);
  assert.equal(commissionTier(70), 2000);
  assert.equal(commissionTier(71), 2500);
  assert.equal(commissionTier(120), 2500);
  assert.equal(commissionTier(121), 3000);
  assert.equal(contractorLevelForCompletedSales(121).label, "資深承攬夥伴");
  assert.equal(monthlyRequirementForCompletedSales(70), 2);
  assert.equal(monthlyRequirementForCompletedSales(71), 3);
  assert.equal(monthlyRequirementForCompletedSales(121), 4);
});

test("partner application UX maps every lifecycle state without exposing account data", () => {
  const at = new Date("2026-08-24T10:00:00Z");
  assert.equal(partnerWorkflowStatus({ status: "pending_contract", approved_at: null }, null, at).state, "pending_review");
  assert.deepEqual(partnerWorkflowStatus({ status: "pending_contract", approved_at: "2026-08-20" }, { expires_at: "2026-08-25T10:00:00Z", used_at: null }, at), {
    code: "PARTNER_PENDING_ACTIVATION", state: "pending_activation", has_valid_invite: true, message: "您的承攬夥伴申請已通過，但帳號尚未完成啟用。請使用已收到的安全啟用通知。",
  });
  assert.equal(partnerWorkflowStatus({ status: "pending_contract", approved_at: "2026-08-20" }, { expires_at: "2026-08-23T10:00:00Z", used_at: null }, at).state, "invite_expired");
  assert.equal(partnerWorkflowStatus({ status: "active" }, null, at).state, "active");
  assert.equal(partnerWorkflowStatus({ status: "rejected" }, null, at).state, "rejected");
  assert.equal(partnerWorkflowStatus({ status: "suspended" }, null, at).state, "suspended");
  assert.equal(partnerWorkflowStatus({ status: "terminated" }, null, at).state, "terminated");
});

test("a starter is terminated only after two complete qualifying calendar months both miss", () => {
  const referenceDate = new Date("2026-08-01T00:05:00+08:00");
  assert.equal(shouldTerminateStarterForInactivity({
    activatedAt: "2026-05-10T09:00:00+08:00", status: "active", previousMonthSales: 0, monthBeforePreviousSales: 0, referenceDate,
  }), true);
  assert.equal(shouldTerminateStarterForInactivity({
    activatedAt: "2026-07-10T09:00:00+08:00", status: "active", previousMonthSales: 0, monthBeforePreviousSales: 0, referenceDate,
  }), false, "activation month does not count as a complete calendar month");
  assert.equal(shouldTerminateStarterForInactivity({
    activatedAt: "2026-05-10T09:00:00+08:00", status: "active", previousMonthSales: 1, monthBeforePreviousSales: 0, referenceDate,
  }), false);
  assert.equal(shouldTerminateStarterForInactivity({
    activatedAt: "2026-05-10T09:00:00+08:00", status: "terminated", previousMonthSales: 0, monthBeforePreviousSales: 0, referenceDate,
  }), false);
});

test("VIP cycles reset every three years from activation", () => {
  const activation = "2026-09-01T00:00:00+08:00";
  assert.equal(vipCycleForActivation(activation, new Date("2029-08-31T23:59:59+08:00")).cycleNo, 1);
  const cycleTwo = vipCycleForActivation(activation, new Date("2029-09-01T00:00:00+08:00"));
  assert.equal(cycleTwo.cycleNo, 2);
  assert.equal(cycleTwo.start, "2029-08-31T16:00:00.000Z");
});

test("VIP reward remains under review until 1,000 eligible distinct merchants are reached", () => {
  assert.equal(vipReviewStatusForCount(999), "tracking");
  assert.equal(vipReviewStatusForCount(1000), "pending_review");
  assert.equal(vipReviewStatusForCount(1001), "pending_review");
});
