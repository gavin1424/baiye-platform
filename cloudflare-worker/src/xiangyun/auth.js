const E=new TextEncoder(),COOKIE='__Host-xiangyun_session';
const hex=b=>Array.from(new Uint8Array(b),n=>n.toString(16).padStart(2,'0')).join('');
export const hash=async s=>hex(await crypto.subtle.digest('SHA-256',E.encode(s)));
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
export async function passwordHash(password,salt){const k=await crypto.subtle.importKey('raw',E.encode(password),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:E.encode(salt),iterations:100000,hash:'SHA-256'},k,256))}
const cookie=(token,age=28800)=>`${COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${age}`;
export const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{'cache-control':'no-store',...headers}});
export async function authenticateMember(db,req){
 const token=(req.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
 if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
 const row=await db.prepare("SELECT m.*,s.csrf FROM xy_sessions s JOIN xy_members m ON m.id=s.member_id WHERE s.token_hash=? AND s.expires_at>? AND m.status='active'").bind(await hash(token),Date.now()).first();
 if(row&&!['GET','HEAD'].includes(req.method)&&req.headers.get('x-csrf-token')!==row.csrf)return null;
 return row;
}
export async function requireBrandAdmin(req,env){const m=await authenticateMember(env.FINANCE_DB,req);return m?.role==='admin'?{admin_user_id:m.id}:null}
export async function rateLimit(db,key,max=8){const bucket=Math.floor(Date.now()/900000),digest=await hash(key);await db.prepare('INSERT INTO xy_rate_limits(key,bucket,attempts) VALUES(?,?,1) ON CONFLICT(key,bucket) DO UPDATE SET attempts=attempts+1').bind(digest,bucket).run();const row=await db.prepare('SELECT attempts FROM xy_rate_limits WHERE key=? AND bucket=?').bind(digest,bucket).first();await db.prepare('DELETE FROM xy_rate_limits WHERE bucket<?').bind(bucket-2).run();return row.attempts>max}
export async function handleAuth(req,env,path){
 const db=env.FINANCE_DB;
 if(path==='/auth/session'&&req.method==='GET'){const m=await authenticateMember(db,req);return m?json({member:{id:m.id,email:m.email,display_name:m.display_name,member_no:m.member_no,role:m.role,email_verified:false},csrf:m.csrf}):json({error:'MEMBER_REQUIRED'},401)}
 if(!['/auth/register','/auth/login'].includes(path)||req.method!=='POST')return null;
 if(await rateLimit(db,'auth:'+String(req.headers.get('cf-connecting-ip')||'unknown'),12))return json({error:'RATE_LIMITED'},429);
 if(Number(req.headers.get('content-length')||0)>8192)return json({error:'TOO_LARGE'},413);
 const raw=await req.text();if(raw.length>8192)return json({error:'TOO_LARGE'},413);let b;try{b=JSON.parse(raw)}catch{return json({error:'INVALID_JSON'},400)}
 const email=String(b.email||'').trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||typeof b.password!=='string'||b.password.length<12||b.password.length>128)return json({error:'INVALID_CREDENTIALS'},422);
 if(await rateLimit(db,'email:'+email,8))return json({error:'RATE_LIMITED'},429);
 let m=await db.prepare('SELECT * FROM xy_members WHERE email=?').bind(email).first();
 if(path==='/auth/register'){
  if(m)return json({error:'REGISTRATION_UNAVAILABLE'},409);
  const id=crypto.randomUUID(),salt=random(),pw=await passwordHash(b.password,salt);
  try{await db.prepare('INSERT INTO xy_members(id,email,password_hash,salt,display_name,member_no) VALUES(?,?,?,?,?,?)').bind(id,email,pw,salt,String(b.display_name||'').trim().slice(0,80),'XY-'+id.slice(0,12).toUpperCase()).run()}catch{return json({error:'REGISTRATION_UNAVAILABLE'},409)}
  m=await db.prepare('SELECT * FROM xy_members WHERE id=?').bind(id).first();
 }else{
  // Derive also for unknown email; errors do not reveal account existence.
  const candidate=await passwordHash(b.password,m?.salt||'xiangyun-dummy-salt-v1');let difference=0;
  for(let i=0;i<64;i++)difference|=candidate.charCodeAt(i)^(m?.password_hash||'0'.repeat(64)).charCodeAt(i);
  if(!m||difference||m.status!=='active')return json({error:'INVALID_CREDENTIALS'},401);
 }
 const token=random(),csrf=random();await db.prepare('DELETE FROM xy_sessions WHERE expires_at<=?').bind(Date.now()).run();
 await db.prepare('INSERT INTO xy_sessions(token_hash,member_id,csrf,expires_at) VALUES(?,?,?,?)').bind(await hash(token),m.id,csrf,Date.now()+28800000).run();
 return json({member:{id:m.id,member_no:m.member_no,role:m.role},csrf,email_verified:false},path==='/auth/register'?201:200,{'set-cookie':cookie(token)});
}
export const clearCookie=()=>cookie('',0);
