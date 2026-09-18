const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type":"application/json; charset=UTF-8", "cache-control":"no-store", "x-robots-tag":"noindex, nofollow", ...headers } });
const rows = async (statement) => (await statement.all()).results || [];
const safeStatus = (value, allowed, fallback) => allowed.includes(value) ? value : fallback;
const metadata = (request) => JSON.stringify({ ip:request.headers.get("CF-Connecting-IP")||"unknown", user_agent:(request.headers.get("user-agent")||"").slice(0,300) });
const checklistCodes=['CLIENT_DATA','LOGO','BRAND','DOMAIN','HOME','PRODUCTS_SERVICES','LINE_OA','AI_CUSTOMER_SERVICE','WEBSITE_BOOKING','MEMBERSHIP','POSLESS_ORDERING','PAYMENT','PRODUCTION','CLIENT_ACCEPTANCE'];
const serviceCodes=['website','ai_customer_service','line_oa','membership','website_booking','posless_ordering','contract_system','payment','inventory','other'];
const clean=(value,max=1000)=>String(value??'').trim().slice(0,max);
const optional=(value,max=1000)=>clean(value,max)||null;
const integer=(value)=>Number.isSafeInteger(Number(value))&&Number(value)>=0?Number(value):null;
const freshReauth=(owner)=>{ const raw=String(owner?.reauth_at||'').replace(' ','T'); const at=Date.parse(raw.endsWith('Z')?raw:`${raw}Z`); return Number.isFinite(at)&&Date.now()-at<=15*60*1000; };
const reauthRequired=(owner,cors)=>freshReauth(owner)?null:json({error:"此操作需要重新驗證 Owner 身分。",code:"reauth_required"},428,cors);

async function audit(db, request, actor, action, entityType, entityId, before, after) {
  await db.prepare("INSERT INTO owner_audit_logs(id,actor_id,action,entity_type,entity_id,before_json,after_json,request_metadata_json) VALUES(?,?,?,?,?,?,?,?)")
    .bind(`oaud_${crypto.randomUUID()}`,actor,action,entityType,entityId,before?JSON.stringify(before):null,after?JSON.stringify(after):null,metadata(request)).run();
}

const parseSecretStatus = (value) => {
  let parsed={}; try { parsed=JSON.parse(value||"{}"); } catch {}
  return Object.fromEntries(Object.entries(parsed).map(([key,status])=>[key,["Configured","Missing","Invalid","Unknown"].includes(status)?status:"Unknown"]));
};

export async function handleOwnerAdmin(request, env, url, cors, owner) {
  const db=env.FINANCE_DB;
  if (url.pathname==="/api/owner/dashboard" && request.method==="GET") {
    const [metrics,recent,tasks,alerts]=await Promise.all([
      db.prepare(`SELECT
        (SELECT COUNT(*) FROM merchants) merchant_total,
        (SELECT COUNT(*) FROM merchant_owner_profiles WHERE lifecycle_status IN ('NEW','IN_PROGRESS','WAITING_CLIENT','WAITING_PAYMENT','WAITING_APPROVAL')) active_cases,
        (SELECT COUNT(*) FROM website_projects WHERE status IN ('IN_PROGRESS','TESTING')) websites_building,
        (SELECT COUNT(*) FROM website_projects WHERE status='WAITING_CLIENT_DATA') waiting_client,
        (SELECT COUNT(*) FROM owner_contracts WHERE contract_status='WAITING_SIGNATURE') waiting_signature,
        (SELECT COUNT(*) FROM owner_receivables WHERE payment_status IN ('UNPAID','PARTIAL','OVERDUE')) pending_receivables,
        (SELECT COUNT(*) FROM merchants WHERE strftime('%Y-%m',created_at)=strftime('%Y-%m','now')) new_this_month,
        (SELECT COUNT(*) FROM owner_system_monitors WHERE health_status IN ('WARNING','DOWN')) production_alerts,
        (SELECT COUNT(*) FROM owner_tasks WHERE status!='DONE' AND date(due_date)<=date('now')) tasks_today`).first(),
      rows(db.prepare("SELECT m.id,m.name,COALESCE(p.lifecycle_status,'NEW') stage,COALESCE(w.status,'NOT_STARTED') website_status,m.updated_at,COALESCE(w.next_step,'尚未填寫') next_step FROM merchants m LEFT JOIN merchant_owner_profiles p ON p.merchant_id=m.id LEFT JOIN website_projects w ON w.merchant_id=m.id ORDER BY m.updated_at DESC LIMIT 8")),
      rows(db.prepare("SELECT t.*,m.name merchant_name FROM owner_tasks t LEFT JOIN merchants m ON m.id=t.merchant_id WHERE t.status!='DONE' ORDER BY CASE t.priority WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'NORMAL' THEN 3 ELSE 4 END,due_date LIMIT 10")),
      rows(db.prepare("SELECT s.*,m.name merchant_name FROM owner_system_monitors s JOIN merchants m ON m.id=s.merchant_id WHERE s.health_status IN ('WARNING','DOWN','UNKNOWN') ORDER BY CASE s.health_status WHEN 'DOWN' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END,last_checked_at LIMIT 10")),
    ]);
    return json({metrics,recent,tasks,alerts},200,cors);
  }
  if (url.pathname==="/api/owner/merchants" && request.method==="GET") {
    const q=`%${(url.searchParams.get("q")||"").trim().slice(0,100)}%`, status=url.searchParams.get("status")||"";
    const items=await rows(db.prepare("SELECT m.id merchant_id,m.merchant_code,m.name business_name,COALESCE(p.legal_name,'尚未填寫') legal_name,COALESCE(p.owner_name,p.contact_name,m.contact_name,'尚未填寫') owner_name,COALESCE(p.phone,p.mobile,m.phone,'尚未填寫') phone,COALESCE(p.email,m.email,'尚未填寫') email,COALESCE(p.lifecycle_status,'NEW') status,COALESCE(p.plan_code,'尚未填寫') plan_code,COALESCE(w.status,'NOT_STARTED') website_status,COALESCE((SELECT contract_status FROM owner_contracts c WHERE c.merchant_id=m.id AND c.archived_at IS NULL ORDER BY c.updated_at DESC LIMIT 1),'DRAFT') contract_status,COALESCE((SELECT payment_status FROM owner_receivables r WHERE r.merchant_id=m.id ORDER BY r.updated_at DESC LIMIT 1),'UNPAID') payment_status,m.updated_at FROM merchants m LEFT JOIN merchant_owner_profiles p ON p.merchant_id=m.id LEFT JOIN website_projects w ON w.merchant_id=m.id WHERE (m.name LIKE ? OR m.merchant_code LIKE ? OR COALESCE(m.email,'') LIKE ?) AND (?='' OR COALESCE(p.lifecycle_status,'NEW')=?) ORDER BY m.updated_at DESC").bind(q,q,q,status,status));
    return json({items},200,cors);
  }
  const merchantMatch=url.pathname.match(/^\/api\/owner\/merchants\/([^/]+)$/);
  if (merchantMatch && request.method==="GET") {
    const id=decodeURIComponent(merchantMatch[1]);
    const merchant=await db.prepare("SELECT m.id merchant_id,m.merchant_code,m.name business_name,m.status merchant_status,m.created_at,m.updated_at,p.* FROM merchants m LEFT JOIN merchant_owner_profiles p ON p.merchant_id=m.id WHERE m.id=?").bind(id).first();
    if(!merchant)return json({error:"找不到商家。"},404,cors);
    const [contracts,receivables,project,checklist,services,documents,tasks,assets,monitor,auditLogs]=await Promise.all([
      rows(db.prepare("SELECT * FROM owner_contracts WHERE merchant_id=? AND archived_at IS NULL ORDER BY updated_at DESC").bind(id)),
      rows(db.prepare("SELECT * FROM owner_receivables WHERE merchant_id=? ORDER BY updated_at DESC").bind(id)),
      db.prepare("SELECT * FROM website_projects WHERE merchant_id=?").bind(id).first(),
      rows(db.prepare("SELECT c.* FROM website_project_checklist c JOIN website_projects p ON p.id=c.project_id WHERE p.merchant_id=? ORDER BY c.item_code").bind(id)),
      rows(db.prepare("SELECT * FROM merchant_services WHERE merchant_id=? ORDER BY service_code").bind(id)),
      rows(db.prepare("SELECT id,type,filename,mime_type,uploaded_at,uploaded_by FROM owner_documents WHERE merchant_id=? AND archived_at IS NULL ORDER BY uploaded_at DESC").bind(id)),
      rows(db.prepare("SELECT * FROM owner_tasks WHERE merchant_id=? ORDER BY updated_at DESC").bind(id)),
      db.prepare("SELECT production_url,staging_url,domain,domain_provider,domain_expiry,github_repo,cloudflare_project,deployment_id,latest_commit_sha,line_oa_name,line_basic_id,liff_id,google_business,secret_status_json,notes,updated_at FROM merchant_system_assets WHERE merchant_id=?").bind(id).first(),
      db.prepare("SELECT * FROM owner_system_monitors WHERE merchant_id=?").bind(id).first(),
      rows(db.prepare("SELECT * FROM owner_audit_logs WHERE entity_id=? ORDER BY created_at DESC LIMIT 50").bind(id)),
    ]);
    if(assets)assets.secret_status=parseSecretStatus(assets.secret_status_json),delete assets.secret_status_json;
    return json({merchant,contracts,receivables,project,checklist,services,documents,tasks,assets,monitor,audit:auditLogs},200,cors);
  }
  if (merchantMatch && request.method==="PATCH") {
    const id=decodeURIComponent(merchantMatch[1]),exists=await db.prepare("SELECT id,name,contact_name,phone,email FROM merchants WHERE id=?").bind(id).first();
    if(!exists)return json({error:"找不到商家。"},404,cors);
    const before=await db.prepare("SELECT * FROM merchant_owner_profiles WHERE merchant_id=?").bind(id).first(); let input={};try{input=await request.json();}catch{}
    const lifecycle=safeStatus(input.lifecycle_status,['NEW','IN_PROGRESS','WAITING_CLIENT','WAITING_PAYMENT','WAITING_APPROVAL','COMPLETED','PAUSED','TERMINATED'],before?.lifecycle_status||'NEW');
    await db.prepare(`INSERT INTO merchant_owner_profiles(merchant_id,business_name,legal_name,owner_name,contact_name,phone,mobile,email,tax_id,address,line_contact,plan_code,lifecycle_status,notes)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(merchant_id) DO UPDATE SET business_name=excluded.business_name,legal_name=excluded.legal_name,owner_name=excluded.owner_name,contact_name=excluded.contact_name,phone=excluded.phone,mobile=excluded.mobile,email=excluded.email,tax_id=excluded.tax_id,address=excluded.address,line_contact=excluded.line_contact,plan_code=excluded.plan_code,lifecycle_status=excluded.lifecycle_status,notes=excluded.notes,updated_at=CURRENT_TIMESTAMP`)
      .bind(id,optional(input.business_name||exists.name,200),optional(input.legal_name,200),optional(input.owner_name,100),optional(input.contact_name||exists.contact_name,100),optional(input.phone||exists.phone,50),optional(input.mobile,50),optional(input.email||exists.email,200),optional(input.tax_id,30),optional(input.address,500),optional(input.line_contact,100),optional(input.plan_code,50),lifecycle,optional(input.notes,3000)).run();
    const after=await db.prepare("SELECT * FROM merchant_owner_profiles WHERE merchant_id=?").bind(id).first();await audit(db,request,owner.admin_user_id,"MERCHANT_PROFILE_UPDATE","merchant",id,before,after);return json({item:after},200,cors);
  }
  if (url.pathname==="/api/owner/contracts" && request.method==="GET") {
    const items=await rows(db.prepare("SELECT c.id,c.merchant_id,m.name merchant_name,c.contract_name,c.plan_code,c.contract_amount,c.currency,c.contract_status,c.signed_at,c.start_date,c.end_date,c.updated_at FROM owner_contracts c JOIN merchants m ON m.id=c.merchant_id WHERE c.archived_at IS NULL UNION ALL SELECT s.id,s.merchant_id,m.name,v.title,t.plan_code,t.discount_price_minor,t.currency,'SIGNED',s.signed_at,t.start_date,t.service_period_end,s.created_at FROM merchant_contract_signatures s JOIN merchants m ON m.id=s.merchant_id JOIN merchant_contract_versions v ON v.id=s.contract_version_id JOIN merchant_contract_commercial_terms t ON t.id=s.commercial_terms_id ORDER BY updated_at DESC"));
    return json({items},200,cors);
  }
  if (url.pathname==="/api/owner/projects" && request.method==="GET") return json({items:await rows(db.prepare("SELECT p.*,m.name merchant_name FROM website_projects p JOIN merchants m ON m.id=p.merchant_id ORDER BY p.updated_at DESC"))},200,cors);
  if (url.pathname==="/api/owner/services" && request.method==="GET") return json({items:await rows(db.prepare("SELECT s.*,m.name merchant_name FROM merchant_services s JOIN merchants m ON m.id=s.merchant_id ORDER BY m.name,s.service_code"))},200,cors);
  if (url.pathname==="/api/owner/receivables" && request.method==="GET") return json({items:await rows(db.prepare("SELECT r.*,m.name merchant_name FROM owner_receivables r JOIN merchants m ON m.id=r.merchant_id ORDER BY COALESCE(r.due_date,'9999-12-31'),r.updated_at DESC"))},200,cors);
  if (url.pathname==="/api/owner/tasks" && request.method==="GET") return json({items:await rows(db.prepare("SELECT t.*,m.name merchant_name FROM owner_tasks t LEFT JOIN merchants m ON m.id=t.merchant_id ORDER BY CASE t.status WHEN 'DONE' THEN 2 ELSE 1 END,due_date,updated_at DESC"))},200,cors);
  if (url.pathname==="/api/owner/documents" && request.method==="GET") return json({items:await rows(db.prepare("SELECT d.id,d.merchant_id,m.name merchant_name,d.type,d.filename,d.mime_type,d.uploaded_at,d.uploaded_by FROM owner_documents d JOIN merchants m ON m.id=d.merchant_id WHERE d.archived_at IS NULL ORDER BY d.uploaded_at DESC"))},200,cors);
  if (url.pathname==="/api/owner/monitors" && request.method==="GET") return json({items:await rows(db.prepare("SELECT s.*,m.name merchant_name FROM owner_system_monitors s JOIN merchants m ON m.id=s.merchant_id ORDER BY CASE s.health_status WHEN 'DOWN' THEN 1 WHEN 'WARNING' THEN 2 WHEN 'UNKNOWN' THEN 3 ELSE 4 END,s.last_checked_at"))},200,cors);
  if (url.pathname==="/api/owner/audit" && request.method==="GET") return json({items:await rows(db.prepare("SELECT * FROM owner_audit_logs ORDER BY created_at DESC LIMIT 200"))},200,cors);

  if(url.pathname==="/api/owner/projects"&&request.method==="POST"){
    let input={};try{input=await request.json();}catch{} const merchantId=clean(input.merchant_id,100);if(!merchantId)return json({error:"merchant_id 不可空白。"},400,cors);
    if(!await db.prepare("SELECT id FROM merchants WHERE id=?").bind(merchantId).first())return json({error:"找不到商家。"},404,cors);
    const id=`oweb_${crypto.randomUUID()}`; const statements=[db.prepare("INSERT INTO website_projects(id,merchant_id,status,next_step,owner_note) VALUES(?,?,'NOT_STARTED',?,?)").bind(id,merchantId,optional(input.next_step,500),optional(input.owner_note,2000)),...checklistCodes.map(code=>db.prepare("INSERT INTO website_project_checklist(id,project_id,item_code) VALUES(?,?,?)").bind(`owcl_${crypto.randomUUID()}`,id,code))];
    try{await db.batch(statements);}catch{return json({error:"此商家已建立網站案件。"},409,cors);} const after=await db.prepare("SELECT * FROM website_projects WHERE id=?").bind(id).first();await audit(db,request,owner.admin_user_id,"WEBSITE_PROJECT_CREATE","website_project",id,null,after);return json({item:after},201,cors);
  }
  const checklistMatch=url.pathname.match(/^\/api\/owner\/checklist\/([^/]+)$/);
  if(checklistMatch&&request.method==="PATCH"){
    const id=decodeURIComponent(checklistMatch[1]),before=await db.prepare("SELECT * FROM website_project_checklist WHERE id=?").bind(id).first();if(!before)return json({error:"找不到 Checklist 項目。"},404,cors);let input={};try{input=await request.json();}catch{} const status=safeStatus(input.status,['TODO','WAITING','IN_PROGRESS','DONE','BLOCKED','NOT_APPLICABLE'],before.status);await db.prepare("UPDATE website_project_checklist SET status=?,note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(status,optional(input.note,2000),id).run();const after=await db.prepare("SELECT * FROM website_project_checklist WHERE id=?").bind(id).first();await audit(db,request,owner.admin_user_id,"WEBSITE_CHECKLIST_UPDATE","website_checklist",id,before,after);return json({item:after},200,cors);
  }
  if(url.pathname==="/api/owner/contracts"&&request.method==="POST"){
    let input={};try{input=await request.json();}catch{} const merchantId=clean(input.merchant_id,100),name=clean(input.contract_name,200),amount=integer(input.contract_amount);if(!merchantId||!name||amount===null)return json({error:"商家、合約名稱與金額不可空白。"},400,cors);const id=`ocon_${crypto.randomUUID()}`,status=safeStatus(input.contract_status,['DRAFT','WAITING_SIGNATURE','SIGNED','WAITING_PAYMENT','ACTIVE','COMPLETED','PAUSED','TERMINATED'],'DRAFT');await db.prepare("INSERT INTO owner_contracts(id,merchant_id,contract_name,plan_code,contract_amount,currency,contract_status,start_date,end_date,payment_terms,notes) VALUES(?,?,?,?,?,'TWD',?,?,?,?,?)").bind(id,merchantId,name,optional(input.plan_code,50),amount,status,optional(input.start_date,20),optional(input.end_date,20),optional(input.payment_terms,1000),optional(input.notes,3000)).run();const after=await db.prepare("SELECT * FROM owner_contracts WHERE id=?").bind(id).first();await audit(db,request,owner.admin_user_id,"CONTRACT_CREATE","contract",id,null,after);return json({item:after},201,cors);
  }
  const contractMatch=url.pathname.match(/^\/api\/owner\/contracts\/([^/]+)$/);
  if(contractMatch&&request.method==="PATCH"){
    const id=decodeURIComponent(contractMatch[1]),before=await db.prepare("SELECT * FROM owner_contracts WHERE id=? AND archived_at IS NULL").bind(id).first();if(!before)return json({error:"找不到可編輯合約。"},404,cors);let input={};try{input=await request.json();}catch{} const amount=input.contract_amount===undefined?before.contract_amount:integer(input.contract_amount);if(amount===null)return json({error:"合約金額格式錯誤。"},400,cors);if(amount!==before.contract_amount){const blocked=reauthRequired(owner,cors);if(blocked)return blocked;}const status=safeStatus(input.contract_status,['DRAFT','WAITING_SIGNATURE','SIGNED','WAITING_PAYMENT','ACTIVE','COMPLETED','PAUSED','TERMINATED'],before.contract_status);await db.prepare("UPDATE owner_contracts SET contract_name=?,plan_code=?,contract_amount=?,contract_status=?,start_date=?,end_date=?,payment_terms=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(clean(input.contract_name||before.contract_name,200),optional(input.plan_code??before.plan_code,50),amount,status,input.start_date??before.start_date,input.end_date??before.end_date,input.payment_terms??before.payment_terms,input.notes??before.notes,id).run();const after=await db.prepare("SELECT * FROM owner_contracts WHERE id=?").bind(id).first();await audit(db,request,owner.admin_user_id,"CONTRACT_UPDATE","contract",id,before,after);return json({item:after},200,cors);
  }
  if(url.pathname==="/api/owner/receivables"&&request.method==="POST"){
    let input={};try{input=await request.json();}catch{} const merchantId=clean(input.merchant_id,100),due=integer(input.amount_due),paid=integer(input.amount_paid||0);if(!merchantId||due===null||paid===null||paid>due)return json({error:"收款資料格式錯誤。"},400,cors);const id=`orec_${crypto.randomUUID()}`,balance=due-paid,status=paid===0?'UNPAID':balance===0?'PAID':'PARTIAL';await db.prepare("INSERT INTO owner_receivables(id,merchant_id,contract_id,amount_due,amount_paid,balance,due_date,paid_at,payment_method,payment_status,reference,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,merchantId,optional(input.contract_id,100),due,paid,balance,optional(input.due_date,20),paid?optional(input.paid_at,30):null,optional(input.payment_method,100),status,optional(input.reference,200),optional(input.notes,3000)).run();const after=await db.prepare("SELECT * FROM owner_receivables WHERE id=?").bind(id).first();await audit(db,request,owner.admin_user_id,"RECEIVABLE_CREATE","receivable",id,null,after);return json({item:after},201,cors);
  }
  const receivableMatch=url.pathname.match(/^\/api\/owner\/receivables\/([^/]+)$/);
  if(receivableMatch&&request.method==="PATCH"){
    const blocked=reauthRequired(owner,cors);if(blocked)return blocked;const id=decodeURIComponent(receivableMatch[1]),before=await db.prepare("SELECT * FROM owner_receivables WHERE id=?").bind(id).first();if(!before)return json({error:"找不到收款資料。"},404,cors);let input={};try{input=await request.json();}catch{}const due=input.amount_due===undefined?before.amount_due:integer(input.amount_due),paid=input.amount_paid===undefined?before.amount_paid:integer(input.amount_paid);if(due===null||paid===null||paid>due)return json({error:"收款金額格式錯誤。"},400,cors);const balance=due-paid,status=safeStatus(input.payment_status,['UNPAID','PARTIAL','PAID','OVERDUE','WAIVED'],paid===0?'UNPAID':balance===0?'PAID':'PARTIAL');await db.prepare("UPDATE owner_receivables SET amount_due=?,amount_paid=?,balance=?,due_date=?,paid_at=?,payment_method=?,payment_status=?,reference=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(due,paid,balance,input.due_date??before.due_date,input.paid_at??before.paid_at,input.payment_method??before.payment_method,status,input.reference??before.reference,input.notes??before.notes,id).run();const after=await db.prepare("SELECT * FROM owner_receivables WHERE id=?").bind(id).first();await audit(db,request,owner.admin_user_id,"RECEIVABLE_UPDATE","receivable",id,before,after);return json({item:after},200,cors);
  }
  const serviceMatch=url.pathname.match(/^\/api\/owner\/services\/([^/]+)\/([^/]+)$/);
  if(serviceMatch&&request.method==="PUT"){
    const merchantId=decodeURIComponent(serviceMatch[1]),code=decodeURIComponent(serviceMatch[2]);if(!serviceCodes.includes(code))return json({error:"未知服務項目。"},400,cors);const before=await db.prepare("SELECT * FROM merchant_services WHERE merchant_id=? AND service_code=?").bind(merchantId,code).first();let input={};try{input=await request.json();}catch{}const status=safeStatus(input.status,['NOT_ENABLED','SETUP','TESTING','ACTIVE','PAUSED'],before?.status||'NOT_ENABLED'),id=before?.id||`osvc_${crypto.randomUUID()}`;await db.prepare("INSERT INTO merchant_services(id,merchant_id,service_code,status,note) VALUES(?,?,?,?,?) ON CONFLICT(merchant_id,service_code) DO UPDATE SET status=excluded.status,note=excluded.note,updated_at=CURRENT_TIMESTAMP").bind(id,merchantId,code,status,optional(input.note,2000)).run();const after=await db.prepare("SELECT * FROM merchant_services WHERE merchant_id=? AND service_code=?").bind(merchantId,code).first();await audit(db,request,owner.admin_user_id,"SERVICE_UPDATE","merchant_service",id,before,after);return json({item:after},200,cors);
  }

  const projectMatch=url.pathname.match(/^\/api\/owner\/projects\/([^/]+)$/);
  if(projectMatch && request.method==="PATCH"){
    const id=decodeURIComponent(projectMatch[1]),before=await db.prepare("SELECT * FROM website_projects WHERE id=?").bind(id).first(); if(!before)return json({error:"找不到網站案件。"},404,cors);
    let input={};try{input=await request.json();}catch{} const status=safeStatus(input.status,['NOT_STARTED','WAITING_CLIENT_DATA','IN_PROGRESS','TESTING','WAITING_APPROVAL','PRODUCTION','COMPLETED','PAUSED'],before.status);
    await db.prepare("UPDATE website_projects SET status=?,next_step=?,owner_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(status,String(input.next_step||before.next_step||"").slice(0,500),String(input.owner_note||before.owner_note||"").slice(0,2000),id).run(); const after=await db.prepare("SELECT * FROM website_projects WHERE id=?").bind(id).first(); await audit(db,request,owner.admin_user_id,"WEBSITE_PROJECT_UPDATE","website_project",id,before,after); return json({item:after},200,cors);
  }
  const taskMatch=url.pathname.match(/^\/api\/owner\/tasks\/([^/]+)$/);
  if(taskMatch && request.method==="PATCH"){
    const id=decodeURIComponent(taskMatch[1]),before=await db.prepare("SELECT * FROM owner_tasks WHERE id=?").bind(id).first();if(!before)return json({error:"找不到工作項目。"},404,cors);let input={};try{input=await request.json();}catch{}
    const status=safeStatus(input.status,['TODO','WAITING_CLIENT','IN_PROGRESS','BLOCKED','DONE'],before.status),priority=safeStatus(input.priority,['LOW','NORMAL','HIGH','URGENT'],before.priority);
    await db.prepare("UPDATE owner_tasks SET title=?,description=?,status=?,priority=?,due_date=?,assigned_to=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(String(input.title||before.title).slice(0,200),String(input.description??before.description??'').slice(0,3000),status,priority,input.due_date??before.due_date,input.assigned_to??before.assigned_to,id).run();const after=await db.prepare("SELECT * FROM owner_tasks WHERE id=?").bind(id).first();await audit(db,request,owner.admin_user_id,"TASK_UPDATE","task",id,before,after);return json({item:after},200,cors);
  }
  if(url.pathname==="/api/owner/tasks"&&request.method==="POST"){
    let input={};try{input=await request.json();}catch{} if(!String(input.title||'').trim())return json({error:"工作標題不可空白。"},400,cors); const id=`otask_${crypto.randomUUID()}`;
    await db.prepare("INSERT INTO owner_tasks(id,merchant_id,title,description,status,priority,due_date,assigned_to) VALUES(?,?,?,?,?,?,?,?)").bind(id,input.merchant_id||null,String(input.title).trim().slice(0,200),String(input.description||'').slice(0,3000),'TODO',safeStatus(input.priority,['LOW','NORMAL','HIGH','URGENT'],'NORMAL'),input.due_date||null,input.assigned_to||null).run();const after=await db.prepare("SELECT * FROM owner_tasks WHERE id=?").bind(id).first();await audit(db,request,owner.admin_user_id,"TASK_CREATE","task",id,null,after);return json({item:after},201,cors);
  }
  return null;
}
