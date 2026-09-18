import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { deriveAdminPassword } from "../src/admin-auth.js";
import { handleOwnerAuth, ownerTotp, requireOwner } from "../src/owner-auth.js";
import { handleOwnerAdmin } from "../src/owner-admin.js";

const read=(path)=>readFileSync(new URL(`../../${path}`,import.meta.url),"utf8");

class Statement {
  constructor(statement){this.statement=statement;this.values=[];}
  bind(...values){this.values=values;return this;}
  async run(){const result=this.statement.run(...this.values);return{meta:{changes:Number(result.changes||0)}};}
  async first(){return this.statement.get(...this.values)||null;}
  async all(){return{results:this.statement.all(...this.values)};}
}
class D1 {
  constructor(){
    this.sqlite=new DatabaseSync(":memory:");
    for(const name of ["0001_finance_core.sql","0002_partner_portal.sql","0009_production_admin_auth.sql","0032_owner_admin_v1.sql"]) this.sqlite.exec(readFileSync(new URL(`../migrations/${name}`,import.meta.url),"utf8"));
  }
  prepare(sql){return new Statement(this.sqlite.prepare(sql));}
  async batch(statements){return Promise.all(statements.map((statement)=>statement.run()));}
}
const cors={"access-control-allow-origin":"https://admin.baiyeconnect.com","access-control-allow-credentials":"true"};
const secret="JBSWY3DPEHPK3PXP";

async function setup(){
  const db=new D1(),salt="MDEyMzQ1Njc4OWFiY2RlZg",hash=await deriveAdminPassword("Owner-secure-password-2026",salt);
  db.sqlite.prepare("INSERT INTO admin_users(id,email,display_name,password_hash,password_salt,role) VALUES(?,?,?,?,?,'super_admin')").run("owner-1","owner@example.com","平台擁有者",hash,salt);
  db.sqlite.prepare("INSERT INTO owner_admin_users(admin_user_id) VALUES('owner-1')").run();
  return {db,env:{FINANCE_DB:db,OWNER_ADMIN_TOTP_SECRET:secret}};
}

async function login(env){
  const request=new Request("https://worker.test/api/owner/auth/login",{method:"POST",headers:{"content-type":"application/json","CF-Connecting-IP":"203.0.113.10"},body:JSON.stringify({email:"owner@example.com",password:"Owner-secure-password-2026",otp:await ownerTotp(secret)})});
  const response=await handleOwnerAuth(request,env,new URL(request.url),cors),body=await response.json();
  return {response,body,cookie:response.headers.get("set-cookie")?.split(";")[0]||""};
}

test("OA01 migration creates isolated OWNER_ADMIN role and core tables",()=>{
  const db=new D1();
  for(const name of ["owner_admin_users","owner_admin_sessions","merchant_owner_profiles","owner_contracts","website_projects","merchant_services","owner_receivables","owner_tasks","owner_documents","owner_system_monitors","owner_audit_logs"]) assert.ok(db.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name));
  assert.throws(()=>db.sqlite.prepare("INSERT INTO owner_admin_users(admin_user_id,role) VALUES('x','ADMIN')").run(),/CHECK|FOREIGN KEY/);
  assert.match(read("index.html"),/<meta name="robots" content="index,follow"/);
  assert.match(read("src/App.tsx"),/path\.startsWith\("\/owner-admin"\) \? "noindex,nofollow"/);
});

test("OA02 unauthenticated and merchant cookies cannot authorize Owner API",async()=>{
  const {env}=await setup();
  assert.equal(await requireOwner(new Request("https://worker.test/api/owner/dashboard"),env),null);
  assert.equal(await requireOwner(new Request("https://worker.test/api/owner/dashboard",{headers:{cookie:"baiye_merchant_session=fake"}}),env),null);
});

test("OA03 Owner login requires valid password and TOTP",async()=>{
  const {env}=await setup();
  const invalid=new Request("https://worker.test/api/owner/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:"owner@example.com",password:"Owner-secure-password-2026",otp:"000000"})});
  assert.equal((await handleOwnerAuth(invalid,env,new URL(invalid.url),cors)).status,401);
  const {response}=await login(env); assert.equal(response.status,200); assert.match(response.headers.get("set-cookie"),/HttpOnly; Secure; SameSite=None/);
});

test("OA04 Owner state changes require CSRF and expired sessions fail",async()=>{
  const {db,env}=await setup(),{body,cookie}=await login(env);
  const unsafe=new Request("https://worker.test/api/owner/tasks",{method:"POST",headers:{cookie}}); assert.equal(await requireOwner(unsafe,env),null);
  const safe=new Request("https://worker.test/api/owner/tasks",{method:"POST",headers:{cookie,"x-csrf-token":body.csrf_token}}); assert.equal((await requireOwner(safe,env)).role,"OWNER_ADMIN");
  db.sqlite.prepare("UPDATE owner_admin_sessions SET expires_at='2000-01-01'").run(); assert.equal(await requireOwner(new Request("https://worker.test/api/owner/dashboard",{headers:{cookie}}),env),null);
});

test("OA05 dashboard and merchant list use existing database merchants",async()=>{
  const {db,env}=await setup(); db.sqlite.prepare("INSERT INTO merchants(id,merchant_code,name,status) VALUES('m-real','REAL001','正式商家','active')").run(); const {cookie}=await login(env); const owner=await requireOwner(new Request("https://worker.test/api/owner/dashboard",{headers:{cookie}}),env);
  const dashboard=await handleOwnerAdmin(new Request("https://worker.test/api/owner/dashboard"),env,new URL("https://worker.test/api/owner/dashboard"),cors,owner); assert.equal((await dashboard.json()).metrics.merchant_total,2);
  const list=await handleOwnerAdmin(new Request("https://worker.test/api/owner/merchants"),env,new URL("https://worker.test/api/owner/merchants"),cors,owner); assert.equal((await list.json()).items.some((item)=>item.business_name==="正式商家"),true);
});

test("OA06 system assets never expose secret values",async()=>{
  const {db,env}=await setup(); db.sqlite.prepare("INSERT INTO merchants(id,merchant_code,name,status) VALUES('m','M','商家','active')").run(); db.sqlite.prepare("INSERT INTO merchant_system_assets(merchant_id,domain,secret_status_json) VALUES('m','example.com','{\"line\":\"Configured\",\"cloudflare\":\"Invalid\"}')").run(); const {cookie}=await login(env); const owner=await requireOwner(new Request("https://worker.test/api/owner/dashboard",{headers:{cookie}}),env);
  const response=await handleOwnerAdmin(new Request("https://worker.test/api/owner/merchants/m"),env,new URL("https://worker.test/api/owner/merchants/m"),cors,owner),text=await response.text(); assert.doesNotMatch(text,/token|secret_value/i); assert.match(text,/Configured/);
});

test("OA07 task write persists and creates Owner audit log",async()=>{
  const {db,env}=await setup(),{body,cookie}=await login(env); const request=new Request("https://worker.test/api/owner/tasks",{method:"POST",headers:{cookie,"x-csrf-token":body.csrf_token,"content-type":"application/json"},body:JSON.stringify({title:"檢查網域",priority:"HIGH"})}); const owner=await requireOwner(request,env); const response=await handleOwnerAdmin(request,env,new URL(request.url),cors,owner); assert.equal(response.status,201); assert.equal(db.sqlite.prepare("SELECT COUNT(*) count FROM owner_tasks").get().count,1); assert.equal(db.sqlite.prepare("SELECT COUNT(*) count FROM owner_audit_logs WHERE action='TASK_CREATE'").get().count,1);
});

test("OA08 projects, contracts, services and receivables are real audited writes",async()=>{
  const {db,env}=await setup();db.sqlite.prepare("INSERT INTO merchants(id,merchant_code,name,status) VALUES('m-write','MW','可寫入商家','active')").run();const {body,cookie}=await login(env);
  const call=async(path,method,payload)=>{const request=new Request(`https://worker.test${path}`,{method,headers:{cookie,"x-csrf-token":body.csrf_token,"content-type":"application/json"},body:JSON.stringify(payload)}),owner=await requireOwner(request,env);return handleOwnerAdmin(request,env,new URL(request.url),cors,owner);};
  assert.equal((await call("/api/owner/projects","POST",{merchant_id:"m-write"})).status,201);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) count FROM website_project_checklist").get().count,14);
  assert.equal((await call("/api/owner/services/m-write/website","PUT",{status:"ACTIVE"})).status,200);
  assert.equal((await call("/api/owner/contracts","POST",{merchant_id:"m-write",contract_name:"正式合約",contract_amount:3000000})).status,201);
  assert.equal((await call("/api/owner/receivables","POST",{merchant_id:"m-write",amount_due:3000000,amount_paid:1000000})).status,201);
  assert.equal(db.sqlite.prepare("SELECT payment_status FROM owner_receivables").get().payment_status,"PARTIAL");
  assert.ok(db.sqlite.prepare("SELECT COUNT(*) count FROM owner_audit_logs WHERE action IN ('WEBSITE_PROJECT_CREATE','SERVICE_UPDATE','CONTRACT_CREATE','RECEIVABLE_CREATE')").get().count>=4);
});

test("OA09 payment edits require a recently reauthenticated Owner session",async()=>{
  const {db,env}=await setup();db.sqlite.prepare("INSERT INTO merchants(id,merchant_code,name,status) VALUES('m-pay','MP','付款商家','active')").run();db.sqlite.prepare("INSERT INTO owner_receivables(id,merchant_id,amount_due,amount_paid,balance) VALUES('r1','m-pay',10000,0,10000)").run();const {body,cookie}=await login(env);db.sqlite.prepare("UPDATE owner_admin_sessions SET reauth_at='2000-01-01'").run();const request=new Request("https://worker.test/api/owner/receivables/r1",{method:"PATCH",headers:{cookie,"x-csrf-token":body.csrf_token,"content-type":"application/json"},body:JSON.stringify({amount_paid:10000})}),owner=await requireOwner(request,env),response=await handleOwnerAdmin(request,env,new URL(request.url),cors,owner);assert.equal(response.status,428);assert.equal((await response.json()).code,"reauth_required");
});
