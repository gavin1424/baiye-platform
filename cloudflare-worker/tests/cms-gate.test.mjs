import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { handleCommerce } from "../src/commerce-core.js";

class Statement { constructor(db,sql){this.db=db;this.sql=sql;this.values=[]} bind(...values){this.values=values;return this} first(){return this.db.prepare(this.sql).get(...this.values)||null} all(){return {results:this.db.prepare(this.sql).all(...this.values)}} run(){const result=this.db.prepare(this.sql).run(...this.values);return {success:true,meta:{changes:Number(result.changes)}}} }
class D1 { constructor(db){this.db=db} prepare(sql){return new Statement(this.db,sql)} batch(statements){this.db.exec("BEGIN IMMEDIATE");try{const result=statements.map(statement=>statement.run());this.db.exec("COMMIT");return result}catch(error){this.db.exec("ROLLBACK");throw error}} }
class R2 { constructor(){this.objects=new Map()} async put(key,value,metadata){this.objects.set(key,{value,metadata})} async delete(key){this.objects.delete(key)} }
function setup(){const sqlite=new DatabaseSync(":memory:");sqlite.exec("PRAGMA foreign_keys=ON");const root=path.resolve("cloudflare-worker/migrations");for(const file of fs.readdirSync(root).filter(file=>/^\d+.*\.sql$/.test(file)).sort())sqlite.exec(fs.readFileSync(path.join(root,file),"utf8"));sqlite.exec(`INSERT INTO merchants(id,merchant_code,name,status) VALUES('cms_a','CMSA','CMS A','active'),('cms_b','CMSB','CMS B','active'); INSERT INTO merchant_sites(id,merchant_id,name,status) VALUES('site_a','cms_a','Site A','draft'),('site_b','cms_b','Site B','draft');`);return {sqlite,db:new D1(sqlite),assets:new R2()}}
function req(pathname,method="GET",body,headers={}){return new Request(`https://cms.test${pathname}`,{method,headers:{origin:"https://cms.test","content-type":"application/json",...headers},body:body===undefined?undefined:JSON.stringify(body)})}
async function call(env,pathname,method="GET",body,merchant="cms_a",headers={}){const request=req(pathname,method,body,headers);const response=await handleCommerce(request,env,new URL(request.url),{},pathname.includes("/public/")?null:{merchant_id:merchant,user_id:`user_${merchant}`});const payload=await response.json().catch(()=>null);return {response,body:payload}}

test("CMS page CRUD creates immutable versions, block snapshots and rollback",async()=>{const{sqlite,db,assets}=setup(),env={FINANCE_DB:db,COMMERCE_ASSETS:assets};
  const created=await call(env,"/api/commerce/pages","POST",{title:"品牌首頁",slug:"brand-home",page_type:"landing"});assert.equal(created.response.status,201);
  const hero=await call(env,`/api/commerce/pages/${created.body.id}/blocks`,"POST",{block_type:"hero",settings:{title:"正式品牌",text:"真實內容"}});assert.equal(hero.response.status,201);
  const grid=await call(env,`/api/commerce/pages/${created.body.id}/blocks`,"POST",{block_type:"product_grid",settings:{title:"熱門商品"}});assert.equal(grid.response.status,201);
  let detail=await call(env,`/api/commerce/pages/${created.body.id}`);assert.equal(detail.body.blocks.length,2);assert.equal(detail.body.versions.length,3);const rollbackId=detail.body.versions.at(-1).id;
  const changed=await call(env,`/api/commerce/pages/${created.body.id}`,"PATCH",{title:"新版首頁",slug:"brand-home",visibility:"public",seo:{title:"新版 SEO"},version_note:"QA update"});assert.equal(changed.response.status,200);
  detail=await call(env,`/api/commerce/pages/${created.body.id}`);assert.equal(detail.body.title,"新版首頁");assert.equal(detail.body.versions.length,4);
  const rollback=await call(env,`/api/commerce/pages/${created.body.id}/versions/${rollbackId}/rollback`,"POST",{});assert.equal(rollback.response.status,200);
  detail=await call(env,`/api/commerce/pages/${created.body.id}`);assert.equal(detail.body.title,"品牌首頁");assert.equal(detail.body.blocks.length,0);assert.equal(detail.body.versions.length,5);
  const unsafe=await call(env,`/api/commerce/pages/${created.body.id}/blocks`,"POST",{block_type:"html_embed",settings:{html:"<script>alert(1)</script>"}});assert.equal(unsafe.response.status,400);assert.equal(unsafe.body.error,"UNSAFE_HTML_EMBED");
  const preview=await call(env,`/api/commerce/pages/${created.body.id}/preview-token`,"POST",{});assert.equal(preview.response.status,201);const previewPage=await call(env,`/api/commerce/public/site-previews/${preview.body.token}`);assert.equal(previewPage.response.status,200);
  const publish=await call(env,`/api/commerce/pages/${created.body.id}/publish`,"POST",{});assert.equal(publish.response.status,200);const live=await call(env,"/api/commerce/public/sites/cms_a/pages/brand-home");assert.equal(live.response.status,200);
  assert.throws(()=>sqlite.prepare("UPDATE merchant_page_versions SET version_note='tampered' WHERE id=?").run(publish.body.version_id),/immutable/);
  const remove=await call(env,`/api/commerce/pages/${created.body.id}`,"DELETE");assert.equal(remove.response.status,409);
  assert.ok(sqlite.prepare("SELECT COUNT(*) n FROM merchant_cms_audit_logs WHERE merchant_id='cms_a'").get().n>=7);
});

test("CMS resources enforce merchant isolation and validate operational settings",async()=>{const{sqlite,db,assets}=setup(),env={FINANCE_DB:db,COMMERCE_ASSETS:assets};
  const page=await call(env,"/api/commerce/pages","POST",{title:"A Page",slug:"a-page"});assert.equal(page.response.status,201);
  assert.equal((await call(env,`/api/commerce/pages/${page.body.id}`,"GET",undefined,"cms_b")).response.status,404);
  const site=await call(env,"/api/commerce/site","PATCH",{name:"CMS A Store",theme:{primary:"#123456"},header:{announcement:"公告"},footer:{description:"頁尾"}});assert.equal(site.response.status,200);assert.equal((await call(env,"/api/commerce/site")).body.theme.primary,"#123456");
  const menu=await call(env,"/api/commerce/navigation/menus","POST",{name:"主選單",location:"header"});assert.equal(menu.response.status,201);const item=await call(env,`/api/commerce/navigation/menus/${menu.body.id}/items`,"POST",{label:"關於",target:"/about",enabled:true});assert.equal(item.response.status,201);assert.equal((await call(env,"/api/commerce/navigation/menus")).body.items[0].items.length,1);
  const badTarget=await call(env,`/api/commerce/navigation/menus/${menu.body.id}/items`,"POST",{label:"惡意",target:"https://evil.test",enabled:true});assert.equal(badTarget.response.status,400);
  assert.equal((await call(env,"/api/commerce/seo","PATCH",{title_template:"%s｜CMS A",description:"商家說明",robots:"index,follow"})).response.status,200);
  assert.equal((await call(env,"/api/commerce/redirects","POST",{source_path:"/old",target_path:"/new",status_code:301,enabled:true})).response.status,201);
  assert.equal((await call(env,"/api/commerce/redirects","POST",{source_path:"/same",target_path:"/same",status_code:301})).response.status,400);
  const domain=await call(env,"/api/commerce/domains","POST",{hostname:"shop.example.com"});assert.equal(domain.response.status,201);assert.ok(domain.body.verification_token);const stored=sqlite.prepare("SELECT verification_token_hash FROM merchant_domains WHERE id=?").get(domain.body.id);assert.notEqual(stored.verification_token_hash,domain.body.verification_token);
  const media=await call(env,"/api/commerce/media","POST",{file_name:"hero.png",mime_type:"image/png",base64:"aGVsbG8=",alt_text:"品牌主視覺"});assert.equal(media.response.status,201);assert.equal(assets.objects.size,1);assert.equal((await call(env,"/api/commerce/media","GET",undefined,"cms_b")).body.items.length,0);
  const audit=await call(env,"/api/commerce/cms-audit");assert.ok(audit.body.items.every(entry=>!JSON.stringify(entry).includes("verification_token")));
});

test("scheduled pages stay private until publication time and unpublished drafts can be deleted",async()=>{const{sqlite,db,assets}=setup(),env={FINANCE_DB:db,COMMERCE_ASSETS:assets};
  const page=await call(env,"/api/commerce/pages","POST",{title:"排程頁",slug:"scheduled-page"});const future=new Date(Date.now()+86400000).toISOString();const publish=await call(env,`/api/commerce/pages/${page.body.id}/publish`,"POST",{publish_at:future});assert.equal(publish.response.status,200);assert.equal(sqlite.prepare("SELECT status FROM merchant_site_pages WHERE id=?").get(page.body.id).status,"scheduled");assert.equal((await call(env,"/api/commerce/public/sites/cms_a/pages/scheduled-page")).response.status,404);
  const draft=await call(env,"/api/commerce/pages","POST",{title:"暫存",slug:"temporary"});assert.equal((await call(env,`/api/commerce/pages/${draft.body.id}`,"DELETE")).response.status,200);assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM merchant_site_pages WHERE id=?").get(draft.body.id).n,0);
});
