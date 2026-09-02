const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store", ...headers } });
const clean = (value, max = 500) => String(value ?? "").trim().slice(0, max);
const uid = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
const roles = (session) => String(session?.roles || "").split(",").filter(Boolean);

function integer(value, min = 0, max = 100000000) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= min && number <= max ? number : null;
}

function ownerOnly(authorization, cors) {
  return roles(authorization?.session).includes("owner") ? null : json({ code: "INVENTORY_FORBIDDEN", error: "只有商家管理者可以管理庫存。" }, 403, cors);
}

const inventorySelect = `SELECT i.id,i.menu_item_id,m.name menu_item_name,i.stock_on_hand,i.low_stock_threshold,
  i.inventory_enabled,i.notes,i.created_at,i.updated_at,
  CASE WHEN i.inventory_enabled=1 AND i.stock_on_hand=0 THEN 'sold_out'
       WHEN i.inventory_enabled=1 AND i.stock_on_hand<=i.low_stock_threshold THEN 'low_stock'
       WHEN i.inventory_enabled=1 THEN 'normal' ELSE 'disabled' END inventory_status,
  (SELECT MAX(created_at) FROM merchant_inventory_movements x WHERE x.merchant_id=i.merchant_id AND x.inventory_item_id=i.id) last_movement_at
  FROM merchant_inventory_items i JOIN merchant_menu_items m ON m.merchant_id=i.merchant_id AND m.id=i.menu_item_id`;

export async function inventorySummary(db, merchantId) {
  const row = await db.prepare(`SELECT COUNT(*) total,
    SUM(CASE WHEN inventory_enabled=1 AND stock_on_hand>low_stock_threshold THEN 1 ELSE 0 END) normal,
    SUM(CASE WHEN inventory_enabled=1 AND stock_on_hand>0 AND stock_on_hand<=low_stock_threshold THEN 1 ELSE 0 END) low_stock,
    SUM(CASE WHEN inventory_enabled=1 AND stock_on_hand=0 THEN 1 ELSE 0 END) sold_out
    FROM merchant_inventory_items WHERE merchant_id=? AND reset_at IS NULL`).bind(merchantId).first();
  return { total: Number(row?.total || 0), normal: Number(row?.normal || 0), low_stock: Number(row?.low_stock || 0), sold_out: Number(row?.sold_out || 0) };
}

export async function handleMerchantInventory(request, env, url, cors, authorization) {
  const denied = ownerOnly(authorization, cors); if (denied) return denied;
  const db = env.FINANCE_DB, merchantId = authorization.session.merchant_id, actorId = authorization.session.user_id;
  if (!db) return json({ error: "庫存服務暫時無法使用。" }, 503, cors);

  if (url.pathname === "/api/merchant-admin/inventory" && request.method === "GET") {
    const [items, menuItems, summary] = await Promise.all([
      db.prepare(`${inventorySelect} WHERE i.merchant_id=? AND i.reset_at IS NULL ORDER BY m.sort_order,m.name`).bind(merchantId).all(),
      db.prepare(`SELECT m.id,m.name,m.status,CASE WHEN i.id IS NULL THEN 0 ELSE 1 END inventory_exists,
        i.stock_on_hand,i.inventory_enabled FROM merchant_menu_items m LEFT JOIN merchant_inventory_items i ON i.merchant_id=m.merchant_id AND i.menu_item_id=m.id AND i.reset_at IS NULL
        WHERE m.merchant_id=? AND m.status<>'archived' ORDER BY m.sort_order,m.name`).bind(merchantId).all(),
      inventorySummary(db, merchantId),
    ]);
    return json({ items: items.results || [], menu_items: menuItems.results || [], summary, blank: summary.total === 0 }, 200, cors);
  }

  if (url.pathname === "/api/merchant-admin/inventory" && request.method === "POST") {
    const input = await request.json().catch(() => ({}));
    const menuItemId = clean(input.menu_item_id, 120), stock = integer(input.stock_on_hand), threshold = integer(input.low_stock_threshold ?? 5);
    if (!menuItemId || stock === null || threshold === null) return json({ code: "INVENTORY_INPUT_INVALID", error: "庫存與低庫存警戒必須是 0 以上的整數。" }, 422, cors);
    const menu = await db.prepare("SELECT id FROM merchant_menu_items WHERE merchant_id=? AND id=? AND status<>'archived'").bind(merchantId, menuItemId).first();
    if (!menu) return json({ code: "MENU_ITEM_INVALID", error: "找不到此商家的餐點。" }, 422, cors);
    const existing = await db.prepare("SELECT id FROM merchant_inventory_items WHERE merchant_id=? AND menu_item_id=? AND reset_at IS NULL").bind(merchantId, menuItemId).first();
    if (existing) return json({ code: "INVENTORY_DUPLICATE", error: "此餐點已建立庫存。" }, 409, cors);
    const id = uid("inventory"), enabled = input.inventory_enabled === false ? 0 : 1;
    const statements = [db.prepare(`INSERT INTO merchant_inventory_items(id,merchant_id,menu_item_id,stock_on_hand,low_stock_threshold,inventory_enabled,notes) VALUES(?,?,?,?,?,?,?)`).bind(id, merchantId, menuItemId, stock, threshold, enabled, clean(input.notes, 1000) || null)];
    if (stock > 0) statements.push(db.prepare(`INSERT INTO merchant_inventory_movements(id,merchant_id,inventory_item_id,menu_item_id,movement_type,quantity_delta,quantity_before,quantity_after,reason,actor_type,actor_id) VALUES(?,?,?,?,'INITIAL',?,0,?,'商家初始庫存','merchant',?)`).bind(uid("invmove"), merchantId, id, menuItemId, stock, stock, actorId));
    try { await db.batch(statements); } catch (error) {
      if (String(error).includes("UNIQUE")) return json({ code: "INVENTORY_DUPLICATE", error: "此餐點已建立庫存。" }, 409, cors);
      throw error;
    }
    return json({ ok: true, id }, 201, cors);
  }

  const itemMatch = url.pathname.match(/^\/api\/merchant-admin\/inventory\/([^/]+)$/);
  if (itemMatch && request.method === "PATCH") {
    const current = await db.prepare("SELECT * FROM merchant_inventory_items WHERE merchant_id=? AND id=? AND reset_at IS NULL").bind(merchantId, clean(itemMatch[1], 160)).first();
    if (!current) return json({ error: "找不到此庫存項目。" }, 404, cors);
    const input = await request.json().catch(() => ({}));
    const threshold = integer(input.low_stock_threshold ?? current.low_stock_threshold);
    if (threshold === null) return json({ code: "INVENTORY_INPUT_INVALID", error: "低庫存警戒必須是 0 以上的整數。" }, 422, cors);
    await db.prepare("UPDATE merchant_inventory_items SET low_stock_threshold=?,inventory_enabled=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE merchant_id=? AND id=?").bind(threshold, input.inventory_enabled == null ? current.inventory_enabled : (input.inventory_enabled ? 1 : 0), clean(input.notes ?? current.notes, 1000) || null, merchantId, current.id).run();
    return json({ ok: true }, 200, cors);
  }

  const actionMatch = url.pathname.match(/^\/api\/merchant-admin\/inventory\/([^/]+)\/(restock|adjust)$/);
  if (actionMatch && request.method === "POST") {
    const current = await db.prepare("SELECT * FROM merchant_inventory_items WHERE merchant_id=? AND id=? AND reset_at IS NULL").bind(merchantId, clean(actionMatch[1], 160)).first();
    if (!current) return json({ error: "找不到此庫存項目。" }, 404, cors);
    const input = await request.json().catch(() => ({})), delta = integer(input.adjustment_quantity, -100000000, 100000000);
    if (delta === null || delta === 0 || (actionMatch[2] === "restock" && delta < 1)) return json({ code: "INVENTORY_ADJUSTMENT_INVALID", error: "請輸入正確的整數異動數量。" }, 422, cors);
    const after = Number(current.stock_on_hand) + delta;
    if (!Number.isSafeInteger(after) || after < 0) return json({ code: "INVENTORY_NEGATIVE", error: "調整後庫存不得為負數。" }, 409, cors);
    const reason = clean(input.reason, 500);
    if (actionMatch[2] === "adjust" && !reason) return json({ code: "INVENTORY_REASON_REQUIRED", error: "人工調整必須填寫理由。" }, 422, cors);
    const type = actionMatch[2] === "restock" ? "RESTOCK" : "MANUAL_ADJUSTMENT";
    try {
      await db.batch([
        db.prepare("UPDATE merchant_inventory_items SET stock_on_hand=stock_on_hand+?,updated_at=CURRENT_TIMESTAMP WHERE merchant_id=? AND id=? AND reset_at IS NULL").bind(delta, merchantId, current.id),
        db.prepare(`INSERT INTO merchant_inventory_movements(id,merchant_id,inventory_item_id,menu_item_id,movement_type,quantity_delta,quantity_before,quantity_after,reason,actor_type,actor_id)
          SELECT ?,merchant_id,id,menu_item_id,?, ?,stock_on_hand-?,stock_on_hand,?,'merchant',? FROM merchant_inventory_items WHERE merchant_id=? AND id=? AND reset_at IS NULL`).bind(uid("invmove"), type, delta, delta, reason || (type === "RESTOCK" ? "商家補貨" : null), actorId, merchantId, current.id),
      ]);
    } catch (error) { if (String(error).includes("CHECK constraint")) return json({ code: "INVENTORY_NEGATIVE", error: "調整後庫存不得為負數。" }, 409, cors); throw error; }
    return json({ ok: true, stock_on_hand: after }, 200, cors);
  }

  const movementsMatch = url.pathname.match(/^\/api\/merchant-admin\/inventory\/([^/]+)\/movements$/);
  if (movementsMatch && request.method === "GET") {
    const current = await db.prepare("SELECT id FROM merchant_inventory_items WHERE merchant_id=? AND id=? AND reset_at IS NULL").bind(merchantId, clean(movementsMatch[1], 160)).first();
    if (!current) return json({ error: "找不到此庫存項目。" }, 404, cors);
    const rows = await db.prepare("SELECT id,menu_item_id,movement_type,quantity_delta,quantity_before,quantity_after,order_id,reason,actor_type,actor_id,created_at FROM merchant_inventory_movements WHERE merchant_id=? AND inventory_item_id=? ORDER BY datetime(created_at) DESC,id DESC LIMIT 300").bind(merchantId, current.id).all();
    return json({ items: rows.results || [] }, 200, cors);
  }
  return null;
}

export function deductionStatements(db, merchantId, orderId, lines, actorId) {
  return lines.flatMap((line) => [
    db.prepare(`INSERT INTO merchant_inventory_movements(id,merchant_id,inventory_item_id,menu_item_id,order_id,order_item_id,movement_type,quantity_delta,quantity_before,quantity_after,reason,actor_type,actor_id)
      SELECT ?,i.merchant_id,i.id,i.menu_item_id,?,?,'ORDER_DEDUCTION',-?,i.stock_on_hand,i.stock_on_hand-?,'QR 訂單自動扣庫存','customer',?
      FROM merchant_inventory_items i WHERE i.merchant_id=? AND i.menu_item_id=? AND i.inventory_enabled=1 AND i.reset_at IS NULL`).bind(uid("invmove"), orderId, line.order_item_id, line.quantity, line.quantity, actorId, merchantId, line.menu_item_id),
    db.prepare(`UPDATE merchant_inventory_items SET stock_on_hand=stock_on_hand-?,updated_at=CURRENT_TIMESTAMP WHERE merchant_id=? AND menu_item_id=? AND inventory_enabled=1 AND reset_at IS NULL`).bind(line.quantity, merchantId, line.menu_item_id),
  ]);
}

export function restoreStatements(db, merchantId, orderId, lines, actorType, actorId, reason) {
  return lines.flatMap((line) => [
    db.prepare(`UPDATE merchant_inventory_items SET stock_on_hand=stock_on_hand+?,updated_at=CURRENT_TIMESTAMP
      WHERE merchant_id=? AND menu_item_id=? AND reset_at IS NULL AND EXISTS(SELECT 1 FROM merchant_inventory_movements d WHERE d.order_item_id=? AND d.movement_type='ORDER_DEDUCTION')
      AND NOT EXISTS(SELECT 1 FROM merchant_inventory_movements r WHERE r.order_item_id=? AND r.movement_type='ORDER_RESTORE')`).bind(line.quantity, merchantId, line.menu_item_id, line.id, line.id),
    db.prepare(`INSERT OR IGNORE INTO merchant_inventory_movements(id,merchant_id,inventory_item_id,menu_item_id,order_id,order_item_id,movement_type,quantity_delta,quantity_before,quantity_after,reason,actor_type,actor_id)
      SELECT ?,i.merchant_id,i.id,i.menu_item_id,?,?,'ORDER_RESTORE',?,i.stock_on_hand-?,i.stock_on_hand,?,?,?
      FROM merchant_inventory_items i WHERE i.merchant_id=? AND i.menu_item_id=? AND i.reset_at IS NULL
      AND EXISTS(SELECT 1 FROM merchant_inventory_movements d WHERE d.order_item_id=? AND d.movement_type='ORDER_DEDUCTION')`).bind(uid("invmove"), orderId, line.id, line.quantity, line.quantity, clean(reason, 500) || "訂單取消回補", actorType, actorId, merchantId, line.menu_item_id, line.id),
  ]);
}
