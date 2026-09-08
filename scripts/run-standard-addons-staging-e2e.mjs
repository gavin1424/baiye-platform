import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const worker = "https://chuang-baiye-contract-signing-staging.baiye-platform.workers.dev";
const origin = "https://baiye-platform-contract-signing-staging.pages.dev";
if (!process.argv.includes("--staging-only") || !worker.includes("contract-signing-staging") || !origin.includes("contract-signing-staging.pages.dev")) throw new Error("STAGING_ONLY guard rejected target");
const id = Date.now().toString(36), merchantId = `addon-v2-${id}`, userId = `addon-user-${id}`, adminId = `addon-admin-${id}`;
const merchantToken = randomUUID() + randomUUID(), merchantCsrf = randomUUID() + randomUUID(), adminToken = randomUUID() + randomUUID(), adminCsrf = randomUUID() + randomUUID();
const hash = (value) => createHash("sha256").update(value).digest("base64url");
const q = (value) => `'${String(value).replaceAll("'", "''")}'`;
const sql = `PRAGMA foreign_keys=ON;
INSERT INTO admin_users(id,email,display_name,password_hash,password_salt,role,status) VALUES(${q(adminId)},${q(`${adminId}@staging.invalid`)},'STAGING Add-on Admin','DISABLED','DISABLED','super_admin','active');
INSERT INTO admin_sessions(id,admin_user_id,token_hash,csrf_hash,expires_at) VALUES(${q(`admin-session-${id}`)},${q(adminId)},${q(hash(adminToken))},${q(hash(adminCsrf))},datetime('now','+2 hours'));
INSERT INTO merchants(id,merchant_code,name,contact_name,phone,email,status) VALUES(${q(merchantId)},${q(merchantId)},'STAGING 美玲拼布 Add-on V2','美玲','0900000025',${q(`${merchantId}@staging.invalid`)},'active');
INSERT INTO merchant_users(id,merchant_id,email,password_hash,password_salt,status,display_name,phone_normalized,auth_mode) VALUES(${q(userId)},${q(merchantId)},${q(`${userId}@staging.invalid`)},'PASSWORDLESS_DISABLED','','active','美玲','0900000025','passwordless_phone');
INSERT INTO merchant_roles(id,merchant_id,code,name,is_system) VALUES(${q(`role-${id}`)},${q(merchantId)},'owner','管理者',1);
INSERT INTO merchant_user_roles(merchant_id,user_id,role_id) VALUES(${q(merchantId)},${q(userId)},${q(`role-${id}`)});
INSERT INTO merchant_user_sessions(id,merchant_id,user_id,token_hash,csrf_hash,expires_at,assurance_level,issued_via) VALUES(${q(`merchant-session-${id}`)},${q(merchantId)},${q(userId)},${q(hash(merchantToken))},${q(hash(merchantCsrf))},datetime('now','+2 hours'),'verified_phone','staging_e2e');
INSERT INTO merchant_contract_commercial_terms(id,merchant_id,plan_code,plan_name,list_price_minor,discount_price_minor,currency,contract_term_months,payment_plan,upfront_amount_minor,offset_target_amount_minor,tax_reserve_enabled,withholding_enabled,included_services_json,excluded_services_json,attachments_json,start_date,service_period_end,renewal_terms,status,created_by,approved_by,approved_at,terms_hash,source_preset_id) VALUES(${q(`terms-${id}`)},${q(merchantId)},'baiye_standard_18000_addons','NT$18,000 標準版＋加價購',1800000,1800000,'TWD',24,'upfront_18000',1800000,0,0,0,'[]','[]','{}','2026-09-02','2028-09-01','STAGING','approved','staging','staging',CURRENT_TIMESTAMP,'staging-terms','baiye_standard_18000_addons');
INSERT INTO merchant_contract_invites(id,merchant_id,commercial_terms_id,email,token_hash,expires_at,used_at,created_by) VALUES(${q(`invite-${id}`)},${q(merchantId)},${q(`terms-${id}`)},${q(`${merchantId}@staging.invalid`)},${q(`invite-hash-${id}`)},'2099-01-01',CURRENT_TIMESTAMP,'staging');
INSERT INTO merchant_contract_signatures(id,public_id,merchant_id,merchant_user_id,contract_version_id,commercial_terms_id,signatory_legal_name,signatory_role,legal_representative_name,company_name,signed_at,contract_content_hash,commercial_terms_hash,signature_hash,signature_data,document_hash,pdf_hash,consent_version,invite_id,session_id_hash,r2_key,evidence_object_key,status) VALUES(${q(`main-${id}`)},${q(`MAIN-${id}`)},${q(merchantId)},${q(userId)},'merchant_service_v1_2_18000_addons',${q(`terms-${id}`)},'美玲','legal_representative','美玲','STAGING 美玲拼布',CURRENT_TIMESTAMP,'content','terms','signature','{}','document','pdf','v2',${q(`invite-${id}`)},'session','main.pdf','main.json','VALID');`;
const dir = mkdtempSync(join(tmpdir(),"baiye-addon-v2-")), file = join(dir,"seed.sql"); writeFileSync(file,sql,"utf8");
try { const executable=process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "npx"; const prefix=process.platform === "win32" ? ["/d","/s","/c","npx"] : []; execFileSync(executable,[...prefix,"wrangler","d1","execute","baiye-contract-signing-staging","--remote","--config","wrangler.contract-staging.jsonc",`--file=${file}`],{cwd:"cloudflare-worker",stdio:"pipe"}); } finally { rmSync(dir,{recursive:true,force:true}); }
const call = async (path,{admin=false,method="GET",body}={}) => { const response=await fetch(worker+path,{method,headers:{Origin:origin,"content-type":"application/json",cookie:`${admin?"baiye_admin_session":"baiye_merchant_session"}=${admin?adminToken:merchantToken}`,"x-csrf-token":admin?adminCsrf:merchantCsrf},...(body?{body:JSON.stringify(body)}:{})}); const type=response.headers.get("content-type")||""; const value=type.includes("json")?await response.json():new Uint8Array(await response.arrayBuffer()); if(!response.ok) throw new Error(`${path} ${response.status} ${JSON.stringify(value)}`); return {response,value}; };
const change=await call("/api/merchant-admin/content-change-requests",{method:"POST",body:{items:"STAGING 替換首頁與新增商品",text:"美玲拼布模式",images:["https://example.test/staging.jpg"]}});
const cases=[
  ["simple_cart",1,undefined,2600000],
  ["external_checkout_cart",1,undefined,3200000],
  ["bulk_products_50",50,undefined,2100000],
  ["payment_api",1,2500000,4300000],
  ["custom_page",1,900000,2700000],
];
const quotes=[]; for(const [code,quantity,quoted_amount_minor,total] of cases){const result=await call("/api/admin/addon-quotes",{admin:true,method:"POST",body:{merchant_id:merchantId,change_request_id:code==="simple_cart"?change.value.id:undefined,contract_total_minor:1,items:[{code,quantity,quoted_amount_minor}]}});if(result.value.contract_total_minor!==total)throw new Error(`${code} total mismatch`);quotes.push(result.value);}
const accepted=await call(`/api/merchant-admin/addon-quotes/${quotes[0].id}/accept`,{method:"POST",body:{}});
const signature={strokes:[[[10,10],[30,30],[50,15],[70,35]],[[15,55],[35,75],[55,60],[80,80]]]};
const signed=await call(`/api/merchant-admin/addenda/${accepted.value.addendum_id}/sign`,{method:"POST",body:{signatory_legal_name:"美玲",signatory_role:"legal_representative",signature,read:true,electronic:true,commercial_terms:true,authority:true,signature_evidence:true}});
const pdf=await call(`/api/merchant-admin/addenda/${accepted.value.addendum_id}/pdf`); if(!String.fromCharCode(...pdf.value.slice(0,4)).startsWith("%PDF"))throw new Error("PDF signature missing");
await call(`/api/admin/addenda/${accepted.value.addendum_id}/payment`,{admin:true,method:"PATCH",body:{payment_status:"PAID"}});
const verification=await call(`/api/contract-verification/${signed.value.public_id}`); if(verification.value.contract_type!=="MERCHANT_CONTRACT_ADDENDUM")throw new Error("verification mismatch");
console.log(JSON.stringify({ok:true,environment:"STAGING_ONLY",merchant_id:merchantId,content_change_request:"PASS",quotes:cases.map((item,index)=>({code:item[0],contract_total_minor:quotes[index].contract_total_minor})),addendum:accepted.value.addendum_id,signature:"PASS",pdf_bytes:pdf.value.length,payment_status:"PAID",audit:"PASS"},null,2));
