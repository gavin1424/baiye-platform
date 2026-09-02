import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { assignMerchantPlan, handleMerchantPlans, listMerchantPlans, merchantPlanEntitlements } from "../src/merchant-plan-catalog.js";

class Statement { constructor(statement){this.statement=statement;this.values=[];} bind(...values){this.values=values;return this;} async run(){const result=this.statement.run(...this.values);return{meta:{changes:Number(result.changes||0)}};} async first(){return this.statement.get(...this.values)||null;} async all(){return{results:this.statement.all(...this.values)}} }
class D1 { constructor(){this.sqlite=new DatabaseSync(":memory:");for(const name of readdirSync(new URL("../migrations",import.meta.url)).filter((item)=>/^\d+.*\.sql$/.test(item)).sort())this.sqlite.exec(readFileSync(new URL(`../migrations/${name}`,import.meta.url),"utf8").replace(/\r\n/g,"\n"));} prepare(sql){return new Statement(this.sqlite.prepare(sql));} async batch(items){const results=[];for(const item of items)results.push(await item.run());return results;} }

function seedMerchant(db,id="merchant-unified",userId="owner-unified") {
  db.sqlite.prepare("INSERT INTO merchants(id,merchant_code,name,phone,status) VALUES(?,?,?,'0911222333','registration_started')").run(id,`M-${id}`,"整合測試商家");
  db.sqlite.prepare("INSERT INTO merchant_users(id,merchant_id,email,password_hash,password_salt,status,display_name,phone_normalized,auth_mode) VALUES(?,?,?,'DISABLED','','active','管理者','0911222333','passwordless_phone')").run(userId,id,`${userId}@test.invalid`);
  db.sqlite.prepare("INSERT INTO merchant_onboarding_states(merchant_id,registration_mode,state,operation_locked,commercial_terms_approval_required) VALUES(?,'standard_self_service','registered',1,0)").run(id);
  return { id, userId };
}

test("UNIFIED-01 migrations are unique and ordered from Merchant Admin through unified center", () => {
  const names = readdirSync(new URL("../migrations",import.meta.url)).filter((name)=>/^002[3-7].*\.sql$/.test(name)).sort();
  assert.deepEqual(names,["0023_merchant_admin_v1.sql","0024_contract_commerce_ai_45000.sql","0025_contract_softpos_24000.sql","0026_contract_standard_addons.sql","0027_unified_registration_contract_center.sql"]);
});

test("UNIFIED-02 public server catalog exposes exactly the three immutable plans", async () => {
  const db=new D1(),plans=await listMerchantPlans(db);
  assert.deepEqual(plans.map((plan)=>plan.plan_id),["baiye_standard_18000_addons","baiye_commerce_ai_45000","baiye_softpos_24000"]);
  assert.deepEqual(plans.map((plan)=>plan.contract_version),["merchant_service_v1_2_18000_addons","merchant_commerce_ai_v1_0_45000","merchant_softpos_v1_0_24000"]);
  assert.deepEqual(plans.map((plan)=>plan.price_minor),[1800000,4500000,2400000]);
});

test("UNIFIED-03 assignment ignores tampered client prices and uses server values", async () => {
  const db=new D1(),merchant=seedMerchant(db);
  const authorization={session:{merchant_id:merchant.id,user_id:merchant.userId}};
  const request=new Request("https://worker.test/api/merchant/plans/select",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({plan_id:"baiye_commerce_ai_45000",plan_price:1,discount:4499999,deposit:1,cycle_fee:1,installment_plan_requested:24})});
  const response=await handleMerchantPlans(request,{FINANCE_DB:db},new URL(request.url),{},authorization);const data=await response.json();
  assert.equal(response.status,201);assert.equal(data.plan.price_minor,4500000);assert.equal(data.payment_transaction_created,false);
  const terms=db.sqlite.prepare("SELECT * FROM merchant_contract_commercial_terms WHERE id=?").get(data.commercial_terms_id);
  assert.deepEqual([terms.list_price_minor,terms.discount_price_minor,terms.installment_plan_requested],[4500000,4500000,24]);
});

test("UNIFIED-04 SoftPOS math is integer minor-unit data and Trial is outside paid cycle", async () => {
  const db=new D1(),merchant=seedMerchant(db,"merchant-softpos-unified","owner-softpos-unified");
  const result=await assignMerchantPlan(db,merchant.id,merchant.userId,"baiye_softpos_24000",24);
  const plan=result.plan;
  assert.deepEqual([plan.activation_fee_minor,plan.deposit_minor,plan.trial_months,plan.term_months,plan.cycle_fee_minor,plan.first_cycle_credit_minor,plan.first_cycle_balance_minor,plan.renewal_fee_minor],[300000,600000,3,24,2400000,600000,1800000,2400000]);
  assert.equal(plan.activation_fee_minor+plan.deposit_minor,900000);assert.equal(plan.cycle_fee_minor-plan.first_cycle_credit_minor,plan.first_cycle_balance_minor);assert.equal(plan.cycle_fee_minor/plan.term_months,100000);
  const terms=db.sqlite.prepare("SELECT start_date,service_period_end,attachments_json FROM merchant_contract_commercial_terms WHERE id=?").get(result.commercial_terms_id);
  assert.equal(JSON.parse(terms.attachments_json).trial_months,3);
});

test("UNIFIED-05 entitlements distinguish standard, commerce and SoftPOS", async () => {
  for (const [index,planId] of ["baiye_standard_18000_addons","baiye_commerce_ai_45000","baiye_softpos_24000"].entries()) {
    const db=new D1(),merchant=seedMerchant(db,`merchant-ent-${index}`,`owner-ent-${index}`);await assignMerchantPlan(db,merchant.id,merchant.userId,planId,24);const flags=await merchantPlanEntitlements(db,merchant.id);
    if (index===0) assert.deepEqual([flags.merchant_content_editable,flags.merchant_product_editable,flags.base_product_limit],[false,false,20]);
    if (index===1) assert.deepEqual([flags.merchant_content_editable,flags.merchant_product_editable,flags.commerce_full,flags.cart_enabled],[true,true,true,true]);
    if (index===2) assert.deepEqual([flags.softpos_enabled,flags.ordering_enabled,flags.kds_enabled],[true,true,true]);
  }
});

test("UNIFIED-06 signed plan cannot be overwritten by another plan", async () => {
  const db=new D1(),merchant=seedMerchant(db,"merchant-signed-unified","owner-signed-unified");const assigned=await assignMerchantPlan(db,merchant.id,merchant.userId,"baiye_standard_18000_addons",24);
  const invite=db.sqlite.prepare("SELECT id FROM merchant_contract_invites WHERE merchant_id=? AND commercial_terms_id=?").get(merchant.id,assigned.commercial_terms_id);
  db.sqlite.prepare(`INSERT INTO merchant_contract_signatures(id,public_id,merchant_id,merchant_user_id,contract_version_id,commercial_terms_id,signatory_legal_name,signatory_role,legal_representative_name,company_name,signed_at,contract_content_hash,commercial_terms_hash,signature_hash,signature_data,document_hash,pdf_hash,consent_version,invite_id,session_id_hash,r2_key,evidence_object_key,status)
    VALUES('signed-unified','SIGNED-UNIFIED',?,?,?,?,'管理者','legal_representative','管理者','整合測試商家',CURRENT_TIMESTAMP,'content','terms','signature','{}','document','pdf','consent',?,'session','signed.pdf','signed.json','VALID')`)
    .run(merchant.id,merchant.userId,"merchant_service_v1_2_18000_addons",assigned.commercial_terms_id,invite.id);
  await assert.rejects(()=>assignMerchantPlan(db,merchant.id,merchant.userId,"baiye_commerce_ai_45000",24),(error)=>error.code==="ACTIVE_PLAN_EXISTS");
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) count FROM merchant_contract_signatures WHERE merchant_id=?").get(merchant.id).count,1);
});

test("UNIFIED-07 historical evidence tables and legacy versions remain present", () => {
  const db=new D1();
  for(const table of ["merchant_contract_signatures","merchant_contract_artifacts","contract_signatures","contract_version_classifications"])assert.ok(db.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table));
  const current=db.sqlite.prepare("SELECT COUNT(*) count FROM contract_version_classifications WHERE domain='merchant' AND classification='CURRENT_SELECTABLE'").get().count;
  assert.equal(current,3);assert.ok(db.sqlite.prepare("SELECT id FROM merchant_contract_versions WHERE id='merchant_service_v1_1_18000'").get());
});

test("UNIFIED-08 UI has one join center, selector and no split merchant contract routes", () => {
  const app=readFileSync(new URL("../../src/App.tsx",import.meta.url),"utf8"),join=readFileSync(new URL("../../src/pages/JoinPages.tsx",import.meta.url),"utf8");
  for(const phrase of ["加入創百業智慧鏈","商家免費註冊","承攬夥伴簽約","前 3 個月免費","選擇 NT\\$18,000 方案","選擇 NT\\$45,000 商城","申請免 POS 機方案"])assert.match(join,new RegExp(phrase));
  assert.match(app,/path="\/join" element={<JoinPage/);assert.match(app,/path="\/merchant\/contract"/);assert.doesNotMatch(app,/contract-(?:18|45|pos)/);
});

test("UNIFIED-09 ordering writes are entitlement-gated instead of globally blocked", () => {
  const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
  assert.match(source, /if \(!entitlements\.merchant_product_edit\)/);
  assert.doesNotMatch(source, /\/ordering\\\/\(categories\|items\|option-groups\).*MERCHANT_CONTENT_EDIT_DISABLED/);
});

test("UNIFIED-10 runtime Noto Sans TC assets use per-document glyph subsetting", () => {
  const source = readFileSync(new URL("../src/contract-font-assets.js", import.meta.url), "utf8");
  assert.match(source, /subsetSafe: true/);
  assert.match(source, /44cc404d8cea929c02a92900a646598bafc9ef726b7d881e7525296adc9fb8ac/);
});

test("UNIFIED-11 merchant dashboard reports the server-assigned plan code", () => {
  const source = readFileSync(new URL("../src/merchant-admin.js", import.meta.url), "utf8");
  assert.match(source, /SELECT t\.plan_code,t\.plan_name,t\.discount_price_minor/);
  assert.match(source, /code: plan\.plan_code/);
});
