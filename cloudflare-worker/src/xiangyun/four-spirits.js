import {authenticateMember,clearCookie,hash,json,passwordHash,rateLimit} from './auth.js';
import {dailyGuidance} from './calendar.js';
async function payload(req){const raw=await req.text();if(raw.length>16000)throw Object.assign(Error('TOO_LARGE'),{status:413});try{return JSON.parse(raw)}catch{throw Object.assign(Error('INVALID_JSON'),{status:400})}}
async function purgePhotos(db,bucket,mid){const rows=(await db.prepare('SELECT id,storage_key FROM xy_photos WHERE member_id=?').bind(mid).all()).results;for(const row of rows){await bucket.delete(row.storage_key);await db.prepare('DELETE FROM xy_photos WHERE id=? AND member_id=?').bind(row.id,mid).run()}}
const dayValid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
async function boundedBytes(req,max){const reader=req.body?.getReader();if(!reader)return new Uint8Array();const chunks=[];let size=0;while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw Object.assign(Error('TOO_LARGE'),{status:413})}chunks.push(value)}const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.byteLength}return bytes}
export async function handleFourSpirits(req,env,path){
 const db=env.FINANCE_DB,url=new URL(req.url);
 if(path==='/daily'&&req.method==='GET'){try{return json(dailyGuidance(url.searchParams.get('date'),url.searchParams.get('timezone')||'Asia/Taipei'))}catch(e){return json({error:e.message},422)}}
 if(path==='/match'&&req.method==='GET'){
  const element=url.searchParams.get('element');if(!['metal','wood','water','fire','earth'].includes(element))return json({error:'INVALID_ELEMENT'},422);
  const products=(await db.prepare("SELECT id,serial,name,category,element,story,translations FROM ls_products WHERE element=? AND status IN('display','pending_safety','sale') ORDER BY created_at DESC LIMIT 20").bind(element).all()).results;
  return json({element,rule:'EXPLICIT_CULTURAL_PREFERENCE',products,source:'XIANGYUN_OWN_CATALOG'});
 }
 const handled=['/auth/logout','/profile','/photos','/consents','/journal','/privacy/delete-optional','/account/delete'].includes(path)||path.startsWith('/photos/');
 if(!handled)return null;
 const m=await authenticateMember(db,req);if(!m)return json({error:'MEMBER_REQUIRED'},401);const mid=m.id;
 if(path==='/auth/logout'&&req.method==='POST'){await db.prepare('DELETE FROM xy_sessions WHERE member_id=?').bind(mid).run();return json({ok:true},200,{'set-cookie':clearCookie()})}
 if(path==='/profile'&&req.method==='POST'){const b=await payload(req);await db.prepare('UPDATE xy_members SET display_name=? WHERE id=?').bind(String(b.display_name||'').trim().slice(0,80),mid).run();return json({ok:true})}
 if(path==='/journal'&&req.method==='POST'){
  const consent=await db.prepare("SELECT accepted FROM ls_consents WHERE member_id=? AND scope='life'").bind(mid).first();if(!consent?.accepted)return json({error:'LIFE_CONSENT_REQUIRED'},403);
  const b=await payload(req);if(!dayValid(b.day)||![b.mood,b.energy].every(n=>Number.isInteger(n)&&n>=1&&n<=5))return json({error:'INVALID_JOURNAL'},422);
  const short=(v,n)=>String(v||'').trim().slice(0,n);
  await db.prepare("INSERT INTO ls_journal(id,member_id,day,mood,energy,note,aroma,ritual) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM ls_consents WHERE member_id=? AND scope='life' AND accepted=1) ON CONFLICT(member_id,day) DO UPDATE SET mood=excluded.mood,energy=excluded.energy,note=excluded.note,aroma=excluded.aroma,ritual=excluded.ritual").bind(crypto.randomUUID(),mid,b.day,b.mood,b.energy,short(b.note,1000),short(b.aroma,500),short(b.ritual,500),mid).run();return json({ok:true});
 }
 if(path==='/consents'&&req.method==='POST'){
  const b=await payload(req);if(!['birth','timezone','face','life'].includes(b.scope)||typeof b.accepted!=='boolean')return json({error:'INVALID_CONSENT'},422);
  await db.prepare("INSERT INTO ls_consents(member_id,scope,accepted,version) VALUES(?,?,?,'xy-v1.4') ON CONFLICT(member_id,scope) DO UPDATE SET accepted=excluded.accepted,version=excluded.version,updated_at=CURRENT_TIMESTAMP").bind(mid,b.scope,b.accepted?1:0).run();
  if(!b.accepted&&b.scope==='life')await db.prepare('DELETE FROM ls_journal WHERE member_id=?').bind(mid).run();
  if(!b.accepted&&b.scope==='face')await purgePhotos(db,env.MERCHANT_ASSETS,mid);
  return json({ok:true});
 }
 if(path==='/photos'&&req.method==='GET')return json({photos:(await db.prepare('SELECT id,day,note,created_at FROM xy_photos WHERE member_id=? ORDER BY day DESC,created_at DESC LIMIT 365').bind(mid).all()).results});
 if(path==='/photos'&&req.method==='POST'){
  const consent=await db.prepare("SELECT accepted FROM ls_consents WHERE member_id=? AND scope='face'").bind(mid).first();if(!consent?.accepted)return json({error:'PHOTO_CONSENT_REQUIRED'},403);
  if(await rateLimit(db,'photo:'+mid,20))return json({error:'RATE_LIMITED'},429);
  const max=2*1024*1024+16384,size=Number(req.headers.get('content-length')||0);if(size>max)return json({error:'TOO_LARGE'},413);
  const raw=await boundedBytes(req,max);let bytes=raw,mime=req.headers.get('content-type'),day=url.searchParams.get('day'),note='';
  if(mime?.startsWith('multipart/form-data')){const form=await new Request(req.url,{method:'POST',headers:{'content-type':mime},body:raw}).formData(),file=form.get('photo');if(!file||typeof file.arrayBuffer!=='function')return json({error:'INVALID_PHOTO'},422);bytes=new Uint8Array(await file.arrayBuffer());mime=file.type;day=String(form.get('day')||'');note=String(form.get('note')||'').slice(0,1000)}
  if(bytes.length>2*1024*1024||bytes.length<16)return json({error:'INVALID_PHOTO'},422);
  const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,png=bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10';
  if(!(mime==='image/jpeg'&&jpeg||mime==='image/png'&&png))return json({error:'INVALID_PHOTO'},422);
  if(!dayValid(day))return json({error:'INVALID_JOURNAL'},422);
  const id=crypto.randomUUID(),key='private/'+mid+'/'+id;
  await env.MERCHANT_ASSETS.put(key,bytes,{httpMetadata:{contentType:mime}});
  const written=await db.prepare("INSERT INTO xy_photos(id,member_id,day,note,storage_key,mime) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM xy_members WHERE id=? AND status='active') AND EXISTS(SELECT 1 FROM ls_consents WHERE member_id=? AND scope='face' AND accepted=1)").bind(id,mid,day,note,key,mime,mid,mid).run();
  if(written.meta?.changes!==1){await env.MERCHANT_ASSETS.delete(key);return json({error:'PHOTO_CONSENT_REQUIRED'},403)}
  return json({id},201);
 }
 const photo=path.match(/^\/photos\/([\w-]+)$/);
 if(photo){const row=await db.prepare('SELECT * FROM xy_photos WHERE id=? AND member_id=?').bind(photo[1],mid).first();if(!row)return json({error:'NOT_FOUND'},404);
  if(req.method==='DELETE'){await env.MERCHANT_ASSETS.delete(row.storage_key);await db.prepare('DELETE FROM xy_photos WHERE id=? AND member_id=?').bind(row.id,mid).run();return json({ok:true})}
  if(req.method==='GET'){const consent=await db.prepare("SELECT accepted FROM ls_consents WHERE member_id=? AND scope='face'").bind(mid).first();if(!consent?.accepted)return json({error:'PHOTO_CONSENT_REQUIRED'},403);const object=await env.MERCHANT_ASSETS.get(row.storage_key);if(!object)return json({error:'NOT_FOUND'},404);return new Response(object.body,{headers:{'content-type':row.mime,'cache-control':'private, no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; sandbox"}})}
 }
 if(path==='/privacy/delete-optional'&&req.method==='POST'){
  await db.prepare('UPDATE ls_consents SET accepted=0 WHERE member_id=?').bind(mid).run();await purgePhotos(db,env.MERCHANT_ASSETS,mid);
  await db.batch(['ls_journal','ls_favorites','ls_consents'].map(table=>db.prepare(`DELETE FROM ${table} WHERE member_id=?`).bind(mid)));return json({ok:true,retained:'ORDER_AND_OWNERSHIP_RECORDS'});
 }
 if(path==='/account/delete'&&req.method==='POST'){
  const b=await payload(req);if(typeof b.password!=='string'||b.password.length>128||await passwordHash(b.password,m.salt)!==m.password_hash)return json({error:'INVALID_CREDENTIALS'},401);
  // Refuse deletion until private storage can be purged; retry remains possible.
  await db.prepare('UPDATE ls_consents SET accepted=0 WHERE member_id=?').bind(mid).run();
  await db.prepare("UPDATE xy_members SET status='deleting' WHERE id=?").bind(mid).run();
  try{await purgePhotos(db,env.MERCHANT_ASSETS,mid)}catch(e){await db.prepare("UPDATE xy_members SET status='active' WHERE id=?").bind(mid).run();throw e}
  await db.batch([...['ls_journal','ls_favorites','ls_consents','xy_sessions'].map(table=>db.prepare(`DELETE FROM ${table} WHERE member_id=?`).bind(mid)),db.prepare("UPDATE ls_orders SET member_id=? WHERE member_id=?").bind('deleted-'+await hash(mid),mid),db.prepare("UPDATE ls_collections SET member_id=? WHERE member_id=?").bind('deleted-'+await hash(mid),mid),db.prepare('DELETE FROM xy_members WHERE id=?').bind(mid)]);
  return json({ok:true,retained:'ANONYMIZED_TRANSACTION_RECORDS'},200,{'set-cookie':clearCookie()});
 }
 return json({error:'METHOD_NOT_ALLOWED'},405);
}
