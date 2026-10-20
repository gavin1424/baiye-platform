import {publicDesignId} from './identity-v20.js';
import {authenticateMember,requireBrandAdmin,json,rateLimit} from './auth.js';
import {drafts} from './legacy-designs-v17.js';
import {modelById} from '../../../public/tanxiang-stable/v1/model-data-v19.js';

export const collectionSchema=`
CREATE TABLE IF NOT EXISTS xy_product_records(
 product_id TEXT PRIMARY KEY REFERENCES ls_products(id), stock INTEGER CHECK(stock>=0),
 condition_note TEXT, received_on TEXT, source_note TEXT, physical_sku TEXT UNIQUE, model_glb TEXT,
 frames360 TEXT NOT NULL DEFAULT '[]', concept_url TEXT, concept_sha256 TEXT,
 media_provenance TEXT NOT NULL DEFAULT 'HANDOFF_MISSING', terms_confirmed INTEGER NOT NULL DEFAULT 0 CHECK(terms_confirmed IN(0,1)),
 revision INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS xy_inquiries(
 id TEXT PRIMARY KEY,member_id TEXT NOT NULL REFERENCES xy_members(id) ON DELETE CASCADE,
 request_key TEXT NOT NULL,product_ids TEXT NOT NULL,note TEXT NOT NULL,
 consent_version TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'received' CHECK(status IN('received','reviewing','closed')),
 revision INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(member_id,request_key));
CREATE INDEX IF NOT EXISTS xy_inquiries_owner ON xy_inquiries(member_id,created_at);
CREATE TRIGGER IF NOT EXISTS xy_concept_sale_guard BEFORE UPDATE ON ls_products
WHEN NEW.status IN('sale','reserved','sold') AND EXISTS(SELECT 1 FROM xy_product_records WHERE product_id=NEW.id)
BEGIN
 SELECT CASE WHEN NEW.weight_g IS NULL OR NEW.length_mm IS NULL OR NEW.width_mm IS NULL OR NEW.height_mm IS NULL
 OR NOT EXISTS(SELECT 1 FROM xy_product_records WHERE product_id=NEW.id AND stock=1 AND terms_confirmed=1 AND length(physical_sku)>0)
 OR NOT EXISTS(SELECT 1 FROM ls_media WHERE product_id=NEW.id AND kind='photo' AND verified_real=1)
 OR NOT EXISTS(SELECT 1 FROM ls_shipping WHERE product_id=NEW.id AND enabled=1 AND compliance_reference!='')
 THEN RAISE(ABORT,'PHYSICAL_SKU_NOT_VERIFIED') END;
END;
`;

// Explicitly enabled per environment; imports issue-authored concepts, not physical inventory.
export function seedCollection(sql){
 for(const p of drafts){
  sql.exec("INSERT OR IGNORE INTO ls_products(id,serial,name,category,status,translations,story) VALUES(?,?,?,'heaven','display',?,?)",p.id,p.serial,p.name,JSON.stringify(p.translations),'');
  sql.exec('INSERT OR IGNORE INTO xy_product_records(product_id) VALUES(?)',p.id);
 }
}
export async function collectionRecord(db,id){return await db.prepare('SELECT r.*,a.catalog_sku,a.thumb_url,a.display_category,a.price_type FROM xy_product_records r LEFT JOIN xy_concept_art a ON a.product_id=r.product_id WHERE r.product_id=?').bind(id).first()||null}
const bad=(code,status=422)=>{throw Object.assign(Error(code),{status})};
async function read(req){const raw=await req.text();if(raw.length>8192)bad('TOO_LARGE',413);try{return JSON.parse(raw)}catch{bad('INVALID_JSON',400)}}
const clean=r=>r?{...r,frames360:JSON.parse(r.frames360||'[]'),modelGlb:r.model_glb,frame360:JSON.parse(r.frames360||'[]')}:null;
export async function handleCollection(req,env,path){
 const db=env.FINANCE_DB,method=req.method;
 const metadata=path.match(/^\/admin\/collection\/([\w-]+)$/);
 if(path==='/admin/collection'||metadata){
  const admin=await requireBrandAdmin(req,env);if(!admin)return json({error:'ADMIN_REQUIRED'},401);
  if(method==='GET'&&!metadata)return json({records:(await db.prepare('SELECT * FROM xy_product_records ORDER BY product_id').all()).results.map(clean)});
  if(method!=='PUT'||!metadata)return json({error:'METHOD_NOT_ALLOWED'},405);
  const b=await read(req),id=metadata[1],old=await collectionRecord(db,id);if(!old)return json({error:'NOT_FOUND'},404);
  if(b.revision!==old.revision)return json({error:'REVISION_CONFLICT'},409);
  if(b.stock!==null&&(!Number.isInteger(b.stock)||b.stock<0||b.stock>1))bad('INVALID_STOCK');
  if(![0,1].includes(b.terms_confirmed)||!Array.isArray(b.frames360)||b.frames360.length>36)bad('INVALID_RECORD');
  const model=b.model_glb??null,frames=b.frames360;
  const ownAsset=v=>typeof v==='string'&&/^\/tanxiang-stable\/v1\/assets\/[\w/-]+\.(glb|webp|jpg|png)$/.test(v)&&!v.includes('..');
  if(model&&!ownAsset(model)||frames.some(x=>!ownAsset(x)))bad('INVALID_MEDIA');
  if(b.physical_sku!==old.physical_sku)bad('USE_INDEPENDENT_STONE_REGISTRY');
  for(const k of ['condition_note','received_on','source_note','physical_sku'])if(b[k]!==null&&(typeof b[k]!=='string'||b[k].length>1000))bad('INVALID_RECORD');
  if(b.received_on&&!/^\d{4}-\d{2}-\d{2}$/.test(b.received_on))bad('INVALID_RECORD');
  const changes=await db.batch([db.prepare('UPDATE xy_product_records SET stock=?,condition_note=?,received_on=?,source_note=?,physical_sku=?,model_glb=?,frames360=?,terms_confirmed=?,revision=revision+1 WHERE product_id=? AND revision=?').bind(b.stock,b.condition_note,b.received_on,b.source_note,b.physical_sku,model,JSON.stringify(frames),b.terms_confirmed,id,b.revision),db.prepare("INSERT INTO ls_audit(id,actor_id,action,entity_id) SELECT ?,?,'collection.update',? WHERE changes()=1").bind(crypto.randomUUID(),admin.admin_user_id,id)]);
  return changes[0].meta.changes?json({ok:true}):json({error:'REVISION_CONFLICT'},409);
 }
 if(path==='/collection'&&method==='GET'){
  const records=(await db.prepare("SELECT p.id,p.serial,p.name,p.category,p.element,p.status,p.weight_g,p.length_mm,p.width_mm,p.height_mm,p.price_minor,p.currency,p.translations,r.stock,r.concept_url,r.media_provenance,a.catalog_sku,a.thumb_url,a.display_category,a.price_type FROM ls_products p JOIN xy_product_records r ON r.product_id=p.id LEFT JOIN xy_concept_art a ON a.product_id=p.id WHERE p.status NOT IN('draft','withdrawn') ORDER BY p.serial").all()).results;
  return json({products:env.XIANGYUN_MODELS_V19==='1'?records.map(p=>({...p,...modelById(publicDesignId(p.id))})):records,mode:'INQUIRY_ONLY',handoff:records.length===10&&records.every(p=>p.media_provenance==='AI_CONCEPT_V4')?'IMPORTED_V4':'MISSING',payment:'DISABLED'});
 }
 const record=path.match(/^\/collection\/([\w-]+)$/);
 if(record&&method==='GET'){
  const p=await db.prepare("SELECT id FROM ls_products WHERE id=? AND status NOT IN('draft','withdrawn')").bind(record[1]).first();if(!p)return json({error:'NOT_FOUND'},404);
  const r=await collectionRecord(db,p.id);return r?json({record:{...clean(r),...(env.XIANGYUN_MODELS_V19==='1'?modelById(publicDesignId(p.id)):{})},mode:'INQUIRY_ONLY'}):json({error:'NOT_FOUND'},404);
 }
 const mine=path==='/inquiries'||/^\/inquiries\/[\w-]+$/.test(path);
 const admin=path==='/admin/inquiries'||/^\/admin\/inquiries\/[\w-]+$/.test(path);
 if(!mine&&!admin)return null;
 const member=await authenticateMember(db,req);if(!member)return json({error:'MEMBER_REQUIRED'},401);
 if(admin&&!await requireBrandAdmin(req,env))return json({error:'ADMIN_REQUIRED'},401);
 if(path==='/admin/inquiries'&&method==='GET')return json({records:(await db.prepare('SELECT i.*,m.email,m.display_name FROM xy_inquiries i JOIN xy_members m ON m.id=i.member_id ORDER BY i.created_at DESC LIMIT 200').all()).results});
 if(path==='/inquiries'&&method==='GET')return json({inquiries:(await db.prepare('SELECT id,product_ids,note,status,created_at FROM xy_inquiries WHERE member_id=? ORDER BY created_at DESC LIMIT 100').bind(member.id).all()).results});
 if(path==='/inquiries'&&method==='POST'){
  const b=await read(req),key=req.headers.get('idempotency-key');
  if(b.consent!==true||b.consent_version!=='inquiry-v1')bad('INQUIRY_CONSENT_REQUIRED');
  if(!/^[a-f0-9-]{36}$/i.test(key||''))bad('INVALID_REQUEST_KEY');
  if(!Array.isArray(b.product_ids)||!b.product_ids.length||b.product_ids.length>10||b.product_ids.some(x=>typeof x!=='string'||!/^[-\w]{1,100}$/.test(x)))bad('INVALID_PRODUCTS');
  const ids=[...new Set(b.product_ids)].sort(),note=typeof b.note==='string'?b.note.trim():'';
  if(note.length>1000)bad('INVALID_NOTE');
  const old=await db.prepare('SELECT * FROM xy_inquiries WHERE member_id=? AND request_key=?').bind(member.id,key).first();
  if(old){if(old.product_ids!==JSON.stringify(ids)||old.note!==note)bad('REQUEST_CONFLICT',409);return json({id:old.id,status:old.status,duplicate:true,payment:'DISABLED'})}
  if(await rateLimit(db,'inquiry:'+member.id,8))return json({error:'RATE_LIMITED'},429);
  for(const id of ids)if(!await db.prepare("SELECT id FROM ls_products WHERE id=? AND status NOT IN('draft','withdrawn','sold')").bind(id).first())bad('PRODUCT_UNAVAILABLE',409);
  const id='XYQ-'+crypto.randomUUID();
  try{await db.prepare('INSERT INTO xy_inquiries(id,member_id,request_key,product_ids,note,consent_version) VALUES(?,?,?,?,?,?)').bind(id,member.id,key,JSON.stringify(ids),note,'inquiry-v1').run()}catch(e){
   const duplicate=await db.prepare('SELECT * FROM xy_inquiries WHERE member_id=? AND request_key=?').bind(member.id,key).first();
   if(duplicate?.product_ids===JSON.stringify(ids)&&duplicate.note===note)return json({id:duplicate.id,status:duplicate.status,duplicate:true,payment:'DISABLED'});throw e;
  }
  return json({id,status:'received',reserved:false,payment:'DISABLED',notification:'NONE'},201);
 }
 if(mine&&path!=='/inquiries'&&method==='DELETE'){
  const id=path.split('/').pop();const result=await db.prepare('DELETE FROM xy_inquiries WHERE id=? AND member_id=?').bind(id,member.id).run();return result.meta.changes?json({ok:true}):json({error:'NOT_FOUND'},404);
 }
 if(admin&&path!=='/admin/inquiries'&&method==='PUT'){
  const b=await read(req),id=path.split('/').pop();if(!['received','reviewing','closed'].includes(b.status)||!Number.isInteger(b.revision))bad('INVALID_INQUIRY');
  const r=await db.batch([db.prepare('UPDATE xy_inquiries SET status=?,revision=revision+1 WHERE id=? AND revision=?').bind(b.status,id,b.revision),db.prepare("INSERT INTO ls_audit(id,actor_id,action,entity_id) SELECT ?,?,'inquiry.review',? WHERE changes()=1").bind(crypto.randomUUID(),member.id,id)]);
  return r[0].meta.changes?json({ok:true}):json({error:'REVISION_CONFLICT'},409);
 }
 return json({error:'METHOD_NOT_ALLOWED'},405);
}
