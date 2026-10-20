// Brand-owned commerce fork; legacy platform worker remains untouched.
import {requireBrandAdmin as requireAdmin} from './auth.js';
import {authenticateMember as authenticateBrandMember} from './auth.js';
import {culturalProfile} from '../../../public/tanxiang-stable/v1/cultural-data-v16.js';
const uid=()=>crypto.randomUUID();
const enc=new TextEncoder();
export const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value))),n=>n.toString(16).padStart(2,'0')).join('');
const response=(data,status=200,cors={})=>new Response(JSON.stringify(data),{status,headers:{...cors,'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const fail=(code,status=400)=>{throw Object.assign(new Error(code),{status})};
const text=(v,max=2000)=>String(v??'').trim().slice(0,max);
const categories=['heaven','elements','blackgold','home','incense_pair','incense'];
const scopes=['birth','timezone','face','life'];
const publicFields="id,serial,name,category,grade,element,batch_id,weight_g,length_mm,width_mm,height_mm,material,story,translations,price_minor,currency,CASE WHEN EXISTS(SELECT 1 FROM ls_reservations r JOIN ls_orders o ON o.id=r.order_id WHERE r.product_id=ls_products.id AND o.status='paid') THEN 'sold' WHEN EXISTS(SELECT 1 FROM ls_reservations r JOIN ls_orders o ON o.id=r.order_id WHERE r.product_id=ls_products.id AND o.status='pending' AND datetime(o.expires_at)>datetime('now')) THEN 'reserved' ELSE status END status,safety,source_status,compliance,lead_status,cadmium_status,other_elements,skin_contact,revision,created_at,updated_at";
export async function eligibleRecommendations(db,elements){
 if(!elements.length)return [];
 const candidates=(await db.prepare(`SELECT ${publicFields} FROM ls_products WHERE element IN(${elements.map(()=>'?').join(',')}) AND category!='incense' AND status='sale' AND grade!='mother' AND safety='confirmed' AND source_status='confirmed' AND compliance='confirmed' AND price_minor>0 ORDER BY updated_at DESC,id LIMIT 100`).bind(...elements).all()).results;
 const products=[];
 for(const p of candidates){
  if(p.status!=='sale')continue;
  const media=(await db.prepare("SELECT kind,url,alt FROM ls_media WHERE product_id=? AND kind='photo' AND verified_real=1").bind(p.id).all()).results;
  if(!media.length)continue;
  const shipping=await db.prepare("SELECT country FROM ls_shipping WHERE product_id=? AND enabled=1 AND compliance_reference!='' LIMIT 1").bind(p.id).first();
  if(!shipping)continue;
  products.push({...p,media});if(products.length===12)break;
 }
 return products;
}
export function validateProduct(b){
 const p={}; for(const k of ['serial','name','material','story','translations','category','grade','element','batch_id','currency','status','safety','source_status','compliance','lead_status','cadmium_status','other_elements','skin_contact']) if(k in b)p[k]=b[k]===null?null:text(b[k],k==='translations'?16000:4000);
 if(/^XY-(?:CONCEPT-|C)\d+$/.test(p.serial||''))fail('RETIRED_DISPLAY_CODE',422);
 if(!p.serial||!p.name||!categories.includes(p.category))fail('INVALID_PRODUCT');
 for(const k of ['weight_g','length_mm','width_mm','height_mm','price_minor']) if(k in b){p[k]=b[k]===null||b[k]===''?null:Number(b[k]);if(p[k]!==null&&(!Number.isFinite(p[k])||p[k]<0||(k!=='price_minor'&&p[k]===0)))fail('INVALID_MEASUREMENT');}
 if(p.price_minor!=null&&!Number.isSafeInteger(p.price_minor))fail('INVALID_PRICE');
 if(p.translations){try{const tr=JSON.parse(p.translations);if(!tr||Array.isArray(tr)||typeof tr!=='object')fail('INVALID_TRANSLATIONS')}catch{fail('INVALID_TRANSLATIONS')}}
 if(p.currency&&!/^[A-Z]{3}$/.test(p.currency))fail('INVALID_CURRENCY');
 return p;
}
export function validMediaUrl(v){try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}}
async function body(req){if(Number(req.headers.get('content-length')||0)>32000)fail('TOO_LARGE',413);const raw=await req.text();if(raw.length>32000)fail('TOO_LARGE',413);try{return JSON.parse(raw)}catch{fail('INVALID_JSON')}}
async function audit(db,actor,action,id){return db.prepare('INSERT INTO ls_audit(id,actor_id,action,entity_id) VALUES(?,?,?,?)').bind(uid(),actor,action,id)}
export async function expireReservations(db){
 await db.batch([
 db.prepare("DELETE FROM ls_reservations WHERE order_id IN(SELECT id FROM ls_orders WHERE status='pending' AND datetime(expires_at)<=datetime('now'))"),
 db.prepare("UPDATE ls_orders SET status='expired',updated_at=CURRENT_TIMESTAMP WHERE status='pending' AND datetime(expires_at)<=datetime('now')")]);
}
export async function signEvent(raw,secret){const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(raw))),n=>n.toString(16).padStart(2,'0')).join('')}
async function verifyEvent(raw,signature,secret){if(!secret||!/^[a-f0-9]{64}$/.test(signature||''))return false;const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);return crypto.subtle.verify('HMAC',key,Uint8Array.from(signature.match(/../g),x=>parseInt(x,16)),enc.encode(raw))}
export async function applyPayment(db,e){
 if(!e||!['paid','failed'].includes(e.status)||!Number.isSafeInteger(e.amount_minor)||!e.event_id||!e.order_id)fail('INVALID_EVENT');
 const hash=await digest(JSON.stringify(e)),existing=await db.prepare('SELECT * FROM ls_payment_events WHERE event_id=?').bind(e.event_id).first();
 if(existing){if(existing.payload_hash!==hash)fail('EVENT_CONFLICT',409);return {ok:true,duplicate:true,mode:'simulator'}}
 await expireReservations(db);
 const o=await db.prepare('SELECT * FROM ls_orders WHERE id=?').bind(e.order_id).first();
 if(!o||o.status!=='pending')fail('ORDER_NOT_PENDING',409);
 if(o.amount_minor!==e.amount_minor||o.currency!==e.currency)fail('PAYMENT_AMOUNT_MISMATCH',409);
 const update=db.prepare("UPDATE ls_orders SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending' AND datetime(expires_at)>datetime('now')").bind(e.status,o.id);
 // A trigger verifies the event and state under the same transaction (see local/D1 schema).
 const statements=[db.prepare('INSERT INTO ls_payment_events(event_id,order_id,status,payload_hash) VALUES(?,?,?,?)').bind(e.event_id,o.id,e.status,hash),update];
 if(e.status==='failed')statements.push(db.prepare("DELETE FROM ls_reservations WHERE order_id=? AND EXISTS(SELECT 1 FROM ls_orders WHERE id=? AND status='failed')").bind(o.id,o.id));
 await db.batch(statements);return {ok:true,mode:'simulator'};
}
export async function handleLingstone(req,env,cors={}){
 const url=new URL(req.url),path=url.pathname.replace(/^\/api\/lingstone/,'')||'/',method=req.method,db=env.FINANCE_DB;
 const out=(d,s=200)=>response(d,s,cors);
 try{
 if(path==='/health'&&method==='GET')return out({service:'xiangyun-v1.7',database:!!db,payment:env.LINGSTONE_PAYMENT_MODE==='simulator'&&env.LINGSTONE_LOCAL_SIMULATOR==='1'?'LOCAL_SIMULATOR_ONLY':'DISABLED',live_payment:false,face:'PRIVATE_OPT_IN_RECORDS',bazi:env.LINGSTONE_BAZI?'XIANGYUN_INDEPENDENT':'BLOCKED'});
 if(!db)fail('DATABASE_UNAVAILABLE',503);
 if(path==='/content'&&method==='GET'){
  const locale=text(url.searchParams.get('locale')||'zh-Hant',35);
  return out({content:(await db.prepare("SELECT kind,slug,locale,title,body,url,category FROM ls_content WHERE locale=? AND state='published' LIMIT 200").bind(locale).all()).results});
 }
 const asset=path.match(/^\/assets\/([\w-]+)$/);
 if(asset&&method==='GET'){
  const m=await db.prepare("SELECT m.storage_key,p.status FROM ls_media m JOIN ls_products p ON p.id=m.product_id WHERE m.id=? AND m.verified_real=1").bind(asset[1]).first();
  if(!m?.storage_key||!env.MERCHANT_ASSETS)fail('NOT_FOUND',404);
  if(['draft','withdrawn'].includes(m.status)&&!await requireAdmin(req,env))fail('NOT_FOUND',404);
  const object=await env.MERCHANT_ASSETS.get(m.storage_key);if(!object)fail('NOT_FOUND',404);
  return new Response(object.body,{headers:{...cors,'content-type':object.httpMetadata?.contentType||'application/octet-stream','x-content-type-options':'nosniff','cache-control':'private, no-store'}});
 }
 if(method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(!['GET','HEAD'].includes(method)){
  const origin=req.headers.get('origin');
  if(path!=='/payments/simulator/webhook'&&(!origin||!(env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).includes(origin)))fail('ORIGIN_NOT_ALLOWED',403);
 }
 if(path==='/products'&&method==='GET'){
  const params=[],where=["status NOT IN('draft','withdrawn')"];
  if(url.searchParams.get('category')){where.push('category=?');params.push(url.searchParams.get('category'))}
  if(url.searchParams.get('q')){where.push('(name LIKE ? OR serial LIKE ?)');const q=`%${text(url.searchParams.get('q'),100)}%`;params.push(q,q)}
  const products=(await db.prepare(`SELECT ${publicFields} FROM ls_products WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT 200`).bind(...params).all()).results;
  const media=(await db.prepare("SELECT product_id,kind,url,alt FROM ls_media WHERE verified_real=1").all()).results;
  return out({products:products.map(p=>({...p,media:media.filter(m=>m.product_id===p.id)}))});
 }
 const detail=path.match(/^\/products\/([\w-]+)$/);
 if(detail&&method==='GET'){
  const product=await db.prepare(`SELECT ${publicFields} FROM ls_products WHERE id=? AND status NOT IN('draft','withdrawn')`).bind(detail[1]).first();if(!product)fail('NOT_FOUND',404);
  const media=(await db.prepare('SELECT kind,url,alt FROM ls_media WHERE product_id=? AND verified_real=1').bind(product.id).all()).results;
  const xrf=(await db.prepare('SELECT id,tested_on,device,mode,element,reading,unit,original_url,note,confirmation FROM ls_xrf WHERE product_id=? AND is_public=1').bind(product.id).all()).results;
  return out({product,media,xrf:[],individual_testing:'REQUIRES_MATCHED_STONE_REGISTRATION',xrf_label:'HISTORICAL_XRF_INSTRUMENT_READING',shipping:(await db.prepare('SELECT country,fee_minor FROM ls_shipping WHERE product_id=? AND enabled=1').bind(product.id).all()).results});
 }
 if(path==='/recommendations'&&method==='GET'){
  const element=url.searchParams.get('element');if(!['metal','wood','water','fire','earth'].includes(element))fail('INVALID_ELEMENT',422);
  return out({element,products:await eligibleRecommendations(db,[element]),source:'XIANGYUN_OWN_LIVE_ELIGIBLE_CATALOG',rule:'EXPLICIT_OWNER_CULTURAL_ELEMENT',payment:'DISABLED'});
 }
 if(path==='/analysis'&&method==='POST'){
  if(!env.LINGSTONE_BAZI)fail('XIANGYUN_ENGINE_UNAVAILABLE',503);
  const rateKey=await digest(req.headers.get('cf-connecting-ip')||'local'),bucket=Math.floor(Date.now()/300000);
  await db.prepare('INSERT INTO ls_rate_limits(rate_key,bucket,attempts) VALUES(?,?,1) ON CONFLICT(rate_key,bucket) DO UPDATE SET attempts=attempts+1').bind(rateKey,bucket).run();
  if((await db.prepare('SELECT attempts FROM ls_rate_limits WHERE rate_key=? AND bucket=?').bind(rateKey,bucket).first()).attempts>30)fail('RATE_LIMITED',429);
  await db.prepare('DELETE FROM ls_rate_limits WHERE bucket<?').bind(bucket-2).run();
  const b=await body(req);let result;try{result=env.LINGSTONE_BAZI(b)}catch(e){fail(/^(INVALID_|AMBIGUOUS_LOCAL_TIME|NONEXISTENT_LOCAL_TIME)/.test(e.message)?e.message:'INVALID_BIRTH_INPUT',422)}
  const counts=result.five_elements,min=Math.min(...Object.values(counts)),elements=Object.keys(counts).filter(k=>counts[k]===min);
  const products=await eligibleRecommendations(db,elements);
  return out({result,cultural_profile:culturalProfile(result),recommendations:products,recommendation_source:'XIANGYUN_OWN_LIVE_ELIGIBLE_CATALOG',reason:{rule:'VISIBLE_ELEMENT_LOWEST_COUNT_V1',elements,counts,meaning:'CULTURAL_ASSOCIATION_ONLY',availability:'SALE_SAFE_LEGAL_REAL_PHOTO_SHIPPING_NO_ACTIVE_RESERVATION',incense:'PERSONAL_AROMA_PREFERENCE_AND_VENTILATION'},stored:false});
 }
 if(path==='/payments/simulator/webhook'&&method==='POST'){
  if(env.LINGSTONE_PAYMENT_MODE!=='simulator')fail('SIMULATOR_DISABLED',503);
  const raw=await req.text();if(raw.length>8000)fail('TOO_LARGE',413);
  if(!await verifyEvent(raw,req.headers.get('x-ls-signature'),env.LINGSTONE_WEBHOOK_SECRET))fail('INVALID_SIGNATURE',401);
  let event;try{event=JSON.parse(raw)}catch{fail('INVALID_JSON')}
  if(!Number.isFinite(event.timestamp)||Math.abs(Date.now()-event.timestamp)>300000)fail('STALE_EVENT',401);
  return out(await applyPayment(db,event));
 }
 if(path.startsWith('/admin/')){
  const admin=await requireAdmin(req,env);if(!admin)fail('ADMIN_REQUIRED',401);const actor=admin.admin_user_id;
  const cmsKind={content:'site',videos:'video',elements:'element',policies:'policy'}[path.slice(7)];
  if(cmsKind&&method==='GET')return out({records:(await db.prepare('SELECT * FROM ls_content WHERE kind=? ORDER BY updated_at DESC LIMIT 300').bind(cmsKind).all()).results});
  if(cmsKind&&method==='POST'){
   const b=await body(req),id=b.id||uid();
   if(!/^[\w-]{1,100}$/.test(b.slug||'')||!/^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{2,8})*$/.test(b.locale||'')||!text(b.title)||!['draft','published'].includes(b.state)||b.url&&!validMediaUrl(b.url))fail('INVALID_CONTENT');
   if(cmsKind==='video'&&b.url&&b.state==='published'&&b.rights_confirmed!==true&&b.rights_confirmed!==1)fail('MEDIA_RIGHTS_REQUIRED');
   const values=[text(b.slug,100),text(b.locale,35),text(b.title,500),text(b.body,20000),b.url||null,b.category||null,b.rights_confirmed===true||b.rights_confirmed===1?1:0,b.state];
   let change;
   if(b.id){if(!Number.isInteger(b.revision))fail('REVISION_REQUIRED',409);change=db.prepare('UPDATE ls_content SET slug=?,locale=?,title=?,body=?,url=?,category=?,rights_confirmed=?,state=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND kind=? AND revision=?').bind(...values,id,cmsKind,b.revision)}
   else change=db.prepare('INSERT INTO ls_content(slug,locale,title,body,url,category,rights_confirmed,state,id,kind) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(...values,id,cmsKind);
   const r=await db.batch([change,await audit(db,actor,'content.'+cmsKind,id)]);if(r[0].meta?.changes!==1)fail('REVISION_CONFLICT',409);return out({id},b.id?200:201);
  }
  if(path==='/admin/upload'&&method==='POST'){
   if(!env.MERCHANT_ASSETS)fail('MEDIA_STORAGE_UNAVAILABLE',503);
   if(Number(req.headers.get('content-length')||0)>8*1024*1024)fail('TOO_LARGE',413);
   const bytes=await req.arrayBuffer();if(bytes.byteLength>8*1024*1024)fail('TOO_LARGE',413);
   const form=await new Request(req.url,{method:'POST',headers:req.headers,body:bytes}).formData(),file=form.get('file'),productId=text(form.get('product_id')),alt=text(form.get('alt'));
   if(!file||typeof file.arrayBuffer!=='function'||!alt||form.get('verified_real')!=='true')fail('REAL_MEDIA_CONFIRMATION_REQUIRED');
   const buffer=await file.arrayBuffer(),sig=new Uint8Array(buffer).slice(0,12),mime=sig[0]===255&&sig[1]===216&&sig[2]===255?'image/jpeg':sig[0]===137&&sig[1]===80&&sig[2]===78&&sig[3]===71?'image/png':String.fromCharCode(...sig.slice(0,4))==='RIFF'&&String.fromCharCode(...sig.slice(8,12))==='WEBP'?'image/webp':null;
   if(!mime||buffer.byteLength>6*1024*1024)fail('INVALID_IMAGE');
   if(!await db.prepare('SELECT id FROM ls_products WHERE id=?').bind(productId).first())fail('NOT_FOUND',404);
   const id=uid(),key='lingstone/'+id,url=new URL((env.LINGSTONE_PUBLIC_PREFIX||'')+'/api/lingstone/assets/'+id,req.url).href;
   await env.MERCHANT_ASSETS.put(key,buffer,{httpMetadata:{contentType:mime}});
   await db.batch([db.prepare("INSERT INTO ls_media(id,product_id,kind,url,alt,storage_key,verified_real) VALUES(?,?,'photo',?,?,?,1)").bind(id,productId,url,alt,key),await audit(db,actor,'media.upload',id)]);
   return out({id,url},201);
  }
  const lists={batches:'SELECT id,name,public_story,created_at FROM ls_batches',xrf:'SELECT * FROM ls_xrf',media:'SELECT * FROM ls_media',shipping:'SELECT * FROM ls_shipping',qr:'SELECT id,product_id,order_id,status,expires_at,created_at FROM ls_qr',members:'SELECT id,member_no,status,joined_at FROM xy_members'};
  const listName=path.slice('/admin/'.length);
  if(method==='GET'&&lists[listName])return out({[listName]:(await db.prepare(lists[listName]+' LIMIT 300').all()).results});
  if(path==='/admin/products'&&method==='GET')return out({products:(await db.prepare('SELECT * FROM ls_products ORDER BY created_at DESC LIMIT 300').all()).results});
  const edit=path.match(/^\/admin\/products(?:\/([\w-]+))?$/);
  if(edit&&['POST','PUT'].includes(method)){
   const b=await body(req),p=validateProduct(b),id=edit[1]||uid(),fields=Object.keys(p);
   let change;if(edit[1]){if(!Number.isInteger(b.revision))fail('REVISION_REQUIRED',409);const old=await db.prepare('SELECT revision FROM ls_products WHERE id=?').bind(id).first();if(old?.revision!==b.revision)fail('REVISION_CONFLICT',409);change=db.prepare(`UPDATE ls_products SET ${fields.map(k=>`${k}=?`).join(',')},revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=?`).bind(...Object.values(p),id,b.revision)}
   else change=db.prepare(`INSERT INTO ls_products(id,${fields.join(',')}) VALUES(?,${fields.map(()=>'?').join(',')})`).bind(id,...Object.values(p));
   const changed=await db.batch([change,await audit(db,actor,edit[1]?'product.update':'product.create',id)]);if(changed[0].meta?.changes!==1)fail('REVISION_CONFLICT',409);return out({id},edit[1]?200:201);
  }
  if(path==='/admin/batches'&&method==='POST'){const b=await body(req),id=b.id||uid();if(!text(b.name))fail('NAME_REQUIRED');const statement=b.id?db.prepare('UPDATE ls_batches SET name=?,public_story=? WHERE id=?').bind(text(b.name),text(b.public_story),id):db.prepare('INSERT INTO ls_batches(id,name,public_story) VALUES(?,?,?)').bind(id,text(b.name),text(b.public_story));const r=await db.batch([statement,await audit(db,actor,b.id?'batch.update':'batch.create',id)]);if(r[0].meta?.changes!==1)fail('NOT_FOUND',404);return out({id},b.id?200:201)}
  if(path==='/admin/media'&&method==='POST'){const b=await body(req),id=uid();if(!validMediaUrl(b.url)||!text(b.alt)||b.verified_real!==true)fail('REAL_MEDIA_CONFIRMATION_REQUIRED');await db.batch([db.prepare('INSERT INTO ls_media(id,product_id,kind,url,alt,verified_real) VALUES(?,?,?,?,?,1)').bind(id,b.product_id,b.kind,text(b.url),text(b.alt)),await audit(db,actor,'media.create',id)]);return out({id},201)}
  if(path==='/admin/xrf'&&method==='POST'){const b=await body(req),id=uid();if(!text(b.element)||b.reading!=null&&!Number.isFinite(b.reading)||b.original_url&&!validMediaUrl(b.original_url))fail('INVALID_XRF');if(b.is_public===true&&(!b.original_url||b.confirmation!=='confirmed'))fail('XRF_PUBLICATION_REQUIRES_CONFIRMED_SOURCE');await db.batch([db.prepare('INSERT INTO ls_xrf(id,product_id,batch_id,tested_on,device,mode,element,reading,unit,original_url,note,confirmation,is_public) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,b.product_id,b.batch_id||null,b.tested_on||null,text(b.device),text(b.mode),text(b.element),b.reading??null,text(b.unit),b.original_url||null,text(b.note),b.confirmation||'unverified',b.is_public===true?1:0),await audit(db,actor,'xrf.create',id)]);return out({id},201)}
  if(path==='/admin/shipping'&&method==='POST'){const b=await body(req);if(!/^[A-Z]{2}$/.test(b.country)||!Number.isSafeInteger(b.fee_minor)||b.fee_minor<0||b.enabled===true&&!text(b.compliance_reference))fail('INVALID_SHIPPING');await db.batch([db.prepare('INSERT INTO ls_shipping(product_id,country,enabled,fee_minor,compliance_reference,customs_description,hs_code,cites_document) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(product_id,country) DO UPDATE SET enabled=excluded.enabled,fee_minor=excluded.fee_minor,compliance_reference=excluded.compliance_reference,customs_description=excluded.customs_description,hs_code=excluded.hs_code,cites_document=excluded.cites_document').bind(b.product_id,b.country,b.enabled===true?1:0,b.fee_minor,text(b.compliance_reference),text(b.customs_description),text(b.hs_code),text(b.cites_document)),await audit(db,actor,'shipping.update',b.product_id)]);return out({ok:true})}
  if(path==='/admin/orders'&&method==='GET')return out({orders:(await db.prepare('SELECT * FROM ls_orders ORDER BY created_at DESC LIMIT 300').all()).results});
  if(path==='/admin/analytics'&&method==='GET')return out({sales:(await db.prepare("SELECT currency,payment_mode,status,count(*) orders,sum(amount_minor) total_minor FROM ls_orders GROUP BY currency,payment_mode,status").all()).results});
  if(path==='/admin/audit'&&method==='GET')return out({audit:(await db.prepare('SELECT * FROM ls_audit ORDER BY created_at DESC LIMIT 300').all()).results});
  if(path==='/admin/fulfillment'&&method==='POST'){const b=await body(req);if(!['processing','shipped','delivered'].includes(b.shipment_status)||b.shipment_status!=='processing'&&!text(b.tracking))fail('INVALID_FULFILLMENT');await db.batch([db.prepare("UPDATE ls_orders SET shipment_status=?,tracking=?,carrier=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='paid'").bind(b.shipment_status,text(b.tracking),text(b.carrier),b.order_id),await audit(db,actor,'order.fulfillment',b.order_id)]);return out({ok:true})}
  if(path==='/admin/qr'&&method==='POST'){
   const b=await body(req);if(b.disable_id){await db.batch([db.prepare("UPDATE ls_qr SET status='disabled' WHERE id=?").bind(b.disable_id),await audit(db,actor,'qr.disable',b.disable_id)]);return out({ok:true})}
   const o=await db.prepare("SELECT o.id FROM ls_orders o JOIN ls_order_items i ON i.order_id=o.id WHERE o.id=? AND i.product_id=? AND o.status='paid'").bind(b.order_id,b.product_id).first();if(!o)fail('PAID_OWNERSHIP_REQUIRED',409);
   const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join(''),id=uid();
   await db.batch([db.prepare("UPDATE ls_qr SET status='disabled' WHERE product_id=? AND status='active'").bind(b.product_id),db.prepare('INSERT INTO ls_qr(id,product_id,order_id,token_hash,expires_at) VALUES(?,?,?,?,?)').bind(id,b.product_id,b.order_id,await digest(token),new Date(Date.now()+365*86400000).toISOString()),await audit(db,actor,'qr.issue',id)]);
   return out({id,activation_path:`/tanxiang-stable/v1/#activate=${token}`,token_visible_once:true},201);
  }
  fail('NOT_FOUND',404);
 }
 const member=await authenticateBrandMember(db,req);if(!member)fail('MEMBER_REQUIRED',401);const mid=member.id;
 if(path==='/me'&&method==='GET')await expireReservations(db);
 if(path==='/me'&&method==='GET')return out({member:{id:mid,member_no:member.member_no},orders:(await db.prepare('SELECT * FROM ls_orders WHERE member_id=? ORDER BY created_at DESC LIMIT 100').bind(mid).all()).results,collections:(await db.prepare('SELECT c.*,p.serial,p.name,p.story FROM ls_collections c JOIN ls_products p ON p.id=c.product_id WHERE c.member_id=?').bind(mid).all()).results,favorites:(await db.prepare('SELECT product_id FROM ls_favorites WHERE member_id=?').bind(mid).all()).results,consents:(await db.prepare('SELECT scope,accepted,version FROM ls_consents WHERE member_id=?').bind(mid).all()).results,journal:(await db.prepare('SELECT id,day,mood,energy,note,aroma,ritual FROM ls_journal WHERE member_id=? ORDER BY day DESC LIMIT 365').bind(mid).all()).results});
 if(path==='/consents'&&method==='POST'){const b=await body(req);if(!scopes.includes(b.scope)||typeof b.accepted!=='boolean')fail('INVALID_CONSENT');const changes=[db.prepare('INSERT INTO ls_consents(member_id,scope,accepted,version) VALUES(?,?,?,?) ON CONFLICT(member_id,scope) DO UPDATE SET accepted=excluded.accepted,version=excluded.version,updated_at=CURRENT_TIMESTAMP').bind(mid,b.scope,b.accepted?1:0,'v1')];if(b.scope==='life'&&!b.accepted)changes.push(db.prepare('DELETE FROM ls_journal WHERE member_id=?').bind(mid));changes.push(await audit(db,mid,'consent.'+b.scope,mid));await db.batch(changes);return out({ok:true})}
 if(path==='/favorites'&&method==='POST'){const b=await body(req);await db.prepare(b.remove?'DELETE FROM ls_favorites WHERE member_id=? AND product_id=?':'INSERT OR IGNORE INTO ls_favorites(member_id,product_id) VALUES(?,?)').bind(mid,b.product_id).run();return out({ok:true})}
 if(path==='/journal'&&method==='POST'){const b=await body(req),consent=await db.prepare("SELECT accepted FROM ls_consents WHERE member_id=? AND scope='life'").bind(mid).first();if(!consent?.accepted)fail('LIFE_CONSENT_REQUIRED',403);if(!/^\d{4}-\d{2}-\d{2}$/.test(b.day)||![b.mood,b.energy].every(n=>Number.isInteger(n)&&n>=1&&n<=5))fail('INVALID_JOURNAL');await db.prepare('INSERT INTO ls_journal(id,member_id,day,mood,energy,note) VALUES(?,?,?,?,?,?) ON CONFLICT(member_id,day) DO UPDATE SET mood=excluded.mood,energy=excluded.energy,note=excluded.note').bind(uid(),mid,b.day,b.mood,b.energy,text(b.note,1000)).run();return out({ok:true})}
 if(path==='/privacy/delete-optional'&&method==='POST'){await db.batch([db.prepare('DELETE FROM ls_journal WHERE member_id=?').bind(mid),db.prepare('DELETE FROM ls_favorites WHERE member_id=?').bind(mid),db.prepare('DELETE FROM ls_consents WHERE member_id=?').bind(mid),await audit(db,mid,'privacy.delete_optional',mid)]);return out({ok:true,retained:'ORDER_AND_OWNERSHIP_RECORDS',account_deletion:'XIANGYUN_ACCOUNT_DELETE'})}
 if(path==='/orders'&&method==='POST'){
  if(env.LINGSTONE_PAYMENT_MODE!=='simulator')fail('CHECKOUT_NOT_ENABLED',503);
  const b=await body(req),ids=Array.isArray(b.product_ids)?[...new Set(b.product_ids)]:[],key=req.headers.get('idempotency-key');if(!ids.length||ids.length>20||!ids.every(x=>typeof x==='string'&&/^[\w-]{1,100}$/.test(x))||!key||key.length>100||!/^[A-Z]{2}$/.test(b.country))fail('INVALID_ORDER');
  const hash=await digest(JSON.stringify({ids:[...ids].sort(),country:b.country}));const prior=await db.prepare('SELECT * FROM ls_orders WHERE member_id=? AND idempotency_key=?').bind(mid,key).first();if(prior){if(prior.request_hash!==hash)fail('IDEMPOTENCY_CONFLICT',409);return out({order:prior,reused:true})}
  await expireReservations(db);let amount=0,shipping=0,currency;const items=[];
  for(const id of ids){const p=await db.prepare('SELECT p.*,s.fee_minor FROM ls_products p JOIN ls_shipping s ON s.product_id=p.id AND s.country=? AND s.enabled=1 AND s.compliance_reference!=\'\' WHERE p.id=?').bind(b.country,id).first();if(!p||p.status!=='sale'||p.grade==='mother'||p.safety!=='confirmed'||p.source_status!=='confirmed'||p.compliance!=='confirmed'||!p.price_minor)fail('PRODUCT_NOT_ELIGIBLE',409);if(currency&&currency!==p.currency)fail('MIXED_CURRENCY');currency=p.currency;amount+=p.price_minor;shipping+=p.fee_minor;items.push(p)}
  const id=uid(),expires=new Date(Date.now()+15*60000).toISOString(),statements=[db.prepare('INSERT INTO ls_orders(id,member_id,idempotency_key,request_hash,amount_minor,currency,country,shipping_minor,expires_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,mid,key,hash,amount+shipping,currency,b.country,shipping,expires)];
  for(const p of items){statements.push(db.prepare('INSERT INTO ls_order_items(order_id,product_id,name,price_minor) VALUES(?,?,?,?)').bind(id,p.id,p.name,p.price_minor));statements.push(db.prepare('INSERT INTO ls_reservations(product_id,order_id) VALUES(?,?)').bind(p.id,id))}
  await db.batch(statements);return out({order:await db.prepare('SELECT * FROM ls_orders WHERE id=?').bind(id).first(),payment:'SIMULATOR_NOT_PROVIDER_SANDBOX'},201);
 }
 const orderAction=path.match(/^\/orders\/([\w-]+)\/(cancel|simulate)$/);
 if(orderAction&&method==='POST'){
  const o=await db.prepare('SELECT * FROM ls_orders WHERE id=? AND member_id=?').bind(orderAction[1],mid).first();if(!o)fail('NOT_FOUND',404);
  if(orderAction[2]==='cancel'){if(o.status!=='pending')fail('ORDER_NOT_PENDING',409);await db.batch([db.prepare("UPDATE ls_orders SET status='cancelled' WHERE id=? AND status='pending'").bind(o.id),db.prepare("DELETE FROM ls_reservations WHERE order_id=? AND EXISTS(SELECT 1 FROM ls_orders WHERE id=? AND status='cancelled')").bind(o.id,o.id)]);return out({ok:true})}
  if(env.LINGSTONE_PAYMENT_MODE!=='simulator'||env.LINGSTONE_LOCAL_SIMULATOR!=='1')fail('SIMULATOR_DISABLED',503);
  const b=await body(req);return out(await applyPayment(db,{event_id:uid(),order_id:o.id,amount_minor:o.amount_minor,currency:o.currency,status:b.status}));
 }
 if(path==='/activate'&&method==='POST'){
  const b=await body(req);if(!/^[a-f0-9]{64}$/.test(b.token||''))fail('INVALID_CLAIM',403);
  const q=await db.prepare("SELECT q.* FROM ls_qr q JOIN ls_orders o ON o.id=q.order_id WHERE q.token_hash=? AND q.status='active' AND datetime(q.expires_at)>datetime('now') AND o.member_id=? AND o.status='paid'").bind(await digest(b.token),mid).first();if(!q)fail('INVALID_CLAIM',403);
  const claimed=await db.batch([db.prepare("INSERT INTO ls_collections(product_id,member_id,order_id) SELECT q.product_id,?,q.order_id FROM ls_qr q WHERE q.id=? AND q.status='active' AND datetime(q.expires_at)>datetime('now')").bind(mid,q.id),db.prepare("UPDATE ls_qr SET status='claimed' WHERE id=? AND status='active'").bind(q.id),await audit(db,mid,'qr.claim',q.product_id)]);if(claimed[0].meta?.changes!==1)fail('INVALID_CLAIM',409);return out({ok:true,product_id:q.product_id});
 }
 fail('NOT_FOUND',404);
 }catch(e){const constraint=/constraint|PRODUCT_NOT_ELIGIBLE|PRODUCT_LOCKED|EVENT_NOT_PENDING|REVISION_CONFLICT/i.test(e.message);return out({error:e.status?e.message:constraint?'CONFLICT_OR_INELIGIBLE':'SERVICE_UNAVAILABLE'},e.status||(constraint?409:503))}
}
