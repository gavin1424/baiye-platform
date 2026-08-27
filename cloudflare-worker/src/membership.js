const encoder = new TextEncoder();
const decoder = new TextDecoder();
const ACTIONS = ["ORDER", "BOOKING", "COUPON", "SHOP", "MEMBER_CARD", "MERCHANT_HOME"];

function json(data, status = 200, headers = {}) { return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=UTF-8", ...headers } }); }
function id(prefix) { return `${prefix}_${crypto.randomUUID()}`; }
function now() { return new Date().toISOString(); }
function base64url(bytes) { let raw=""; for (const chunk of new Uint8Array(bytes)) raw += String.fromCharCode(chunk); return btoa(raw).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,""); }
function unbase64url(value) { const raw = atob(String(value).replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(value.length / 4) * 4,"=")); return Uint8Array.from(raw, char => char.charCodeAt(0)); }
async function hmac(value, secret) { const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name:"HMAC", hash:"SHA-256" }, false, ["sign"]); return base64url(await crypto.subtle.sign("HMAC", key, encoder.encode(value))); }
async function hash(value) { return base64url(await crypto.subtle.digest("SHA-256", encoder.encode(value))); }
function equal(left, right) { if (!left || left.length !== right.length) return false; let result=0; for(let i=0;i<left.length;i+=1) result|=left.charCodeAt(i)^right.charCodeAt(i); return result===0; }
async function data(request) { try { return await request.json(); } catch { return {}; } }
function clientIp(request) { return request.headers.get("CF-Connecting-IP") || ""; }

async function passwordHash(password, salt, secret) { return hmac(`member-password-v1:${salt}:${password}`, secret); }
async function userSession(user, env) { const payload=base64url(encoder.encode(JSON.stringify({ user_id:user.id, exp:Date.now()+7*24*60*60*1000 }))); return `${payload}.${await hmac(payload, env.MEMBER_SESSION_SECRET)}`; }
async function userAuth(request, env) {
  const token=(request.headers.get("cookie")||"").match(/(?:^|;\s*)member_session=([^;]+)/)?.[1];
  if (!token || !env.MEMBER_SESSION_SECRET) return null;
  const [payload, signature]=token.split(".");
  if (!payload || !equal(signature, await hmac(payload, env.MEMBER_SESSION_SECRET))) return null;
  try { const decoded=JSON.parse(decoder.decode(unbase64url(payload))); return decoded.exp>Date.now() ? decoded.user_id : null; } catch { return null; }
}
async function financeAdmin(request, env) {
  const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
  if (!token || !env.FINANCE_SESSION_SECRET) return false;
  const [payload, signature]=token.split(".");
  if (!payload || !equal(signature, await hmac(payload, env.FINANCE_SESSION_SECRET))) return false;
  try { return JSON.parse(decoder.decode(unbase64url(payload))).exp>Date.now(); } catch { return false; }
}
async function audit(db, request, actorType, actorId, action, entityType, entityId, metadata={}) { await db.prepare("INSERT INTO audit_logs (id,actor_type,actor_id,action,entity_type,entity_id,metadata,ip_address) VALUES (?,?,?,?,?,?,?,?)").bind(id("audit"),actorType,actorId,action,entityType,entityId,JSON.stringify(metadata),null).run(); }
function parseActions(value) { try { const actions=JSON.parse(value||"[]"); return Array.isArray(actions) ? actions.filter(action=>ACTIONS.includes(action)) : []; } catch { return []; } }
function secureCookie(value, maxAge) { return `member_session=${value}; HttpOnly; Secure; SameSite=None; Partitioned; Path=/api; Max-Age=${maxAge}`; }
async function signedToken(nonce, env) { return `${nonce}.${await hmac(nonce, env.QR_TOKEN_SECRET)}`; }
async function verifyToken(token, env) { const [nonce, signature, extra]=String(token||"").split("."); return !extra && /^[A-Za-z0-9_-]{32,}$/.test(nonce||"") && equal(signature, await hmac(nonce, env.QR_TOKEN_SECRET)) ? nonce : null; }
function redirectFor(qr, profile) {
  const context=new URLSearchParams({ qr_code_id:qr.id });
  if (qr.branch_id) context.set("branch_id",qr.branch_id); if (qr.table_no) context.set("table_no",qr.table_no); if (qr.campaign_id) context.set("campaign_id",qr.campaign_id);
  // Only routes owned by this HashRouter are emitted. ORDER is unavailable until a real merchant ordering route is enabled.
  return `#/business/${encodeURIComponent(profile.slug)}?${context.toString()}`;
}
async function lookupQr(db, token, env) {
  if (!env.QR_TOKEN_SECRET || !(await verifyToken(token,env))) return null;
  const tokenHash=await hash(token);
  const row=await db.prepare("SELECT q.*,m.name merchant_name,m.status merchant_status,p.slug,p.logo_url,p.contact_url,p.enabled_actions FROM merchant_qr_codes q JOIN merchants m ON m.id=q.merchant_id JOIN merchant_public_profiles p ON p.merchant_id=q.merchant_id WHERE q.token_hash=?").bind(tokenHash).first();
  if (!row || !row.is_active || row.merchant_status!=="active" || (row.expires_at && Date.parse(row.expires_at)<=Date.now()) || !parseActions(row.enabled_actions).includes(row.action)) return null;
  return row;
}
async function merchantAdmin(db, request, env, merchantId) {
  const userId=await userAuth(request,env); if (!userId) return { error:json({error:"Member authentication required"},401), userId:null };
  const access=await db.prepare("SELECT role FROM merchant_admins WHERE merchant_id=? AND user_id=? AND status='active'").bind(merchantId,userId).first();
  return access ? { userId, role:access.role } : { error:json({error:"Merchant administrator access required"},403), userId:null };
}
function publicQr(row, env) { return signedToken(row.token_nonce,env).then(token=>({ id:row.id,name:row.name,branch_id:row.branch_id,table_no:row.table_no,action:row.action,redirect_target:row.redirect_target,campaign_id:row.campaign_id,reward_points:row.reward_points,coupon_id:row.coupon_id,is_active:Boolean(row.is_active),expires_at:row.expires_at,created_at:row.created_at,join_url:`https://baiyeconnect.com/#/join/${encodeURIComponent(row.slug)}?q=${encodeURIComponent(token)}` })); }

export async function handleMembershipRequest(request, env, url, cors) {
  const db=env.FINANCE_DB;
  if (!db) return json({error:"Membership database unavailable"},503,cors);
  const path=url.pathname;
  if (path==="/api/member/register" && request.method==="POST") {
    const input=await data(request), email=String(input.email||"").trim().toLowerCase(), password=String(input.password||"");
    if (!env.MEMBER_SESSION_SECRET || !email.includes("@") || password.length<12) return json({error:"請輸入有效 Email 與至少 12 碼密碼"},400,cors);
    const uid=id("user"), salt=crypto.randomUUID(), passwordHashValue=await passwordHash(password,salt,env.MEMBER_SESSION_SECRET);
    try { await db.prepare("INSERT INTO platform_users (id,email,display_name,password_hash,password_salt) VALUES (?,?,?,?,?)").bind(uid,email,String(input.display_name||"").trim().slice(0,80)||null,passwordHashValue,salt).run(); const user={id:uid,email,display_name:String(input.display_name||"").trim()}; await audit(db,request,"user",uid,"member_registered","platform_user",uid); return json({user},201,{...cors,"set-cookie":secureCookie(await userSession(user,env),604800)}); } catch { return json({error:"此 Email 已註冊，請直接登入"},409,cors); }
  }
  if (path==="/api/member/login" && request.method==="POST") {
    const input=await data(request), email=String(input.email||"").trim().toLowerCase(), user=await db.prepare("SELECT * FROM platform_users WHERE email=?").bind(email).first();
    const valid=!!user && user.status==="active" && env.MEMBER_SESSION_SECRET && equal(user.password_hash,await passwordHash(String(input.password||""),user.password_salt,env.MEMBER_SESSION_SECRET));
    if (!valid) return json({error:"Email、密碼錯誤或帳號不可用"},401,cors);
    await audit(db,request,"user",user.id,"member_login","platform_user",user.id); return json({user:{id:user.id,email:user.email,display_name:user.display_name}},200,{...cors,"set-cookie":secureCookie(await userSession(user,env),604800)});
  }
  if (path==="/api/member/logout" && request.method==="POST") return json({ok:true},200,{...cors,"set-cookie":secureCookie("",0)});
  if (path==="/api/member/me" && request.method==="GET") { const userId=await userAuth(request,env); if(!userId)return json({error:"Member authentication required"},401,cors); const user=await db.prepare("SELECT id,email,display_name,status FROM platform_users WHERE id=?").bind(userId).first(); return user ? json({user},200,cors) : json({error:"Member authentication required"},401,cors); }

  if (path==="/api/join/resolve" && request.method==="POST") {
    const input=await data(request), qr=await lookupQr(db,input.token,env); if(!qr)return json({error:"此 QR Code 目前無法使用，請向店家工作人員確認。"},404,cors);
    const visitorHash=await hmac(`${new Date().toISOString().slice(0,10)}|${clientIp(request)}|${request.headers.get("user-agent")||""}`,env.QR_TOKEN_SECRET);
    await db.prepare("INSERT INTO merchant_qr_scan_events (id,qr_code_id,merchant_id,event_type,visitor_hash) VALUES (?,?,?,?,?)").bind(id("scan"),qr.id,qr.merchant_id,"scan",visitorHash).run();
    return json({merchant:{id:qr.merchant_id,slug:qr.slug,name:qr.merchant_name,logo_url:qr.logo_url,contact_url:qr.contact_url},qr:{id:qr.id,branch_id:qr.branch_id,table_no:qr.table_no,action:qr.action,campaign_id:qr.campaign_id},redirect_path:redirectFor(qr,qr)},200,cors);
  }
  if (path==="/api/join/complete" && request.method==="POST") {
    const userId=await userAuth(request,env); if(!userId)return json({error:"請先完成平台會員登入"},401,cors);
    const input=await data(request), qr=await lookupQr(db,input.token,env); if(!qr)return json({error:"此 QR Code 目前無法使用，請向店家工作人員確認。"},404,cors);
    if (!input.consent || !input.consent_version) return json({error:"請先同意會員條款與隱私權政策"},400,cors);
    const timestamp=now(), membershipId=id("membership"), number=`M${Date.now()}${crypto.randomUUID().slice(0,4).toUpperCase()}`;
    await db.prepare("INSERT OR IGNORE INTO merchant_memberships (id,merchant_id,user_id,member_number,status,points,joined_via,joined_at,branch_id,campaign_id,consent_version,consent_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(membershipId,qr.merchant_id,userId,number,"active",Number(qr.reward_points)||0,"QR_CODE",timestamp,qr.branch_id||null,qr.campaign_id||null,String(input.consent_version).slice(0,40),timestamp).run();
    const membership=await db.prepare("SELECT id,member_number,joined_at FROM merchant_memberships WHERE merchant_id=? AND user_id=?").bind(qr.merchant_id,userId).first(); const joined=membership.id===membershipId;
    await db.prepare("INSERT INTO merchant_qr_scan_events (id,qr_code_id,merchant_id,user_id,event_type) VALUES (?,?,?,?,?)").bind(id("scan"),qr.id,qr.merchant_id,userId,joined?"joined":"already_member").run();
    await audit(db,request,"user",userId,joined?"merchant_membership_joined":"merchant_membership_reopened","merchant_membership",membership.id,{merchant_id:qr.merchant_id,qr_code_id:qr.id,joined_via:"QR_CODE"});
    return json({membership,already_member:!joined,redirect_path:redirectFor(qr,qr)},200,cors);
  }

  if (path==="/api/merchant/qr-codes" && request.method==="GET") {
    const userId=await userAuth(request,env); if(!userId)return json({error:"Member authentication required"},401,cors);
    const assignments=(await db.prepare("SELECT a.merchant_id,a.role,m.name,p.slug,p.enabled_actions FROM merchant_admins a JOIN merchants m ON m.id=a.merchant_id JOIN merchant_public_profiles p ON p.merchant_id=a.merchant_id WHERE a.user_id=? AND a.status='active' AND m.status='active'").bind(userId).all()).results;
    const merchantId=url.searchParams.get("merchant_id"); if(!merchantId)return json({merchants:assignments.map(item=>({...item,enabled_actions:parseActions(item.enabled_actions)})),items:[]},200,cors);
    if(!assignments.some(item=>item.merchant_id===merchantId))return json({error:"Merchant administrator access required"},403,cors);
    const rows=(await db.prepare("SELECT q.*,p.slug FROM merchant_qr_codes q JOIN merchant_public_profiles p ON p.merchant_id=q.merchant_id WHERE q.merchant_id=? ORDER BY q.created_at DESC").bind(merchantId).all()).results;
    const items=await Promise.all(rows.map(async row=>{ const stats=await db.prepare("SELECT COUNT(*) scans,COUNT(DISTINCT visitor_hash) unique_scans,SUM(CASE WHEN event_type='joined' THEN 1 ELSE 0 END) joins,SUM(CASE WHEN event_type='already_member' THEN 1 ELSE 0 END) existing_members,MAX(created_at) recent_scan FROM merchant_qr_scan_events WHERE qr_code_id=?").bind(row.id).first(); return {...await publicQr(row,env),stats:{scans:Number(stats.scans||0),unique_scans:Number(stats.unique_scans||0),joins:Number(stats.joins||0),existing_members:Number(stats.existing_members||0),recent_scan:stats.recent_scan||null}};}));
    return json({merchants:assignments.map(item=>({...item,enabled_actions:parseActions(item.enabled_actions)})),items},200,cors);
  }
  if (path==="/api/merchant/qr-codes" && request.method==="POST") {
    const input=await data(request), merchantId=String(input.merchant_id||""), auth=await merchantAdmin(db,request,env,merchantId); if(auth.error)return new Response(auth.error.body,{status:auth.error.status,headers:{...cors,"content-type":"application/json; charset=UTF-8"}});
    const profile=await db.prepare("SELECT * FROM merchant_public_profiles WHERE merchant_id=?").bind(merchantId).first(); const action=String(input.action||"MERCHANT_HOME"), name=String(input.name||"").trim().slice(0,100); if(!name)return json({error:"QR Code 名稱為必填"},400,cors); if(!profile||!ACTIONS.includes(action)||!parseActions(profile.enabled_actions).includes(action))return json({error:"此商家尚未開通所選功能"},400,cors);
    const expiresAt=input.expires_at?new Date(input.expires_at).toISOString():null; if(expiresAt&&Date.parse(expiresAt)<=Date.now())return json({error:"有效期限必須為未來時間"},400,cors);
    const nonce=base64url(crypto.getRandomValues(new Uint8Array(32))), token=await signedToken(nonce,env), qrId=id("qr"); await db.prepare("INSERT INTO merchant_qr_codes (id,merchant_id,branch_id,name,table_no,action,redirect_target,token_nonce,token_hash,campaign_id,reward_points,coupon_id,expires_at,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(qrId,merchantId,input.branch_id||null,name,input.table_no||null,action,action,nonce,await hash(token),input.campaign_id||null,Math.max(0,Number(input.reward_points)||0),null,expiresAt,auth.userId).run(); const qr=await db.prepare("SELECT q.*,p.slug FROM merchant_qr_codes q JOIN merchant_public_profiles p ON p.merchant_id=q.merchant_id WHERE q.id=?").bind(qrId).first(); await audit(db,request,"user",auth.userId,"merchant_qr_created","merchant_qr_code",qrId,{merchant_id:merchantId,action}); return json({item:await publicQr(qr,env)},201,cors);
  }
  const qrRoute=path.match(/^\/api\/merchant\/qr-codes\/([^/]+)$/);
  if(qrRoute&&request.method==="PATCH") { const input=await data(request), qr=await db.prepare("SELECT q.*,p.slug,p.enabled_actions FROM merchant_qr_codes q JOIN merchant_public_profiles p ON p.merchant_id=q.merchant_id WHERE q.id=?").bind(qrRoute[1]).first(); if(!qr)return json({error:"Not found"},404,cors); const auth=await merchantAdmin(db,request,env,qr.merchant_id);if(auth.error)return new Response(auth.error.body,{status:auth.error.status,headers:{...cors,"content-type":"application/json; charset=UTF-8"}}); const action=input.action===undefined?qr.action:String(input.action);if(!ACTIONS.includes(action)||!parseActions(qr.enabled_actions).includes(action))return json({error:"此商家尚未開通所選功能"},400,cors); const nonce=input.regenerate?base64url(crypto.getRandomValues(new Uint8Array(32))):null; const token=nonce?await signedToken(nonce,env):null; const expiry=input.expires_at===undefined?qr.expires_at:(input.expires_at?new Date(input.expires_at).toISOString():null);if(expiry&&Date.parse(expiry)<=Date.now())return json({error:"有效期限必須為未來時間"},400,cors); await db.prepare("UPDATE merchant_qr_codes SET name=?,branch_id=?,table_no=?,action=?,redirect_target=?,campaign_id=?,reward_points=?,is_active=?,expires_at=?,token_nonce=COALESCE(?,token_nonce),token_hash=COALESCE(?,token_hash),updated_at=? WHERE id=?").bind(String(input.name??qr.name).trim().slice(0,100),input.branch_id??qr.branch_id,input.table_no??qr.table_no,action,action,input.campaign_id??qr.campaign_id,Math.max(0,Number(input.reward_points??qr.reward_points)||0),input.is_active===undefined?qr.is_active:(input.is_active?1:0),expiry,nonce,token?await hash(token):null,now(),qr.id).run(); const updated=await db.prepare("SELECT q.*,p.slug FROM merchant_qr_codes q JOIN merchant_public_profiles p ON p.merchant_id=q.merchant_id WHERE q.id=?").bind(qr.id).first();await audit(db,request,"user",auth.userId,input.regenerate?"merchant_qr_regenerated":"merchant_qr_updated","merchant_qr_code",qr.id,{merchant_id:qr.merchant_id});return json({item:await publicQr(updated,env)},200,cors); }
  if(path==="/api/admin/merchant-admins" && request.method==="POST") { if(!(await financeAdmin(request,env)))return json({error:"Finance administrator authentication required"},401,cors); const input=await data(request);const merchant=await db.prepare("SELECT id FROM merchants WHERE id=?").bind(input.merchant_id||"").first(),user=await db.prepare("SELECT id FROM platform_users WHERE id=?").bind(input.user_id||"").first();if(!merchant||!user)return json({error:"Merchant or user not found"},404,cors);await db.prepare("INSERT INTO merchant_admins (merchant_id,user_id,role,status) VALUES (?,?,?,?) ON CONFLICT(merchant_id,user_id) DO UPDATE SET role=excluded.role,status=excluded.status,updated_at=CURRENT_TIMESTAMP").bind(merchant.id,user.id,input.role==="owner"?"owner":"manager",input.status==="disabled"?"disabled":"active").run();await audit(db,request,"admin","finance","merchant_admin_assigned","merchant_admin",`${merchant.id}:${user.id}`,{merchant_id:merchant.id,user_id:user.id});return json({ok:true},200,cors); }
  return json({error:"Not found"},404,cors);
}
