// Soft-POS V1 deliberately reuses the QR ordering catalogue and order ledger.
// Every stock mutation is represented by inventory_transactions; balances are a
// trigger-maintained projection and are never edited directly.
const E = new TextEncoder();
const uid = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store", ...headers } });
const clean = (value, max = 300) => String(value ?? "").trim().slice(0, max);
const money = (minor) => Number((Number(minor) / 100).toFixed(2));
const hash = async (value) => btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("SHA-256", E.encode(String(value)))))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const METHODS = new Set(["cash", "counter", "card", "line_pay", "easycard_terminal", "bank_transfer", "other"]);
const SOURCES = new Set(["qr_dine_in", "qr_takeaway", "merchant_pos", "online_store", "booking", "manual"]);

async function audit(db, merchantId, actor, action, resource, resourceId, metadata = {}) {
  await db.prepare("INSERT INTO merchant_ordering_audit_logs(id,merchant_id,actor_type,actor_id,actor_role,action,resource_type,resource_id,metadata) VALUES(?,?,?,?,?,?,?,?,?)")
    // The shared QR audit table's historical CHECK accepts customer/admin/system.
    // Preserve its compatibility while retaining the true merchant role.
    .bind(uid("posaudit"), merchantId, "admin", actor.user_id, actor.roles || "merchant", action, resource, resourceId, JSON.stringify(metadata)).run();
}

async function ensureOrderingCore(db, merchantId) {
  let settings = await db.prepare("SELECT * FROM merchant_ordering_settings WHERE merchant_id=?").bind(merchantId).first();
  if (!settings) {
    const merchant = await db.prepare("SELECT name FROM merchants WHERE id=?").bind(merchantId).first();
    if (!merchant) throw new Error("MERCHANT_NOT_FOUND");
    await db.prepare("INSERT INTO merchant_ordering_settings(merchant_id,display_name,enabled,accepting_orders,ordering_open) VALUES(?,?,0,0,1)").bind(merchantId, merchant.name).run();
    settings = await db.prepare("SELECT * FROM merchant_ordering_settings WHERE merchant_id=?").bind(merchantId).first();
  }
  let walkin = await db.prepare("SELECT id FROM ordering_customers WHERE phone_normalized=?").bind(`pos_walkin_${merchantId}`).first();
  if (!walkin) {
    walkin = { id: uid("poscustomer") };
    await db.prepare("INSERT INTO ordering_customers(id,display_name,phone_normalized,phone_display) VALUES(?,?,?,?)").bind(walkin.id, "散客", `pos_walkin_${merchantId}`, "散客").run();
  }
  let membership = await db.prepare("SELECT id FROM merchant_ordering_memberships WHERE merchant_id=? AND customer_id=?").bind(merchantId, walkin.id).first();
  let qr = await db.prepare("SELECT id FROM merchant_ordering_qr_codes WHERE merchant_id=? AND label='POS_INTERNAL'").bind(merchantId).first();
  if (!qr) {
    qr = { id: uid("posqr") };
    await db.prepare("INSERT INTO merchant_ordering_qr_codes(id,merchant_id,code,label,purpose,active) VALUES(?,?,?,?,?,0)").bind(qr.id, merchantId, `pos_internal_${crypto.randomUUID().replaceAll("-", "")}`, "POS_INTERNAL", "takeaway").run();
  }
  if (!membership) {
    membership = { id: uid("posmember") };
    await db.prepare("INSERT INTO merchant_ordering_memberships(id,merchant_id,customer_id,membership_no,joined_via_qr_id,consent_version,consented_at) VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP)").bind(membership.id, merchantId, walkin.id, `POS-${crypto.randomUUID().slice(0,8).toUpperCase()}`, qr.id, "pos-walkin-v1").run();
  }
  return { settings, walkinMembershipId: membership.id, posQrId: qr.id };
}

async function defaultLocation(db, merchantId) {
  let location = await db.prepare("SELECT id FROM inventory_locations WHERE merchant_id=? AND active=1 ORDER BY created_at LIMIT 1").bind(merchantId).first();
  if (!location) {
    location = { id: uid("invloc") };
    await db.prepare("INSERT INTO inventory_locations(id,merchant_id,name) VALUES(?,?,?)").bind(location.id, merchantId, "主庫存").run();
  }
  return location.id;
}

async function profile(db, merchantId) {
  return db.prepare("SELECT * FROM merchant_pos_profiles WHERE merchant_id=? AND enabled=1 AND soft_pos_enabled=1").bind(merchantId).first();
}

function selectedValues(input) {
  const values = Array.isArray(input?.option_value_ids) ? input.option_value_ids.map((v) => clean(v, 120)).filter(Boolean) : [];
  return [...new Set(values)];
}

async function priceLines(db, merchantId, lines) {
  if (!Array.isArray(lines) || !lines.length || lines.length > 50) throw new Error("POS_LINES_INVALID");
  const result = [];
  for (const source of lines) {
    const itemId = clean(source.item_id, 120), quantity = Number(source.quantity || 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new Error("POS_QUANTITY_INVALID");
    const item = await db.prepare("SELECT * FROM merchant_menu_items WHERE merchant_id=? AND id=? AND status='active' AND available=1").bind(merchantId, itemId).first();
    if (!item) throw new Error("POS_ITEM_UNAVAILABLE");
    const groups = (await db.prepare(`SELECT g.* FROM merchant_menu_item_option_groups x JOIN merchant_menu_option_groups g ON g.merchant_id=x.merchant_id AND g.id=x.option_group_id WHERE x.merchant_id=? AND x.menu_item_id=? AND g.active=1 AND g.archived_at IS NULL ORDER BY x.sort_order`).bind(merchantId, itemId).all()).results || [];
    const chosen = selectedValues(source), optionRows = chosen.length ? (await db.prepare(`SELECT * FROM merchant_menu_option_values WHERE merchant_id=? AND id IN (${chosen.map(()=>"?").join(",")}) AND active=1 AND archived_at IS NULL`).bind(merchantId, ...chosen).all()).results : [];
    if (optionRows.length !== chosen.length) throw new Error("POS_OPTION_UNAVAILABLE");
    let delta = 0;
    for (const group of groups) {
      const own = optionRows.filter((x) => x.group_id === group.id);
      if (own.length < Number(group.min_select) || own.length > Number(group.max_select)) throw new Error("POS_OPTION_SELECTION_INVALID");
      if (group.selection_type === "single" && own.length > 1) throw new Error("POS_OPTION_SELECTION_INVALID");
      delta += own.reduce((sum, value) => sum + Number(value.price_delta_minor), 0);
    }
    if (optionRows.some((value) => !groups.some((group) => group.id === value.group_id))) throw new Error("POS_OPTION_MERCHANT_MISMATCH");
    const unit = Number(item.price_minor) + delta;
    result.push({ item, quantity, note: clean(source.note, 300), options: optionRows, base: Number(item.price_minor), delta, unit, lineTotal: unit * quantity });
  }
  return result;
}

async function inventoryStatements(db, merchantId, locationId, orderId, lines, actor) {
  const deltas = new Map();
  for (const line of lines) {
    const recipe = await db.prepare("SELECT id FROM inventory_recipes WHERE merchant_id=? AND menu_item_id=? AND active=1").bind(merchantId, line.item.id).first();
    if (recipe) {
      const parts = (await db.prepare("SELECT inventory_item_id,quantity_minor FROM inventory_recipe_items WHERE recipe_id=? AND merchant_id=?").bind(recipe.id, merchantId).all()).results || [];
      for (const part of parts) deltas.set(part.inventory_item_id, (deltas.get(part.inventory_item_id) || 0) + Number(part.quantity_minor) * line.quantity);
    } else {
      const stock = await db.prepare("SELECT id FROM inventory_items WHERE merchant_id=? AND menu_item_id=? AND active=1").bind(merchantId, line.item.id).first();
      if (stock) deltas.set(stock.id, (deltas.get(stock.id) || 0) + line.quantity);
    }
  }
  return [...deltas.entries()].map(([itemId, quantity]) => db.prepare("INSERT INTO inventory_transactions(id,merchant_id,location_id,inventory_item_id,transaction_type,quantity_delta_minor,source_type,source_id,idempotency_key,actor_type,actor_id,note) VALUES(?,?,?,?,?,-?, ?,?,?, 'merchant',?,?)")
    .bind(uid("invtx"), merchantId, locationId, itemId, "sale", quantity, "merchant_food_order", orderId, `pos-sale:${orderId}:${itemId}`, actor.user_id, "Soft-POS 銷售扣庫存"));
}

async function recordPayment(db, merchantId, orderId, totalMinor, method, actor, key) {
  if (!METHODS.has(method)) throw new Error("POS_PAYMENT_METHOD_INVALID");
  const paymentId = uid("pay"), paymentNo = `POS-${Date.now()}-${crypto.randomUUID().slice(0,6).toUpperCase()}`;
  const financeMethod = ["cash","card","line_pay","bank_transfer"].includes(method) ? method : "other";
  const gross = money(totalMinor);
  const statement = db.prepare("INSERT INTO payments(id,payment_no,merchant_id,order_id,gross_amount,fee_amount,net_amount,amount,currency,payment_method,status,paid_at,confirmed_at,source,note,created_at,updated_at) VALUES(?,?,?,?,?,0,?,?, 'TWD',?,'paid',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,'manual',?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)")
    .bind(paymentId, paymentNo, merchantId, null, gross, gross, gross, financeMethod, `soft_pos_order:${orderId}; manual_confirmation; key:${key}`);
  return { paymentId, paymentNo, statement };
}

async function createOrder(request, db, merchantId, actor) {
  const input = await request.json(); const key = clean(request.headers.get("idempotency-key") || input.idempotency_key, 120);
  if (!key) return json({ error: "建立訂單需要 Idempotency-Key。", code: "IDEMPOTENCY_KEY_REQUIRED" }, 400);
  const existing = await db.prepare("SELECT result_json FROM pos_operations WHERE merchant_id=? AND operation_type='create_order' AND idempotency_key=?").bind(merchantId, key).first();
  if (existing?.result_json) return json({ ...JSON.parse(existing.result_json), replayed: true }, 200);
  const p = await profile(db, merchantId); if (!p) return json({ error: "Soft-POS 尚未開通。", code: "SOFT_POS_DISABLED" }, 423);
  const core = await ensureOrderingCore(db, merchantId); const lines = await priceLines(db, merchantId, input.items); const source = SOURCES.has(input.order_source) ? input.order_source : "merchant_pos";
  if (source !== "merchant_pos" && source !== "manual") return json({ error: "POS 僅能建立店員開單來源。", code: "POS_SOURCE_INVALID" }, 422);
  const type = input.order_type === "dine_in" ? "dine_in" : "takeaway", table = clean(input.table_label, 40);
  if (type === "dine_in" && !table) return json({ error: "內用訂單需要桌號。", code: "TABLE_REQUIRED" }, 422);
  const total = lines.reduce((sum, line) => sum + line.lineTotal, 0); const orderId = uid("foodorder"), code = `${core.settings.order_number_prefix || "BY"}-${Date.now().toString().slice(-8)}-${crypto.randomUUID().slice(0,4).toUpperCase()}`;
  const locationId = await defaultLocation(db, merchantId); const paymentMethod = clean(input.payment_method || "counter", 40); const confirm = input.confirm_payment === true;
  const legacyOrderMethod = ["cash", "counter", "card", "line_pay"].includes(paymentMethod) ? paymentMethod : "other";
  const statements = [
    db.prepare("INSERT INTO merchant_food_orders(id,order_code,merchant_id,membership_id,qr_id,table_label,order_type,status,payment_status,payment_method,payment_method_v1,pos_payment_method,subtotal_minor,total_minor,customer_note,idempotency_key,order_source,pos_ticket_no,pos_staff_id) VALUES(?,?,?,?,?,?,?,'submitted',?,?,?,?,?,?,?,?,'merchant_pos',?,?)")
      .bind(orderId, code, merchantId, core.walkinMembershipId, core.posQrId, table || null, type, confirm ? "paid" : "unpaid", legacyOrderMethod, legacyOrderMethod, paymentMethod, total, total, clean(input.note, 500) || null, key, code, actor.user_id),
  ];
  const orderItemIds = lines.map(() => uid("fooditem"));
  statements.splice(1, 0, ...lines.map((line, index) => db.prepare("INSERT INTO merchant_food_order_items(id,order_id,menu_item_id,name_snapshot,unit_price_minor,quantity,line_total_minor,note,base_price_minor,option_delta_minor,unit_total_minor) VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind(orderItemIds[index], orderId, line.item.id, line.item.name, line.unit, line.quantity, line.lineTotal, line.note || null, line.base, line.delta, line.unit)));
  for (let index=0; index<lines.length; index+=1) for (const option of lines[index].options) {
    const group = await db.prepare("SELECT name FROM merchant_menu_option_groups WHERE merchant_id=? AND id=?").bind(merchantId, option.group_id).first();
    statements.push(db.prepare("INSERT INTO merchant_food_order_item_options(id,merchant_id,order_id,order_item_id,option_group_id,option_value_id,group_name_snapshot,value_name_snapshot,price_delta_minor) VALUES(?,?,?,?,?,?,?,?,?)").bind(uid("foodoption"), merchantId, orderId, orderItemIds[index], option.group_id, option.id, group?.name || "選項", option.name, option.price_delta_minor));
  }
  statements.push(...await inventoryStatements(db, merchantId, locationId, orderId, lines, actor));
  let payment = null;
  if (confirm) {
    payment = await recordPayment(db, merchantId, orderId, total, paymentMethod, actor, key);
    statements.push(payment.statement);
    if (paymentMethod === "cash") {
      const cash = await db.prepare("SELECT id FROM cash_sessions WHERE merchant_id=? AND status='open'").bind(merchantId).first();
      if (!cash) return json({ error: "請先開始現金班別，再確認現金付款。", code: "CASH_SESSION_REQUIRED" }, 409);
      statements.push(db.prepare("INSERT INTO cash_movements(id,merchant_id,cash_session_id,movement_type,amount_minor,order_id,payment_id,idempotency_key,actor_id,note) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(uid("cashmove"), merchantId, cash.id, "sale", total, orderId, payment.paymentId, `pos-cash:${key}`, actor.user_id, "Soft-POS 現金收款"));
    }
  }
  const result = { ok: true, order_id: orderId, order_code: code, total_minor: total, payment_status: confirm ? "paid" : "unpaid", payment_id: payment?.paymentId || null };
  statements.push(db.prepare("INSERT INTO pos_operations(id,merchant_id,operation_type,idempotency_key,result_json) VALUES(?,?,?,?,?)").bind(uid("posop"), merchantId, "create_order", key, JSON.stringify(result)));
  statements.push(db.prepare("INSERT INTO merchant_ordering_audit_logs(id,merchant_id,actor_type,actor_id,actor_role,action,resource_type,resource_id,metadata) VALUES(?,?,?,?,?,?,?,?,?)").bind(uid("posaudit"), merchantId, "admin", actor.user_id, actor.roles || "merchant", "pos_order_created", "order", orderId, JSON.stringify({ total_minor: total, source: "merchant_pos", payment_confirmed: confirm })));
  try { await db.batch(statements); } catch (error) { const message=String(error?.message||error); if(message.includes("INVENTORY_NEGATIVE_GUARD")) return json({ error:"庫存不足，訂單未建立。",code:"INVENTORY_NEGATIVE_GUARD"},409); throw error; }
  return json(result, 201);
}

async function overview(db, merchantId) {
  const today = "date('now','+8 hours')";
  const rows = await db.prepare(`SELECT COUNT(*) orders,COALESCE(SUM(total_minor),0) revenue,COALESCE(SUM(CASE WHEN payment_method_v1='cash' AND payment_status='paid' THEN total_minor ELSE 0 END),0) cash,COALESCE(SUM(CASE WHEN payment_status='paid' AND payment_method_v1<>'cash' THEN total_minor ELSE 0 END),0) other,COALESCE(SUM(CASE WHEN status IN('submitted','accepted','preparing','ready') THEN 1 ELSE 0 END),0) pending,COALESCE(SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END),0) completed FROM merchant_food_orders WHERE merchant_id=? AND date(created_at,'+8 hours')=${today}`).bind(merchantId).first();
  const hot = (await db.prepare("SELECT name_snapshot name,SUM(quantity) quantity FROM merchant_food_order_items i JOIN merchant_food_orders o ON o.id=i.order_id WHERE o.merchant_id=? AND date(o.created_at,'+8 hours')=date('now','+8 hours') GROUP BY name_snapshot ORDER BY quantity DESC LIMIT 5").bind(merchantId).all()).results;
  const low = (await db.prepare("SELECT i.id,i.name,b.quantity_minor,i.safety_stock_minor FROM inventory_items i LEFT JOIN inventory_balances b ON b.merchant_id=i.merchant_id AND b.inventory_item_id=i.id WHERE i.merchant_id=? AND i.active=1 AND COALESCE(b.quantity_minor,0)<=i.safety_stock_minor ORDER BY i.name LIMIT 20").bind(merchantId).all()).results;
  const bookings = await db.prepare("SELECT COUNT(*) count FROM merchant_bookings WHERE merchant_id=? AND date(start_at,'+8 hours')=date('now','+8 hours') AND status IN('pending','confirmed')").bind(merchantId).first().catch(()=>({count:0}));
  return { today:{ revenue_minor:Number(rows.revenue),orders:Number(rows.orders),pending:Number(rows.pending),completed:Number(rows.completed),cash_minor:Number(rows.cash),other_minor:Number(rows.other),average_minor:Number(rows.orders)?Math.round(Number(rows.revenue)/Number(rows.orders)):0,bookings:Number(bookings?.count||0)}, hot_items:hot||[],low_stock:low||[] };
}

async function cashAction(request, db, merchantId, actor, type) {
  const input=await request.json(), key=clean(request.headers.get("idempotency-key")||input.idempotency_key,120); if(!key)return json({error:"現金操作需要 Idempotency-Key。",code:"IDEMPOTENCY_KEY_REQUIRED"},400);
  if(type==="open") { const amount=Number(input.opening_float_minor||0); if(!Number.isInteger(amount)||amount<0)return json({error:"備用金格式錯誤。"},422); const existing=await db.prepare("SELECT id FROM cash_sessions WHERE merchant_id=? AND status='open'").bind(merchantId).first(); if(existing)return json({error:"已有開啟中的現金班別。",code:"CASH_SESSION_ALREADY_OPEN"},409); const id=uid("cashsession"); await db.prepare("INSERT INTO cash_sessions(id,merchant_id,opening_float_minor,expected_cash_minor,opened_by) VALUES(?,?,?,?,?)").bind(id,merchantId,amount,amount,actor.user_id).run(); await audit(db,merchantId,actor,"cash_session_opened","cash_session",id,{opening_float_minor:amount}); return json({ok:true,id,opening_float_minor:amount},201); }
  const open=await db.prepare("SELECT * FROM cash_sessions WHERE merchant_id=? AND status='open'").bind(merchantId).first(); if(!open)return json({error:"找不到開啟中的現金班別。",code:"CASH_SESSION_REQUIRED"},409);
  if(type==="movement") { const amount=Number(input.amount_minor), movement=clean(input.movement_type,30); if(!Number.isInteger(amount)||amount===0||!["refund","expense","adjustment"].includes(movement))return json({error:"現金異動格式錯誤。"},422); const signed=movement==="adjustment"?amount:-Math.abs(amount); await db.prepare("INSERT INTO cash_movements(id,merchant_id,cash_session_id,movement_type,amount_minor,idempotency_key,actor_id,note) VALUES(?,?,?,?,?,?,?,?)").bind(uid("cashmove"),merchantId,open.id,movement,signed,key,actor.user_id,clean(input.note,300)||null).run(); await audit(db,merchantId,actor,"cash_movement_created","cash_session",open.id,{movement_type:movement,amount_minor:signed}); return json({ok:true},201); }
  const counted=Number(input.counted_cash_minor); if(!Number.isInteger(counted)||counted<0)return json({error:"實際現金格式錯誤。"},422); const movements=await db.prepare("SELECT COALESCE(SUM(amount_minor),0) total FROM cash_movements WHERE cash_session_id=?").bind(open.id).first(); const expected=Number(open.opening_float_minor)+Number(movements.total||0), variance=counted-expected; await db.prepare("UPDATE cash_sessions SET status='closed',expected_cash_minor=?,counted_cash_minor=?,variance_minor=?,closed_by=?,closed_at=CURRENT_TIMESTAMP,close_note=? WHERE id=? AND status='open'").bind(expected,counted,variance,actor.user_id,clean(input.note,300)||null,open.id).run(); await audit(db,merchantId,actor,"cash_session_closed","cash_session",open.id,{expected_cash_minor:expected,counted_cash_minor:counted,variance_minor:variance}); return json({ok:true,expected_cash_minor:expected,counted_cash_minor:counted,variance_minor:variance});
}

export async function handleSoftPosRequest(request, env, url, cors, actor) {
  const db=env.FINANCE_DB, merchantId=actor.merchant_id;
  try {
    if(url.pathname==="/api/merchant-pos/overview"&&request.method==="GET") return json(await overview(db,merchantId),200,cors);
    if(url.pathname==="/api/merchant-pos/catalog"&&request.method==="GET") { const categories=(await db.prepare("SELECT id,name,description,sort_order FROM merchant_menu_categories WHERE merchant_id=? AND active=1 AND archived_at IS NULL ORDER BY sort_order,name").bind(merchantId).all()).results; const items=(await db.prepare("SELECT id,category_id,sku,barcode,name,description,price_minor,cost_minor,status,available FROM merchant_menu_items WHERE merchant_id=? AND status='active' AND available=1 ORDER BY sort_order,name").bind(merchantId).all()).results; const groups=(await db.prepare("SELECT * FROM merchant_menu_option_groups WHERE merchant_id=? AND active=1 AND archived_at IS NULL ORDER BY sort_order").bind(merchantId).all()).results; const values=(await db.prepare("SELECT * FROM merchant_menu_option_values WHERE merchant_id=? AND active=1 AND archived_at IS NULL ORDER BY sort_order").bind(merchantId).all()).results; const links=(await db.prepare("SELECT menu_item_id,option_group_id FROM merchant_menu_item_option_groups WHERE merchant_id=? ORDER BY sort_order").bind(merchantId).all()).results; return json({categories,items,option_groups:groups,option_values:values,item_option_groups:links},200,cors); }
    if(url.pathname==="/api/merchant-pos/orders"&&request.method==="POST") return await createOrder(request,db,merchantId,actor);
    if(url.pathname==="/api/merchant-pos/orders"&&request.method==="GET") { const rows=(await db.prepare("SELECT o.*,c.display_name customer_name FROM merchant_food_orders o LEFT JOIN merchant_ordering_memberships m ON m.id=o.membership_id LEFT JOIN ordering_customers c ON c.id=m.customer_id WHERE o.merchant_id=? ORDER BY o.created_at DESC LIMIT 200").bind(merchantId).all()).results; return json({items:rows},200,cors); }
    const orderStatus = url.pathname.match(/^\/api\/merchant-pos\/orders\/([^/]+)\/status$/);
    if(orderStatus&&request.method==="POST") { const input=await request.json(), key=clean(request.headers.get("idempotency-key")||input.idempotency_key,120), next=clean(input.status,30); if(!key)return json({error:"訂單操作需要 Idempotency-Key。",code:"IDEMPOTENCY_KEY_REQUIRED"},400,cors); if(!["submitted","accepted","preparing","ready","served","completed","cancelled"].includes(next))return json({error:"訂單狀態不正確。"},422,cors); const order=await db.prepare("SELECT * FROM merchant_food_orders WHERE merchant_id=? AND order_code=?").bind(merchantId,orderStatus[1]).first(); if(!order)return json({error:"找不到訂單。"},404,cors); const allowed={submitted:["accepted","cancelled"],accepted:["preparing","cancelled"],preparing:["ready","cancelled"],ready:["served","cancelled"],served:["completed"],completed:[],cancelled:[]}; if(!allowed[order.status]?.includes(next))return json({error:"不允許跳過訂單流程。",code:"ORDER_STATE_INVALID"},409,cors); const changed=await db.prepare("UPDATE merchant_food_orders SET status=?,accepted_at=CASE WHEN ?='accepted' THEN CURRENT_TIMESTAMP ELSE accepted_at END,preparing_at=CASE WHEN ?='preparing' THEN CURRENT_TIMESTAMP ELSE preparing_at END,ready_at=CASE WHEN ?='ready' THEN CURRENT_TIMESTAMP ELSE ready_at END,served_at=CASE WHEN ?='served' THEN CURRENT_TIMESTAMP ELSE served_at END,completed_at=CASE WHEN ?='completed' THEN CURRENT_TIMESTAMP ELSE completed_at END,cancelled_at=CASE WHEN ?='cancelled' THEN CURRENT_TIMESTAMP ELSE cancelled_at END,cancel_reason=CASE WHEN ?='cancelled' THEN ? ELSE cancel_reason END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND merchant_id=? AND status=?").bind(next,next,next,next,next,next,next,next,clean(input.cancel_reason,300)||null,order.id,merchantId,order.status).run(); if(!changed.meta?.changes)return json({error:"訂單已被其他操作更新，請重新整理。"},409,cors); await audit(db,merchantId,actor,"pos_order_status_updated","order",order.id,{from:order.status,to:next,idempotency_key:key}); return json({ok:true,status:next},200,cors); }
    if(url.pathname==="/api/merchant-pos/cash/open"&&request.method==="POST") return await cashAction(request,db,merchantId,actor,"open");
    if(url.pathname==="/api/merchant-pos/cash/movements"&&request.method==="POST") return await cashAction(request,db,merchantId,actor,"movement");
    if(url.pathname==="/api/merchant-pos/cash/close"&&request.method==="POST") return await cashAction(request,db,merchantId,actor,"close");
    if(url.pathname==="/api/merchant-pos/inventory"&&request.method==="GET") { const rows=(await db.prepare("SELECT i.*,COALESCE(b.quantity_minor,0) quantity_minor FROM inventory_items i LEFT JOIN inventory_balances b ON b.merchant_id=i.merchant_id AND b.inventory_item_id=i.id WHERE i.merchant_id=? ORDER BY i.name").bind(merchantId).all()).results; return json({items:rows},200,cors); }
    if(url.pathname==="/api/merchant-pos/inventory/adjust"&&request.method==="POST") { const input=await request.json(),key=clean(request.headers.get("idempotency-key")||input.idempotency_key,120),delta=Number(input.quantity_delta_minor); if(!key||!Number.isInteger(delta)||delta===0)return json({error:"庫存異動需要整數數量與 Idempotency-Key。"},422,cors); const location=await defaultLocation(db,merchantId); const item=await db.prepare("SELECT id FROM inventory_items WHERE merchant_id=? AND id=?").bind(merchantId,clean(input.inventory_item_id,120)).first(); if(!item)return json({error:"找不到庫存品項。"},404,cors); await db.prepare("INSERT INTO inventory_transactions(id,merchant_id,location_id,inventory_item_id,transaction_type,quantity_delta_minor,source_type,idempotency_key,actor_type,actor_id,note) VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind(uid("invtx"),merchantId,location,item.id,clean(input.transaction_type,30)==="stocktake"?"stocktake":"adjustment",delta,"manual",key,"merchant",actor.user_id,clean(input.note,300)||null).run(); await audit(db,merchantId,actor,"inventory_adjusted","inventory_item",item.id,{quantity_delta_minor:delta}); return json({ok:true},201,cors); }
    return json({error:"找不到 Soft-POS 服務。"},404,cors);
  } catch(error) { const message=String(error?.message||error); if(message.includes("INVENTORY_NEGATIVE_GUARD"))return json({error:"庫存不足。",code:"INVENTORY_NEGATIVE_GUARD"},409,cors); if(message.startsWith("POS_"))return json({error:"訂單資料或商品選項不正確。",code:message},422,cors); console.error(JSON.stringify({service:"soft_pos",path:url.pathname,error:message})); return json({error:"Soft-POS 暫時無法使用。"},500,cors); }
}

export async function handleSoftPosAdmin(request, env, url, cors) {
  if(url.pathname!=="/api/admin/soft-pos"||request.method!=="GET")return null;
  const rows=(await env.FINANCE_DB.prepare("SELECT p.*,m.name,COUNT(o.id) order_count FROM merchant_pos_profiles p JOIN merchants m ON m.id=p.merchant_id LEFT JOIN merchant_food_orders o ON o.merchant_id=p.merchant_id GROUP BY p.merchant_id ORDER BY p.updated_at DESC LIMIT 500").all()).results;
  return json({items:rows},200,cors);
}
