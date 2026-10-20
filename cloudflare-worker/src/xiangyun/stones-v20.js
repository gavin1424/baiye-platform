import {json,requireBrandAdmin,rateLimit,hash} from './auth.js';
const testMode=env=>env.XIANGYUN_STONE_TEST_MODE==='1'&&env.XIANGYUN_DEPLOYMENT_CHANNEL==='preview'&&!String(env.XIANGYUN_STORE_NAME||'').includes('production');
const prefixes=['MET','WOD','WAT','FIR','EAR'],codePattern=/^(MET|WOD|WAT|FIR|EAR)-[0-9]{3,}$/;
const fail=(message,status=422)=>{throw Object.assign(Error(message),{status})};
const text=(v,max=1000)=>typeof v==='string'?v.trim().slice(0,max):'';
const day=v=>{if(v==null||v==='')return null;if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)fail('INVALID_DATE');return v};
const own=(storage,fn)=>{if(!storage?.transactionSync)fail('ATOMIC_STORAGE_UNAVAILABLE',503);return storage.transactionSync(fn)};
const all=(sql,q,...args)=>sql.exec(q,...args).toArray();
const first=(sql,q,...args)=>all(sql,q,...args)[0];
const audit=(sql,id,actor,action,revision)=>sql.exec('INSERT INTO xy_stone_audit(id,stone_id,actor_id,action,revision) VALUES(?,?,?,?,?)',crypto.randomUUID(),id,actor,action,revision);
const changed=(sql,id,actor,action)=>{const r=first(sql,'UPDATE xy_stones SET revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? RETURNING revision',id);audit(sql,id,actor,action,r.revision)};
const eventKey=request=>{const key=request.headers.get('idempotency-key');if(!/^[\w-]{16,100}$/.test(key||''))fail('IDEMPOTENCY_KEY_REQUIRED');return key};
async function body(req){const raw=await req.text();if(raw.length>100000)fail('TOO_LARGE',413);try{return JSON.parse(raw)}catch{fail('INVALID_JSON',400)}}
export function validateStone(b,env){
 if(!b||typeof b!=='object'||!prefixes.includes(b.series_prefix)||!text(b.public_name,160))fail('INVALID_STONE');
 if('code'in b||'sequence_number'in b)fail('CODE_IS_AUTOMATIC');
 if(b.is_test===true&&!testMode(env))fail('TEST_RECORDS_DISABLED');
 const out={series_prefix:b.series_prefix,public_name:text(b.public_name,160),product_template_id:b.product_template_id||null,batch_id:b.batch_id||null,is_test:b.is_test===true?1:0,cultural_theme:b.cultural_theme||{MET:'metal',WOD:'wood',WAT:'water',FIR:'fire',EAR:'earth'}[b.series_prefix],price_minor:b.price_minor??null,currency:b.currency||'TWD',sale_status:b.sale_status||'inquiry'};
 if(!['inquiry','display','collected','withdrawn'].includes(out.sale_status)||!['metal','wood','water','fire','earth'].includes(out.cultural_theme)||out.price_minor!==null&&(!Number.isSafeInteger(out.price_minor)||out.price_minor<0)||!/^[A-Z]{3}$/.test(out.currency))fail('INVALID_STONE_PRICE_OR_THEME');
 for(const k of ['shape','color_description','origin_public','provenance_note','condition_note'])out[k]=text(b[k]);
 for(const k of ['weight_g','length_mm','width_mm','height_mm']){out[k]=b[k]==null||b[k]===''?null:Number(b[k]);if(out[k]!==null&&(!Number.isFinite(out[k])||out[k]<=0||out[k]>1e9))fail('INVALID_MEASUREMENT')}
 for(const k of ['received_on','measured_on'])out[k]=day(b[k]);out.collection_grade=text(b.collection_grade,80)||null;
 return out;
}
function allocate(sql,b,actor,key,digest){
 const previous=first(sql,'SELECT * FROM xy_stone_requests WHERE actor_id=? AND request_key=?',actor,key);
 if(previous){if(previous.request_hash!==digest)fail('IDEMPOTENCY_CONFLICT',409);return first(sql,'SELECT * FROM xy_stones WHERE id=?',previous.stone_id)}
 if(b.product_template_id&&!first(sql,'SELECT id FROM ls_products WHERE id=?',b.product_template_id))fail('UNKNOWN_PRODUCT_TEMPLATE');
 const counter=first(sql,'INSERT INTO xy_stone_series_counters(series_prefix,last_number) VALUES(?,1) ON CONFLICT(series_prefix) DO UPDATE SET last_number=last_number+1 RETURNING last_number',b.series_prefix);
 const id=crypto.randomUUID(),code=b.series_prefix+'-'+String(counter.last_number).padStart(3,'0');
 const fields=Object.keys(b);sql.exec('INSERT INTO xy_stones(id,code,sequence_number,'+fields.join(',')+') VALUES('+Array(fields.length+3).fill('?').join(',')+')',id,code,counter.last_number,...Object.values(b));
 sql.exec('INSERT INTO xy_stone_requests(actor_id,request_key,request_hash,stone_id) VALUES(?,?,?,?)',actor,key,digest,id);audit(sql,id,actor,'register',1);return first(sql,'SELECT * FROM xy_stones WHERE id=?',id);
}
export async function registerStones(storage,rows,actor,key,env){
 if(!Array.isArray(rows)||!rows.length||rows.length>100)fail('INVALID_IMPORT');const valid=rows.map(b=>validateStone(b,env)),digests=await Promise.all(valid.map(b=>hash(JSON.stringify(b))));
 return own(storage,()=>valid.map((b,i)=>allocate(storage.sql,b,actor,key+'-'+i,digests[i])));
}
const safePhoto=p=>({id:p.id,kind:p.kind,url:p.fixture_path||'/tanxiang-stable/v1/api/lingstone/stone-media/'+p.id,verified_real:!!p.verified_real,alt:p.alt,sort_order:p.sort_order});
export async function publicCertificate(db,code,env){
 if(!codePattern.test(code))return json({error:'CERTIFICATE_NOT_FOUND'},404);
 const s=await db.prepare('SELECT * FROM xy_stones WHERE code=?').bind(code).first();
 if(!s||!s.ever_published||s.is_test&&!testMode(env))return json({error:'CERTIFICATE_NOT_FOUND'},404);
 if(!s.published)return json({code:s.code,status:'withdrawn',registry:'SELF_REGISTERED_NOT_THIRD_PARTY',is_test:!!s.is_test},410);
 const photos=(await db.prepare('SELECT * FROM xy_stone_photos WHERE stone_id=? AND is_public=1 ORDER BY sort_order,id').bind(s.id).all()).results.filter(p=>s.is_test||p.verified_real);
 const documents=(await db.prepare("SELECT id,doc_type,status FROM xy_stone_documents WHERE stone_id=? AND public_visible=1 AND status='confirmed'").bind(s.id).all()).results.map(d=>({...d,url:'/tanxiang-stable/v1/api/lingstone/stone-documents/'+d.id}));
 const tests=(await db.prepare("SELECT id,sample_id,device,analysis_mode,tested_at,institution,document_id FROM xy_stone_tests WHERE stone_id=? AND status='confirmed' AND is_public=1 AND length(identity_evidence)>0 AND document_id IN(SELECT id FROM xy_stone_documents WHERE stone_id=? AND status='confirmed' AND public_visible=1)").bind(s.id,s.id).all()).results;
 for(const t of tests){t.points=(await db.prepare('SELECT id,point_label,photo_id,x,y FROM xy_stone_test_points WHERE test_id=? ORDER BY point_label').bind(t.id).all()).results;for(const p of t.points)p.readings=(await db.prepare('SELECT element,reading,unit,uncertainty FROM xy_stone_readings WHERE point_id=? ORDER BY element').bind(p.id).all()).results;}
 const fields=['code','series_prefix','cultural_theme','price_minor','currency','public_name','shape','color_description','origin_public','provenance_note','condition_note','received_on','measured_on','weight_g','length_mm','width_mm','height_mm','collection_grade','sale_status','revision','created_at','updated_at'];
 return json({stone:Object.fromEntries(fields.map(k=>[k,s[k]])),is_test:!!s.is_test,photos:photos.map(safePhoto),tests:tests.filter(t=>t.points.length&&t.points.every(p=>p.readings.length&&(t.points.length===1||photos.some(f=>f.id===p.photo_id)))),documents,registry:'SELF_REGISTERED_NOT_THIRD_PARTY',payment:'DISABLED'});
}
async function adminStone(db,id){const s=await db.prepare('SELECT * FROM xy_stones WHERE id=?').bind(id).first();if(!s)fail('STONE_NOT_FOUND',404);return s}
const validDecimal=v=>v===null||v===''?null:typeof v==='string'&&/^\d{1,12}(?:\.\d{1,12})?$/.test(v)?v:typeof v==='number'&&Number.isFinite(v)&&v>=0?String(v):fail('INVALID_INSTRUMENT_READING');
export function validateTest(b,sql,s){
 if(!text(b.sample_id,100)||!text(b.device,160)||!text(b.analysis_mode,200)||!day(b.tested_at)||!text(b.identity_evidence)||!['unverified','confirmed','rejected'].includes(b.status)||!Array.isArray(b.points)||!b.points.length||b.points.length>30)fail('INVALID_STONE_TEST');
 const doc=first(sql,'SELECT * FROM xy_stone_documents WHERE id=? AND stone_id=?',b.document_id||'',s.id);
 if(b.is_public===true&&(!doc||doc.status!=='confirmed'||!doc.public_visible||b.status!=='confirmed'))fail('MATCHED_PUBLIC_ORIGINAL_REQUIRED');
 const labels=new Set();for(const p of b.points){if(!text(p.label,60)||labels.has(p.label)||!Array.isArray(p.readings)||!p.readings.length||p.readings.length>60)fail('INVALID_POINT');labels.add(p.label);if(p.photo_id){const photo=first(sql,'SELECT * FROM xy_stone_photos WHERE id=? AND stone_id=?',p.photo_id,s.id);if(!photo||!s.is_test&&!photo.verified_real||b.is_public===true&&!photo.is_public)fail('POINT_PHOTO_MISMATCH')}
  if((p.x!=null||p.y!=null)&&(!p.photo_id||![p.x,p.y].every(n=>typeof n==='number'&&n>=0&&n<=1)))fail('INVALID_POINT_POSITION');
  if(b.points.length>1&&b.is_public===true&&(!p.photo_id||p.x==null||p.y==null))fail('MULTIPOINT_PHOTO_REQUIRED');
  const elements=new Set();for(const r of p.readings){if(!/^[A-Z][a-z]?$/.test(r.element)||elements.has(r.element)||!['%','wt%','mg/kg','g/t','ppm','K'].includes(r.unit)||validDecimal(r.reading)===null)fail('INVALID_ELEMENT');elements.add(r.element);validDecimal(r.uncertainty??null)}
 }
 return b;
}
export async function handleStones(req,env,path){
 const db=env.FINANCE_DB,storage=env.XIANGYUN_STORAGE,method=req.method,code=path.match(/^\/certificates\/([^/]+)$/);
 if(code&&method==='GET')return publicCertificate(db,code[1],env);
 if(path==='/stones'&&method==='GET'){const template=new URL(req.url).searchParams.get('template');if(!template)return json({stones:[]});return json({stones:(await db.prepare('SELECT code,public_name,weight_g,series_prefix FROM xy_stones WHERE product_template_id=? AND published=1 AND is_test=0').bind(template).all()).results})}
 const media=path.match(/^\/(stone-media|stone-documents)\/([\w-]+)$/);
 if(media&&method==='GET'){
  const photo=media[1]==='stone-media',r=await db.prepare(photo?'SELECT a.*,s.published,s.is_test FROM xy_stone_photos a JOIN xy_stones s ON s.id=a.stone_id WHERE a.id=?':'SELECT a.*,s.published,s.is_test FROM xy_stone_documents a JOIN xy_stones s ON s.id=a.stone_id WHERE a.id=?').bind(media[2]).first();
  if(!r||r.is_test&&!testMode(env))return json({error:'NOT_FOUND'},404);
  if(!r.published||!(photo?r.is_public:r.public_visible&&r.status==='confirmed')){if(!await requireBrandAdmin(req,env))return json({error:'NOT_FOUND'},404)}
  if(r.fixture_path)return Response.redirect(new URL(r.fixture_path,req.url),307);const object=await env.MERCHANT_ASSETS.get(r.storage_key);if(!object)return json({error:'NOT_FOUND'},404);return new Response(object.body,{headers:{'content-type':photo?'image/webp':r.mime,'cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; frame-ancestors 'none'",'content-disposition':`inline; filename="${photo?'stone.webp':'record.pdf'}"`}});
 }
 if(!path.startsWith('/admin/stones'))return null;
 const admin=await requireBrandAdmin(req,env);if(!admin)return json({error:'ADMIN_REQUIRED'},401);const actor=admin.admin_user_id;
 if(method!=='GET'&&await rateLimit(db,'stone-admin:'+actor,60))return json({error:'RATE_LIMITED'},429);
 if(path==='/admin/stones/migration'&&method==='GET')return json({migration:await storage?.get?.('registry_v20_migration')||null});
 if(path==='/admin/stones'&&method==='GET')return json({stones:(await db.prepare('SELECT * FROM xy_stones ORDER BY created_at DESC,code').all()).results,test_mode:testMode(env)});
 if(path==='/admin/stones/preflight'&&method==='POST'){const b=await body(req);if(!Array.isArray(b.rows)||b.rows.length>100)fail('INVALID_IMPORT');return json({allocation:'NOT_ALLOCATED',rows:b.rows.map((r,i)=>{try{return{row:i+1,valid:true,record:validateStone(r,env)}}catch(e){return{row:i+1,valid:false,error:e.message}}})})}
 if((path==='/admin/stones'||path==='/admin/stones/import')&&method==='POST'){const b=await body(req);return json({stones:await registerStones(storage,path.endsWith('/import')?b.rows:[b],actor,eventKey(req),env)},201)}
 const documentUpdate=path.match(/^\/admin\/stones\/([\w-]+)\/(photos|documents)\/([\w-]+)$/);
 if(documentUpdate&&method==='PUT'){const b=await body(req),s=await adminStone(db,documentUpdate[1]),photo=documentUpdate[2]==='photos';own(storage,()=>{const table=photo?'xy_stone_photos':'xy_stone_documents',r=first(storage.sql,'SELECT * FROM '+table+' WHERE id=? AND stone_id=?',documentUpdate[3],s.id);if(!r)fail('NOT_FOUND',404);if(photo){if(s.published&&r.kind==='front'&&(!b.is_public||!b.verified_real)&&!s.is_test)fail('WITHDRAW_RECORD_BEFORE_HIDING_FRONT');storage.sql.exec('UPDATE xy_stone_photos SET is_public=?,verified_real=? WHERE id=?',b.is_public===true?1:0,b.verified_real===true?1:0,r.id)}else{if(b.public_visible===true&&b.reviewed_no_private_data!==true)fail('DOCUMENT_PRIVACY_REVIEW_REQUIRED');if(!['confirmed','unverified','rejected'].includes(b.status))fail('INVALID_DOCUMENT_STATUS');storage.sql.exec('UPDATE xy_stone_documents SET public_visible=?,status=?,verified_by=? WHERE id=?',b.public_visible===true?1:0,b.status,actor,r.id)}changed(storage.sql,s.id,actor,documentUpdate[2]+'.review')});return json({ok:true})}
 const match=path.match(/^\/admin\/stones\/([\w-]+)(?:\/(photos|documents|tests|publish|withdraw|audit))?$/);if(!match)return json({error:'NOT_FOUND'},404);
 const s=await adminStone(db,match[1]),action=match[2];
 if(method==='GET'){return json({stone:s,photos:(await db.prepare('SELECT * FROM xy_stone_photos WHERE stone_id=?').bind(s.id).all()).results,documents:(await db.prepare('SELECT id,doc_type,status,public_visible,sha256 FROM xy_stone_documents WHERE stone_id=?').bind(s.id).all()).results,tests:(await db.prepare('SELECT * FROM xy_stone_tests WHERE stone_id=?').bind(s.id).all()).results,audit:(await db.prepare('SELECT action,revision,created_at FROM xy_stone_audit WHERE stone_id=? ORDER BY created_at,id').bind(s.id).all()).results})}
 if((action==='photos'||action==='documents')&&method==='POST'){
  const length=Number(req.headers.get('content-length')||0);if(length>10*1024*1024)fail('TOO_LARGE',413);const form=await req.formData(),file=form.get('file');if(!file||typeof file.arrayBuffer!=='function'||file.size>8*1024*1024)fail('INVALID_FILE');const bytes=new Uint8Array(await file.arrayBuffer()),sig=String.fromCharCode(...bytes.slice(0,12));
  if(action==='photos'&&(file.type!=='image/webp'||!sig.startsWith('RIFF')||sig.slice(8)!=='WEBP'||new TextDecoder().decode(bytes).match(/EXIF|XMP /)))fail('WEBP_WITHOUT_LOCATION_METADATA_REQUIRED');
  if(action==='documents'&&(file.type!=='application/pdf'||!sig.startsWith('%PDF-')))fail('PDF_REQUIRED');
  const id=crypto.randomUUID(),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join(''),key='stone-registry/'+s.id+'/'+id;
  await env.MERCHANT_ASSETS.put(key,bytes,{httpMetadata:{contentType:file.type}});
  try{own(storage,()=>{if(action==='photos'){const kind=form.get('kind');if(!['front','back','side','macro'].includes(kind))fail('INVALID_PHOTO_KIND');storage.sql.exec('INSERT INTO xy_stone_photos(id,stone_id,storage_key,kind,verified_real,is_public,sha256,alt) VALUES(?,?,?,?,?,?,?,?)',id,s.id,key,kind,form.get('verified_real')==='true'?1:0,form.get('is_public')==='true'?1:0,digest,text(form.get('alt'),300))}
   else {const publicVisible=form.get('public_visible')==='true';if(publicVisible&&form.get('reviewed_no_private_data')!=='true')fail('DOCUMENT_PRIVACY_REVIEW_REQUIRED');storage.sql.exec('INSERT INTO xy_stone_documents(id,stone_id,storage_key,mime,sha256,doc_type,status,verified_by,public_visible) VALUES(?,?,?,?,?,?,?,?,?)',id,s.id,key,file.type,digest,text(form.get('doc_type'),100)||'measurement-original',form.get('confirmed')==='true'?'confirmed':'unverified',actor,publicVisible?1:0)}changed(storage.sql,s.id,actor,action+'.add')})}catch(e){await env.MERCHANT_ASSETS.delete(key);throw e}return json({id,sha256:digest},201);
 }
 if(action==='tests'&&method==='POST'){const b=await body(req);const id=own(storage,()=>{validateTest(b,storage.sql,s);const id=crypto.randomUUID();storage.sql.exec('INSERT INTO xy_stone_tests(id,stone_id,sample_id,device,analysis_mode,tested_at,institution,status,document_id,identity_evidence,is_public,reviewer) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',id,s.id,text(b.sample_id),text(b.device),text(b.analysis_mode),b.tested_at,text(b.institution),b.status,b.document_id||null,text(b.identity_evidence),b.is_public===true?1:0,actor);for(const p of b.points){const pid=crypto.randomUUID();storage.sql.exec('INSERT INTO xy_stone_test_points(id,test_id,point_label,photo_id,x,y) VALUES(?,?,?,?,?,?)',pid,id,text(p.label,60),p.photo_id||null,p.x??null,p.y??null);for(const r of p.readings)storage.sql.exec('INSERT INTO xy_stone_readings(id,point_id,element,reading,unit,uncertainty) VALUES(?,?,?,?,?,?)',crypto.randomUUID(),pid,r.element,validDecimal(r.reading),r.unit,validDecimal(r.uncertainty??null))}changed(storage.sql,s.id,actor,'test.add');return id});return json({id},201)}
 if((action==='publish'||action==='withdraw')&&method==='POST'){const b=await body(req);own(storage,()=>{const current=first(storage.sql,'SELECT * FROM xy_stones WHERE id=?',s.id);if(b.revision!==current.revision)fail('REVISION_CONFLICT',409);if(action==='publish'&&!current.is_test&&!first(storage.sql,"SELECT id FROM xy_stone_photos WHERE stone_id=? AND kind='front' AND verified_real=1 AND is_public=1",s.id))fail('VERIFIED_FRONT_PHOTO_REQUIRED');if(current.is_test&&!testMode(env))fail('TEST_RECORDS_DISABLED');storage.sql.exec('UPDATE xy_stones SET published=?,ever_published=MAX(ever_published,?),revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?',action==='publish'?1:0,action==='publish'?1:0,s.id);audit(storage.sql,s.id,actor,action,current.revision+1)});return json({ok:true})}
 if(!action&&method==='PUT'){const b=await body(req);if('code'in b||'series_prefix'in b||'sequence_number'in b||'is_test'in b)fail('PERMANENT_CODE');own(storage,()=>{const current=first(storage.sql,'SELECT * FROM xy_stones WHERE id=?',s.id);if(b.revision!==current.revision)fail('REVISION_CONFLICT',409);const candidate={...current,...b,is_test:!!current.is_test};delete candidate.code;delete candidate.sequence_number;const next=validateStone(candidate,env);const fields=Object.keys(next).filter(k=>!['series_prefix','is_test'].includes(k));storage.sql.exec('UPDATE xy_stones SET '+fields.map(k=>k+'=?').join(',')+',revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?',...fields.map(k=>next[k]),s.id);audit(storage.sql,s.id,actor,'correct',current.revision+1)});return json({ok:true})}
 return json({error:'METHOD_NOT_ALLOWED'},405);
}
