const workerUrl = process.env.CONTRACT_STAGING_WORKER_URL;
const origin = process.env.CONTRACT_STAGING_ORIGIN;
if (!workerUrl?.includes("contract-signing-staging") || !origin?.includes("contract-signing-staging.pages.dev")) throw new Error("Staging-only guard rejected target");
const suffix = String(Date.now()).slice(-7);
const phone = `093${suffix}`;
const call = async (path, options = {}) => {
  const response = await fetch(`${workerUrl}${path}`, { ...options, headers: { Origin: origin, ...(options.body ? { "content-type": "application/json" } : {}), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  return { response, data };
};
const joinBody = JSON.stringify({ phone, privacy_consent: true, consent_version: "platform-membership-privacy-v1", device_id: `staging-device-${suffix}` });
const first = await call("/api/members/join", { method: "POST", body: joinBody, headers: { "x-device-id": `staging-device-${suffix}` } });
if (first.response.status !== 201 || !first.data.new_member || !first.data.session?.token || first.data.coupon?.discount_value_minor !== 10000 || !first.data.welcome?.show) throw new Error(`First join failed: ${JSON.stringify(first.data)}`);
const token = first.data.session.token;
const me = await call("/api/members/me", { headers: { authorization: `Bearer ${token}` } });
const coupons = await call("/api/members/coupons", { headers: { authorization: `Bearer ${token}` } });
const same = await call("/api/members/join", { method: "POST", body: joinBody, headers: { authorization: `Bearer ${token}`, "x-device-id": `staging-device-${suffix}` } });
const hijack = await call("/api/members/join", { method: "POST", body: joinBody, headers: { "x-device-id": `other-device-${suffix}` } });
const redeem = await call("/api/members/coupons/redeem", { method: "POST", body: "{}", headers: { authorization: `Bearer ${token}` } });
const acknowledge = await call("/api/members/welcome/acknowledge", { method: "POST", body: "{}", headers: { authorization: `Bearer ${token}` } });
const result = {
  first_join: first.response.status === 201,
  no_name_email_password: true,
  member_created: Boolean(first.data.member?.id),
  token_returned: Boolean(token),
  token_not_in_member_payload: !JSON.stringify(first.data.member).includes(token),
  welcome: first.data.welcome?.show === true,
  coupon_claimed: coupons.data.coupons?.length === 1 && coupons.data.coupons[0].discount_value_minor === 10000,
  member_center_masked: me.response.status === 200 && !JSON.stringify(me.data).includes(phone),
  same_session_reuse: same.response.status === 200 && same.data.new_member === false,
  no_second_welcome: same.data.welcome?.show === false,
  account_takeover_blocked: hijack.response.status === 409 && hijack.data.code === "MEMBER_VERIFICATION_REQUIRED",
  redemption_locked: redeem.response.status === 409 && redeem.data.code === "PLATFORM_COUPON_REDEMPTION_DISABLED",
  welcome_acknowledged: acknowledge.response.ok,
};
if (Object.values(result).some((value) => value !== true)) throw new Error(`Membership Staging E2E failed: ${JSON.stringify(result)}`);
console.log(JSON.stringify({ ok: true, phone_masked: first.data.member.phone_masked, ...result }));
