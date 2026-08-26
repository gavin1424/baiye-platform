import { calculateSettlement, decimalMajorToMinor, normalizeSettlementProfile, settlementSnapshot } from "./settlement-engine.js";
import { createSettlementPdf, settlementCsv } from "./settlement-pdf.js";
import { sha256 } from "./contract-pdf.js";

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=UTF-8", ...headers } });
const now = () => new Date().toISOString();
const uid = (prefix) => `${prefix}_${crypto.randomUUID()}`;
const safeText = (value, max = 300) => String(value ?? "").trim().slice(0, max);
const date = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : null;
const actor = (adminSession) => adminSession?.admin_user_id || adminSession?.id || "admin";

async function readJson(request) { try { return await request.json(); } catch { return {}; } }
async function merchant(db, merchantId) { return db.prepare("SELECT id,merchant_code,name,status FROM merchants WHERE id=? LIMIT 1").bind(merchantId).first(); }
async function profile(db, merchantId) { return db.prepare("SELECT * FROM merchant_settlement_profiles WHERE merchant_id=? LIMIT 1").bind(merchantId).first(); }
function profilePayload(data) {
  const normalized = normalizeSettlementProfile(data);
  if (normalized.enabled && normalized.legal_review_status !== "approved") throw new TypeError("啟用前必須完成契約／法務確認。" );
  if (normalized.enabled && !normalized.effective_from) throw new TypeError("啟用前必須設定契約生效日。" );
  if ((normalized.tax_reserve_mode !== "disabled" || normalized.withholding_mode !== "disabled") && normalized.accounting_review_status !== "approved") throw new TypeError("稅務預留或扣繳須先取得記帳士／稅務專業人員核准。" );
  return normalized;
}
async function audit(db, adminSession, action, entityType, entityId, metadata = {}) {
  const values = [uid("audit"), "admin", actor(adminSession), action, entityType, entityId, JSON.stringify(metadata)];
  await db.prepare("INSERT INTO audit_logs (id,actor_type,actor_id,action,entity_type,entity_id,metadata) VALUES (?,?,?,?,?,?,?)").bind(...values).run();
}
async function event(db, adminSession, settlementId, merchantId, type, fromStatus, toStatus, metadata = {}, idempotencyKey = null) {
  await db.prepare("INSERT INTO merchant_settlement_events (id,settlement_id,merchant_id,actor_type,actor_id,event_type,from_status,to_status,idempotency_key,metadata_json) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .bind(uid("stev"), settlementId, merchantId, "admin", actor(adminSession), type, fromStatus, toStatus, idempotencyKey, JSON.stringify(metadata)).run();
  await audit(db, adminSession, `merchant_settlement_${type}`, "merchant_settlement", settlementId || merchantId, metadata);
}
function statementNumber(periodStart) { return `CBS-${String(periodStart).slice(0,7).replace("-","")}-${Date.now()}-${crypto.randomUUID().slice(0,6).toUpperCase()}`; }
function major(value) { const converted = decimalMajorToMinor(value ?? 0); if (converted === null) throw new TypeError("既有財務金額格式無法安全轉換。" ); return converted; }

async function periodSources(db, merchantId, periodStart, periodEnd, excludeSettlementId = null) {
  const payments = await db.prepare(`SELECT p.id,p.order_id,p.gross_amount,p.fee_amount,p.status,p.payment_no,p.payment_provider,p.paid_at,p.created_at,o.amount_due,o.order_no
    FROM payments p LEFT JOIN orders o ON o.id=p.order_id
    WHERE p.merchant_id=? AND p.status IN ('paid','partially_refunded','refunded')
      AND date(COALESCE(p.paid_at,p.created_at)) BETWEEN date(?) AND date(?) ORDER BY COALESCE(p.paid_at,p.created_at),p.id`).bind(merchantId, periodStart, periodEnd).all();
  const refunds = await db.prepare(`SELECT r.id,r.payment_id,r.amount,r.status,r.refunded_at,p.order_id
    FROM refunds r JOIN payments p ON p.id=r.payment_id
    WHERE p.merchant_id=? AND r.status='refunded' AND date(COALESCE(r.refunded_at,r.created_at)) BETWEEN date(?) AND date(?) ORDER BY COALESCE(r.refunded_at,r.created_at),r.id`).bind(merchantId, periodStart, periodEnd).all();
  const pendingAdjustments = await db.prepare("SELECT * FROM merchant_settlement_adjustments WHERE merchant_id=? AND status='pending' ORDER BY created_at,id").bind(merchantId).all();
  const orderIds = new Set(), items = [], actualFees = [];
  let fallbackOrderTotal = 0;
  for (const row of payments.results) {
    if (row.order_id) orderIds.add(row.order_id); else fallbackOrderTotal += major(row.gross_amount);
    if (row.fee_amount != null) actualFees.push(major(row.fee_amount));
    items.push({ item_type: "payment", source_type: "payment", source_id: row.id, order_id: row.order_id, payment_id: row.id, refund_id: null, amount_minor: major(row.gross_amount), provider_fee_actual: row.fee_amount == null ? 0 : 1, occurred_at: row.paid_at || row.created_at, source_snapshot_json: JSON.stringify({ payment_no: row.payment_no, provider: row.payment_provider, status: row.status }) });
  }
  let totalOrder = fallbackOrderTotal;
  if (orderIds.size) {
    const orders = await db.prepare(`SELECT id,amount_due,order_no FROM orders WHERE merchant_id=? AND id IN (${[...orderIds].map(()=>"?").join(",")})`).bind(merchantId, ...orderIds).all();
    for (const row of orders.results) {
      totalOrder += major(row.amount_due);
      items.push({ item_type: "order", source_type: "order", source_id: row.id, order_id: row.id, payment_id: null, refund_id: null, amount_minor: major(row.amount_due), provider_fee_actual: 0, occurred_at: `${periodStart}T00:00:00.000Z`, source_snapshot_json: JSON.stringify({ order_no: row.order_no }) });
    }
  }
  let adjustmentTotal = 0;
  for (const row of refunds.results) {
    const amount = -major(row.amount); adjustmentTotal += amount;
    items.push({ item_type: "refund", source_type: "refund", source_id: row.id, order_id: row.order_id, payment_id: row.payment_id, refund_id: row.id, amount_minor: amount, provider_fee_actual: 0, occurred_at: row.refunded_at, source_snapshot_json: JSON.stringify({ status: row.status }) });
  }
  for (const row of pendingAdjustments.results) adjustmentTotal += Number(row.amount_minor);
  if (excludeSettlementId) {
    const sourceIds = items.map((item) => item.source_id);
    if (sourceIds.length) {
      const duplicate = await db.prepare(`SELECT source_id,settlement_id FROM merchant_settlement_items WHERE source_id IN (${sourceIds.map(()=>"?").join(",")}) AND settlement_id<>? LIMIT 1`).bind(...sourceIds, excludeSettlementId).first();
      if (duplicate) throw Object.assign(new Error("同一付款、退款或訂單已納入其他對帳單。"), { status: 409 });
    }
  }
  return { totalOrder, actualFee: actualFees.length ? actualFees.reduce((sum, value) => sum + value, 0) : null, adjustments: adjustmentTotal, items, adjustmentRows: pendingAdjustments.results };
}

async function priorOffset(db, merchantId, excludeId = null) {
  const row = await db.prepare(`SELECT COALESCE(MAX(cumulative_offset_amount_minor),0) total FROM merchant_settlements WHERE merchant_id=? AND status IN ('locked','paid') ${excludeId ? "AND id<>?" : ""}`).bind(...(excludeId ? [merchantId, excludeId] : [merchantId])).first();
  return Number(row?.total || 0);
}
async function computation(db, merchantId, periodStart, periodEnd, manual = {}, excludeId = null) {
  const selectedProfile = await profile(db, merchantId);
  if (!selectedProfile) throw Object.assign(new Error("此商家尚未建立訂金代收規則。"), { status: 404 });
  if (!Number(selectedProfile.enabled) || selectedProfile.legal_review_status !== "approved") throw new TypeError("此商家尚未完成選配服務契約啟用。" );
  if (selectedProfile.effective_from && selectedProfile.effective_from > periodEnd || selectedProfile.effective_to && selectedProfile.effective_to < periodStart) throw new TypeError("對帳期間不在有效契約期間內。" );
  const sources = await periodSources(db, merchantId, periodStart, periodEnd, excludeId);
  const result = calculateSettlement({ profile: selectedProfile, total_order_amount_minor: sources.totalOrder, actual_processing_fee_minor: sources.actualFee, prior_offset_amount_minor: await priorOffset(db, merchantId, excludeId), adjustments_minor: sources.adjustments, manual_tax_reserve_minor: manual.manual_tax_reserve_minor, manual_withholding_minor: manual.manual_withholding_minor });
  return { profile: selectedProfile, sources, result };
}
function statementParams(statementId, statementNo, merchantId, profileId, periodStart, periodEnd, result) {
  return [statementId,statementNo,merchantId,profileId,periodStart,periodEnd,"draft","TWD",result.total_order_amount_minor,result.deposit_collected_minor,result.processing_fee_minor,result.platform_service_fee_minor,result.tax_reserve_minor,result.withholding_minor,result.adjustments_minor,result.merchant_payable_minor,result.prior_offset_amount_minor,result.current_offset_amount_minor,result.cumulative_offset_amount_minor,result.remaining_offset_amount_minor,result.ongoing_platform_fee_minor,result.calculation_version,settlementSnapshot(result)];
}
async function getStatement(db, statementId) {
  return db.prepare("SELECT s.*,m.name merchant_name,m.merchant_code FROM merchant_settlements s JOIN merchants m ON m.id=s.merchant_id WHERE s.id=? LIMIT 1").bind(statementId).first();
}

export async function handleSettlementRequest(request, env, url, cors, adminSession) {
  const db = env.FINANCE_DB;
  if (url.pathname === "/api/finance/settlement-settings/platform" && request.method === "GET") {
    const item=await db.prepare("SELECT brand_name,legal_entity_name,tax_id,invoice_title,invoice_address,reviewed_by,reviewed_at,updated_at FROM platform_finance_settings WHERE id='default'").first();
    return json({settings:item||{brand_name:"創百業智慧鏈",legal_entity_name:null,tax_id:null,invoice_title:null,invoice_address:null}},200,cors);
  }
  if (url.pathname === "/api/finance/settlement-settings/platform" && request.method === "PATCH") {
    const input=await readJson(request),brand=safeText(input.brand_name,100)||"創百業智慧鏈",legal=safeText(input.legal_entity_name,200),taxId=safeText(input.tax_id,20),invoiceTitle=safeText(input.invoice_title,200),address=safeText(input.invoice_address,300);
    if(!legal||!taxId||input.confirm_legal_identity!==true)return json({error:"公司法律主體與統編須由管理員確認後保存。"},400,cors);
    await db.prepare("INSERT INTO platform_finance_settings(id,brand_name,legal_entity_name,tax_id,invoice_title,invoice_address,reviewed_by,reviewed_at,updated_at) VALUES ('default',?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET brand_name=excluded.brand_name,legal_entity_name=excluded.legal_entity_name,tax_id=excluded.tax_id,invoice_title=excluded.invoice_title,invoice_address=excluded.invoice_address,reviewed_by=excluded.reviewed_by,reviewed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP").bind(brand,legal,taxId,invoiceTitle||legal,address||null,actor(adminSession)).run();
    await audit(db,adminSession,"platform_finance_identity_updated","platform_finance_settings","default",{brand_name:brand,legal_entity_name:legal,tax_id_masked:`***${taxId.slice(-4)}`});
    return json({ok:true},200,cors);
  }
  const profileMatch = url.pathname.match(/^\/api\/finance\/settlement-profiles\/([^/]+)$/);
  if (profileMatch && request.method === "GET") {
    const item = await profile(db, decodeURIComponent(profileMatch[1]));
    return item ? json(item, 200, cors) : json({ error: "尚未建立規則設定。" }, 404, cors);
  }
  if (profileMatch && request.method === "PATCH") {
    const merchantId = decodeURIComponent(profileMatch[1]), found = await merchant(db, merchantId);
    if (!found) return json({ error: "找不到商家。" }, 404, cors);
    try {
      const input = await readJson(request), normalized = profilePayload(input), existing = await profile(db, merchantId), profileId = existing?.id || uid("stpf");
      if(normalized.enabled){const platformSettings=await db.prepare("SELECT legal_entity_name,tax_id FROM platform_finance_settings WHERE id='default'").first();if(!platformSettings?.legal_entity_name||!platformSettings?.tax_id)return json({error:"啟用前必須先在後台設定正式公司法律主體與統編。"},400,cors);}
      await db.prepare(`INSERT INTO merchant_settlement_profiles (id,merchant_id,enabled,payment_plan,deposit_rate_bp,platform_fee_rate_bp,processing_fee_mode,processing_fee_basis,estimated_processing_fee_rate_bp,tax_reserve_mode,tax_reserve_rate_bp,withholding_mode,withholding_rate_bp,withholding_income_type,offset_target_amount_minor,continue_platform_fee_after_offset,settlement_day,legal_review_status,accounting_review_status,effective_from,effective_to,calculation_version,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
        ON CONFLICT(merchant_id) DO UPDATE SET enabled=excluded.enabled,payment_plan=excluded.payment_plan,deposit_rate_bp=excluded.deposit_rate_bp,platform_fee_rate_bp=excluded.platform_fee_rate_bp,processing_fee_mode=excluded.processing_fee_mode,processing_fee_basis=excluded.processing_fee_basis,estimated_processing_fee_rate_bp=excluded.estimated_processing_fee_rate_bp,tax_reserve_mode=excluded.tax_reserve_mode,tax_reserve_rate_bp=excluded.tax_reserve_rate_bp,withholding_mode=excluded.withholding_mode,withholding_rate_bp=excluded.withholding_rate_bp,withholding_income_type=excluded.withholding_income_type,offset_target_amount_minor=excluded.offset_target_amount_minor,continue_platform_fee_after_offset=excluded.continue_platform_fee_after_offset,settlement_day=excluded.settlement_day,legal_review_status=excluded.legal_review_status,accounting_review_status=excluded.accounting_review_status,effective_from=excluded.effective_from,effective_to=excluded.effective_to,calculation_version=excluded.calculation_version,updated_at=CURRENT_TIMESTAMP`)
        .bind(profileId,merchantId,normalized.enabled?1:0,normalized.payment_plan,normalized.deposit_rate_bp,normalized.platform_fee_rate_bp,normalized.processing_fee_mode,normalized.processing_fee_basis,normalized.estimated_processing_fee_rate_bp,normalized.tax_reserve_mode,normalized.tax_reserve_rate_bp,normalized.withholding_mode,normalized.withholding_rate_bp,normalized.withholding_income_type,normalized.offset_target_amount_minor,normalized.continue_platform_fee_after_offset?1:0,normalized.settlement_day,normalized.legal_review_status,normalized.accounting_review_status,normalized.effective_from,normalized.effective_to,normalized.calculation_version).run();
      await audit(db, adminSession, "merchant_settlement_profile_updated", "merchant_settlement_profile", profileId, { merchant_id: merchantId, enabled: normalized.enabled, payment_plan: normalized.payment_plan, high_risk_review: input.confirm_high_risk === true });
      return json({ ok: true, profile: await profile(db, merchantId) }, 200, cors);
    } catch (error) { return json({ error: error.message || "規則設定格式錯誤。" }, 400, cors); }
  }

  if (url.pathname === "/api/finance/settlements/preview" && request.method === "POST") {
    const input = await readJson(request), start = date(input.period_start), end = date(input.period_end);
    if (!input.merchant_id || !start || !end || end < start) return json({ error: "商家或對帳期間格式錯誤。" }, 400, cors);
    if (!(await merchant(db,input.merchant_id))) return json({ error: "找不到商家。" }, 404, cors);
    try { const calculated = await computation(db,input.merchant_id,start,end,input); return json({ preview: calculated.result, transaction_count: calculated.sources.items.filter((x)=>x.item_type==="payment").length, source_items: calculated.sources.items.map(({source_snapshot_json,...item})=>item), writes_data: false },200,cors); }
    catch(error){ return json({error:error.message||"無法產生預覽。"},error.status||400,cors); }
  }
  if (url.pathname === "/api/finance/settlements" && request.method === "POST") {
    const input = await readJson(request), start = date(input.period_start), end = date(input.period_end);
    if (!input.merchant_id || !start || !end || end < start) return json({ error: "商家或對帳期間格式錯誤。" }, 400, cors);
    try {
      const calculated = await computation(db,input.merchant_id,start,end,input), statementId=uid("stmt"), statementNo=statementNumber(start);
      const statements=[db.prepare(`INSERT INTO merchant_settlements (id,statement_no,merchant_id,profile_id,period_start,period_end,status,currency,total_order_amount_minor,deposit_collected_minor,processing_fee_minor,platform_service_fee_minor,tax_reserve_minor,withholding_minor,adjustments_minor,merchant_payable_minor,prior_offset_amount_minor,current_offset_amount_minor,cumulative_offset_amount_minor,remaining_offset_amount_minor,ongoing_platform_fee_minor,calculation_version,rules_snapshot_json) VALUES (${Array(23).fill("?").join(",")})`).bind(...statementParams(statementId,statementNo,input.merchant_id,calculated.profile.id,start,end,calculated.result))];
      for(const item of calculated.sources.items) statements.push(db.prepare("INSERT INTO merchant_settlement_items (id,settlement_id,merchant_id,item_type,source_type,source_id,order_id,payment_id,refund_id,amount_minor,provider_fee_actual,occurred_at,source_snapshot_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(uid("stit"),statementId,input.merchant_id,item.item_type,item.source_type,item.source_id,item.order_id,item.payment_id,item.refund_id,item.amount_minor,item.provider_fee_actual,item.occurred_at,item.source_snapshot_json));
      await db.batch(statements);
      await event(db,adminSession,statementId,input.merchant_id,"created",null,"draft",{statement_no:statementNo,period_start:start,period_end:end});
      return json({id:statementId,statement_no:statementNo},201,cors);
    } catch(error){ return json({error:error.message||"建立草稿失敗。"},error.status||(/UNIQUE/.test(error.message)?409:400),cors); }
  }
  if (url.pathname === "/api/finance/settlements/audit" && request.method === "GET") {
    const rows=await db.prepare("SELECT e.*,s.statement_no,m.name merchant_name FROM merchant_settlement_events e LEFT JOIN merchant_settlements s ON s.id=e.settlement_id JOIN merchants m ON m.id=e.merchant_id ORDER BY e.created_at DESC LIMIT 500").all();
    return json({items:rows.results},200,cors);
  }
  if (url.pathname === "/api/finance/settlements" && request.method === "GET") {
    const where=[],args=[]; for(const [key,column] of [["merchant_id","s.merchant_id"],["status","s.status"]]) if(url.searchParams.get(key)){where.push(`${column}=?`);args.push(url.searchParams.get(key));}
    if(url.searchParams.get("month")){where.push("substr(s.period_start,1,7)=?");args.push(url.searchParams.get("month"));}
    const rows=await db.prepare(`SELECT s.*,m.name merchant_name FROM merchant_settlements s JOIN merchants m ON m.id=s.merchant_id ${where.length?`WHERE ${where.join(" AND ")}`:""} ORDER BY s.period_start DESC,s.created_at DESC LIMIT 500`).bind(...args).all();
    return json({items:rows.results},200,cors);
  }
  const match=url.pathname.match(/^\/api\/finance\/settlements\/([^/]+)(?:\/(lock|mark-paid|void|pdf|csv|adjustments))?$/);
  if(!match) return null;
  const statementId=decodeURIComponent(match[1]),action=match[2],statement=await getStatement(db,statementId);
  if(!statement) return json({error:"找不到對帳單。"},404,cors);
  if(!action && request.method==="GET"){
    const items=await db.prepare("SELECT * FROM merchant_settlement_items WHERE settlement_id=? ORDER BY occurred_at,id").bind(statementId).all();
    const adjustments=await db.prepare("SELECT * FROM merchant_settlement_adjustments WHERE source_settlement_id=? OR applied_settlement_id=? ORDER BY created_at").bind(statementId,statementId).all();
    const events=await db.prepare("SELECT * FROM merchant_settlement_events WHERE settlement_id=? ORDER BY created_at").bind(statementId).all();
    return json({...statement,items:items.results,adjustments:adjustments.results,events:events.results},200,cors);
  }
  if(action==="lock"&&request.method==="POST"){
    if(!["draft","review"].includes(statement.status)) return json({error:"只有草稿或待審核對帳單可以鎖定。"},409,cors);
    try{
      const recalculated=await computation(db,statement.merchant_id,statement.period_start,statement.period_end,{manual_tax_reserve_minor:statement.tax_reserve_minor,manual_withholding_minor:statement.withholding_minor},statement.id);
      const hash=await sha256(JSON.stringify({statement_no:statement.statement_no,merchant_id:statement.merchant_id,period_start:statement.period_start,period_end:statement.period_end,result:recalculated.result}));
      const timestamp=now();
      if(!env.CONTRACTS_BUCKET) return json({error:"私人檔案儲存空間尚未設定，對帳單未鎖定。"},503,cors);
      const merchantRow=await merchant(db,statement.merchant_id),platformSettings=await db.prepare("SELECT * FROM platform_finance_settings WHERE id='default'").first();
      if(!platformSettings?.legal_entity_name||!platformSettings?.tax_id)return json({error:"尚未設定正式公司法律主體與統編，對帳單未鎖定。"},409,cors);
      const pdfInput={...statement,...recalculated.result,status:"locked",merchant_name:merchantRow?.name||statement.merchant_name,platform_legal_name:platformSettings.legal_entity_name,platform_tax_id:platformSettings.tax_id,invoice_title:platformSettings.invoice_title,rules_snapshot_json:settlementSnapshot(recalculated.result),statement_hash:hash,generated_at:timestamp},pdf=await createSettlementPdf(pdfInput),key=`settlements/${statement.merchant_id}/${statement.statement_no}.pdf`;
      await env.CONTRACTS_BUCKET.put(key,pdf.bytes,{httpMetadata:{contentType:"application/pdf"},customMetadata:{statement_id:statementId,statement_hash:pdf.statementHash,pdf_hash:pdf.pdfHash}});
      await db.batch([
        db.prepare("DELETE FROM merchant_settlement_items WHERE settlement_id=?").bind(statementId),
        ...recalculated.sources.items.map((item)=>db.prepare("INSERT INTO merchant_settlement_items (id,settlement_id,merchant_id,item_type,source_type,source_id,order_id,payment_id,refund_id,amount_minor,provider_fee_actual,occurred_at,source_snapshot_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(uid("stit"),statementId,statement.merchant_id,item.item_type,item.source_type,item.source_id,item.order_id,item.payment_id,item.refund_id,item.amount_minor,item.provider_fee_actual,item.occurred_at,item.source_snapshot_json)),
        db.prepare(`UPDATE merchant_settlements SET total_order_amount_minor=?,deposit_collected_minor=?,processing_fee_minor=?,platform_service_fee_minor=?,tax_reserve_minor=?,withholding_minor=?,adjustments_minor=?,merchant_payable_minor=?,prior_offset_amount_minor=?,current_offset_amount_minor=?,cumulative_offset_amount_minor=?,remaining_offset_amount_minor=?,ongoing_platform_fee_minor=?,calculation_version=?,rules_snapshot_json=?,statement_hash=?,pdf_object_key=?,pdf_hash=?,status='locked',locked_at=?,updated_at=? WHERE id=? AND status IN ('draft','review')`).bind(recalculated.result.total_order_amount_minor,recalculated.result.deposit_collected_minor,recalculated.result.processing_fee_minor,recalculated.result.platform_service_fee_minor,recalculated.result.tax_reserve_minor,recalculated.result.withholding_minor,recalculated.result.adjustments_minor,recalculated.result.merchant_payable_minor,recalculated.result.prior_offset_amount_minor,recalculated.result.current_offset_amount_minor,recalculated.result.cumulative_offset_amount_minor,recalculated.result.remaining_offset_amount_minor,recalculated.result.ongoing_platform_fee_minor,recalculated.result.calculation_version,settlementSnapshot(recalculated.result),pdf.statementHash,key,pdf.pdfHash,timestamp,timestamp,statementId),
        ...recalculated.sources.adjustmentRows.map((row)=>db.prepare("UPDATE merchant_settlement_adjustments SET status='applied',applied_settlement_id=?,approved_by=?,applied_at=? WHERE id=? AND status='pending'").bind(statementId,actor(adminSession),timestamp,row.id)),
      ]);
      await event(db,adminSession,statementId,statement.merchant_id,"locked",statement.status,"locked",{statement_hash:pdf.statementHash,pdf_hash:pdf.pdfHash});
      return json({ok:true,status:"locked",statement_hash:pdf.statementHash,pdf_hash:pdf.pdfHash},200,cors);
    }catch(error){return json({error:error.message||"鎖定失敗。"},error.status||409,cors);}
  }
  if(action==="mark-paid"&&request.method==="POST"){
    if(statement.status!=="locked") return json({error:"只有已鎖定對帳單可標記匯款。"},409,cors);
    const input=await readJson(request),amount=Number(input.transfer_amount_minor),transferDate=date(input.transfer_date),reference=safeText(input.transfer_reference,120);
    if(!Number.isSafeInteger(amount)||amount!==Number(statement.merchant_payable_minor)||!transferDate||!reference)return json({error:"匯款金額必須等於應撥店家金額，且須填寫日期與 reference；差額請先建立正式調整。"},400,cors);
    if(!env.CONTRACTS_BUCKET)return json({error:"私人檔案儲存空間尚未設定，未標記付款。"},503,cors);
    const timestamp=now(),invoiceNo=safeText(input.platform_invoice_no,80)||null,invoiceStatus=invoiceNo?(input.platform_invoice_status==="issued"?"issued":"pending"):null,platformSettings=await db.prepare("SELECT * FROM platform_finance_settings WHERE id='default'").first();
    if(!platformSettings?.legal_entity_name||!platformSettings?.tax_id)return json({error:"尚未設定正式公司法律主體與統編，未標記付款。"},409,cors);
    const pdf=await createSettlementPdf({...statement,status:"paid",transfer_amount_minor:amount,transfer_date:transferDate,transfer_reference:reference,platform_invoice_no:invoiceNo,platform_invoice_status:invoiceStatus,paid_at:timestamp,platform_legal_name:platformSettings.legal_entity_name,platform_tax_id:platformSettings.tax_id,invoice_title:platformSettings.invoice_title,generated_at:timestamp}),key=statement.pdf_object_key||`settlements/${statement.merchant_id}/${statement.statement_no}.pdf`;
    await env.CONTRACTS_BUCKET.put(key,pdf.bytes,{httpMetadata:{contentType:"application/pdf"},customMetadata:{statement_id:statementId,statement_hash:pdf.statementHash,pdf_hash:pdf.pdfHash}});
    await db.prepare("UPDATE merchant_settlements SET status='paid',transfer_amount_minor=?,transfer_date=?,transfer_reference=?,platform_invoice_no=?,platform_invoice_status=?,pdf_object_key=?,pdf_hash=?,paid_at=?,updated_at=? WHERE id=? AND status='locked'").bind(amount,transferDate,reference,invoiceNo,invoiceStatus,key,pdf.pdfHash,timestamp,timestamp,statementId).run();
    await event(db,adminSession,statementId,statement.merchant_id,"paid","locked","paid",{transfer_amount_minor:amount,transfer_date:transferDate,transfer_reference:reference});return json({ok:true,status:"paid"},200,cors);
  }
  if(action==="void"&&request.method==="POST"){
    if(statement.status==="paid"||statement.status==="void")return json({error:"已付款或已作廢對帳單不可再次作廢。"},409,cors);
    const input=await readJson(request),reason=safeText(input.reason,500);if(!reason)return json({error:"請填寫作廢原因。"},400,cors);
    const timestamp=now();await db.prepare("UPDATE merchant_settlements SET status='void',voided_at=?,updated_at=? WHERE id=? AND status<>'paid'").bind(timestamp,timestamp,statementId).run();await event(db,adminSession,statementId,statement.merchant_id,"voided",statement.status,"void",{reason});return json({ok:true,status:"void"},200,cors);
  }
  if(action==="adjustments"&&request.method==="POST"){
    if(!["locked","paid"].includes(statement.status))return json({error:"只有鎖定或已付款對帳單可建立下一期調整。"},409,cors);
    const input=await readJson(request),amount=Number(input.amount_minor),type=input.adjustment_type,key=safeText(input.idempotency_key,150),reason=safeText(input.reason,500);
    if(!Number.isSafeInteger(amount)||amount===0||!["refund","fee_difference","chargeback","correction","other"].includes(type)||!key||!reason)return json({error:"調整資料格式錯誤。"},400,cors);
    try{const adjustmentId=uid("stad");await db.prepare("INSERT INTO merchant_settlement_adjustments (id,merchant_id,source_settlement_id,adjustment_type,amount_minor,reason,source_reference,idempotency_key,created_by) VALUES (?,?,?,?,?,?,?,?,?)").bind(adjustmentId,statement.merchant_id,statementId,type,amount,reason,safeText(input.source_reference,150)||null,key,actor(adminSession)).run();await event(db,adminSession,statementId,statement.merchant_id,"adjustment_created",statement.status,statement.status,{adjustment_id:adjustmentId,amount_minor:amount,type},`adjustment:${key}`);return json({id:adjustmentId,status:"pending",applies_to:"next_settlement"},201,cors);}catch(error){return json({error:/UNIQUE/.test(error.message)?"此調整已建立，不可重複入帳。":"建立調整失敗。"},/UNIQUE/.test(error.message)?409:400,cors);}
  }
  if(action==="pdf"&&request.method==="GET"){
    if(!statement.pdf_object_key||!env.CONTRACTS_BUCKET)return json({error:"對帳單 PDF 尚未產生。"},404,cors);const object=await env.CONTRACTS_BUCKET.get(statement.pdf_object_key);if(!object)return json({error:"找不到私人 PDF。"},404,cors);return new Response(object.body,{headers:{...cors,"content-type":"application/pdf","content-disposition":`attachment; filename="${statement.statement_no}.pdf"`,"cache-control":"private, no-store"}});
  }
  if(action==="csv"&&request.method==="GET"){
    const items=await db.prepare("SELECT * FROM merchant_settlement_items WHERE settlement_id=? ORDER BY occurred_at,id").bind(statementId).all(),adjustments=await db.prepare("SELECT * FROM merchant_settlement_adjustments WHERE source_settlement_id=? OR applied_settlement_id=? ORDER BY created_at").bind(statementId,statementId).all();const bytes=settlementCsv(statement,items.results,adjustments.results);return new Response(bytes,{headers:{...cors,"content-type":"text/csv; charset=UTF-8","content-disposition":`attachment; filename="${statement.statement_no}.csv"`,"cache-control":"private, no-store"}});
  }
  return json({error:"Method not allowed"},405,cors);
}
