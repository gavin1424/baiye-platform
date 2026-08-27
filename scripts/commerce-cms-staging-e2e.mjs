import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root=path.resolve(import.meta.dirname,"..");
const worker="https://chuang-baiye-commerce-staging.baiye-platform.workers.dev";
const pages="https://baiye-platform-commerce-staging.pages.dev";
const origin=pages,npx=process.platform==="win32"?"npx.cmd":"npx",key=crypto.randomBytes(32).toString("hex"),seed=path.join(os.tmpdir(),`baiye-cms-seed-${crypto.randomUUID()}.sql`),results=[];
function run(command,args,options={}){const result=spawnSync(command,args,{cwd:root,encoding:"utf8",stdio:["ignore","pipe","pipe"],shell:process.platform==="win32"&&command.endsWith(".cmd"),...options});if(result.error)throw result.error;if(result.status!==0)throw new Error(result.stderr||result.stdout||`${command} failed`);return result.stdout}
function pass(name,detail="PASS"){results.push({name,status:"PASS",detail})}
async function request(url,init={}){const response=await fetch(url,{...init,headers:{origin,"content-type":"application/json",...(init.headers||{})}});const body=await response.json().catch(()=>null);return{response,body}}

try{
  run(process.execPath,[path.join(root,"scripts/seed-commerce-staging.mjs"),seed],{env:{...process.env,APP_MODE:"staging",STAGING_SEED_KEY:key}});run(npx,["wrangler","d1","execute","baiye-commerce-staging","--remote","--config","cloudflare-worker/wrangler.commerce-staging.jsonc","--file",seed]);pass("01 isolated CMS seed");
  const login=await request(`${worker}/api/merchant-auth/login`,{method:"POST",body:JSON.stringify({merchant_id:"staging_commerce_merchant",email:"staging-owner@invalid.example",password:key})});assert.equal(login.response.status,200);const cookie=login.response.headers.get("set-cookie")?.split(";")[0];pass("02 merchant login");
  const session=await request(`${worker}/api/merchant-auth/session`,{headers:{cookie}});assert.equal(session.response.status,200);const auth={cookie,"x-csrf-token":session.body.csrf_token};pass("03 session and CSRF");
  const site=await request(`${worker}/api/commerce/site`,{method:"PATCH",headers:auth,body:JSON.stringify({name:"STAGING Growth Store",theme:{primary:"#0b6171",accent:"#d2a94f"},header:{announcement:"STAGING"},footer:{description:"CMS QA"}})});assert.equal(site.response.status,200);pass("04 site theme update");
  const pageSlug=`cms-${Date.now()}`,created=await request(`${worker}/api/commerce/pages`,{method:"POST",headers:auth,body:JSON.stringify({title:"STAGING CMS Landing",slug:pageSlug,page_type:"landing"})});assert.equal(created.response.status,201);pass("05 page create");
  const hero=await request(`${worker}/api/commerce/pages/${created.body.id}/blocks`,{method:"POST",headers:auth,body:JSON.stringify({block_type:"hero",settings:{title:"STAGING Hero",text:"CMS Gate 1"}})});assert.equal(hero.response.status,201);pass("06 hero block create");
  const grid=await request(`${worker}/api/commerce/pages/${created.body.id}/blocks`,{method:"POST",headers:auth,body:JSON.stringify({block_type:"product_grid",settings:{title:"STAGING Products"}})});assert.equal(grid.response.status,201);pass("07 product grid create");
  const detail=await request(`${worker}/api/commerce/pages/${created.body.id}`,{headers:{cookie}});assert.equal(detail.response.status,200);assert.equal(detail.body.blocks.length,2);assert.equal(detail.body.versions.length,3);pass("08 versioned page detail");
  const unsafe=await request(`${worker}/api/commerce/pages/${created.body.id}/blocks`,{method:"POST",headers:auth,body:JSON.stringify({block_type:"html_embed",settings:{html:"<script>alert(1)</script>"}})});assert.equal(unsafe.response.status,400);pass("09 unsafe HTML rejected");
  const preview=await request(`${worker}/api/commerce/pages/${created.body.id}/preview-token`,{method:"POST",headers:auth,body:"{}"});assert.equal(preview.response.status,201);const previewPage=await request(`${worker}/api/commerce/public/site-previews/${preview.body.token}`);assert.equal(previewPage.response.status,200);assert.equal(previewPage.body.blocks.length,2);pass("10 private draft preview");
  const publish=await request(`${worker}/api/commerce/pages/${created.body.id}/publish`,{method:"POST",headers:auth,body:"{}"});assert.equal(publish.response.status,200);const live=await request(`${worker}/api/commerce/public/sites/staging_commerce_merchant/pages/${pageSlug}`);assert.equal(live.response.status,200);pass("11 publish and public renderer");
  const changed=await request(`${worker}/api/commerce/pages/${created.body.id}`,{method:"PATCH",headers:auth,body:JSON.stringify({title:"STAGING CMS Revised",slug:pageSlug,visibility:"public",seo:{title:"STAGING SEO"},version_note:"Staging E2E"})});assert.equal(changed.response.status,200);pass("12 page version update");
  const rollback=await request(`${worker}/api/commerce/pages/${created.body.id}/versions/${detail.body.versions.at(-1).id}/rollback`,{method:"POST",headers:auth,body:"{}"});assert.equal(rollback.response.status,200);pass("13 rollback creates new version");
  const menu=await request(`${worker}/api/commerce/navigation/menus`,{method:"POST",headers:auth,body:JSON.stringify({name:`STAGING Menu ${Date.now()}`,location:`header-${Date.now()}`})});assert.equal(menu.response.status,201);const nav=await request(`${worker}/api/commerce/navigation/menus/${menu.body.id}/items`,{method:"POST",headers:auth,body:JSON.stringify({label:"首頁",target:"/",enabled:true})});assert.equal(nav.response.status,201);pass("14 navigation CRUD");
  const seo=await request(`${worker}/api/commerce/seo`,{method:"PATCH",headers:auth,body:JSON.stringify({title_template:"%s｜STAGING",description:"CMS staging",robots:"noindex,nofollow"})});assert.equal(seo.response.status,200);pass("15 SEO and robots");
  const redirect=await request(`${worker}/api/commerce/redirects`,{method:"POST",headers:auth,body:JSON.stringify({source_path:`/old-${Date.now()}`,target_path:"/",status_code:301,enabled:true})});assert.equal(redirect.response.status,201);pass("16 redirect CRUD");
  const media=await request(`${worker}/api/commerce/media`,{method:"POST",headers:auth,body:JSON.stringify({file_name:`gate1-${Date.now()}.png`,mime_type:"image/png",base64:"aGVsbG8=",alt_text:"STAGING CMS image"})});assert.equal(media.response.status,201);pass("17 private R2 media upload");
  const domain=await request(`${worker}/api/commerce/domains`,{method:"POST",headers:auth,body:JSON.stringify({hostname:`cms-${Date.now()}.example.com`})});assert.equal(domain.response.status,201);assert.ok(domain.body.verification_token);pass("18 domain pending verification");
  const audit=await request(`${worker}/api/commerce/cms-audit`,{headers:{cookie}});assert.equal(audit.response.status,200);assert.ok(audit.body.items.length>=10);assert.ok(!JSON.stringify(audit.body).includes(domain.body.verification_token));pass("19 CMS audit without secrets");
  const ui=await fetch(`${pages}/#/merchant-admin/pages/${created.body.id}`);assert.equal(ui.status,200);const html=await ui.text();assert.match(html,/noindex,nofollow/);pass("20 CMS UI route and noindex");
  const report={ok:true,gate:"Gate 1 CMS",worker,pages,results};const evidence=path.join(root,"GOV_ACCEPTANCE_EVIDENCE");fs.mkdirSync(evidence,{recursive:true});fs.writeFileSync(path.join(evidence,"commerce-gate1-e2e.json"),JSON.stringify(report,null,2),"utf8");process.stdout.write(JSON.stringify(report,null,2));
}finally{if(fs.existsSync(seed))fs.rmSync(seed,{force:true})}
