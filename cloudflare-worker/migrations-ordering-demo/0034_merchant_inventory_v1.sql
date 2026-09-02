-- STAGING / DEMO ONLY. Blank merchant-managed menu item inventory.
-- This directory is bound only by wrangler.ordering-staging.jsonc.

CREATE TABLE IF NOT EXISTS merchant_inventory_items (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  menu_item_id TEXT NOT NULL,
  stock_on_hand INTEGER NOT NULL CHECK(typeof(stock_on_hand)='integer' AND stock_on_hand >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK(typeof(low_stock_threshold)='integer' AND low_stock_threshold >= 0),
  inventory_enabled INTEGER NOT NULL DEFAULT 1 CHECK(inventory_enabled IN (0,1)),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,menu_item_id),
  UNIQUE(merchant_id,id),
  FOREIGN KEY(merchant_id,menu_item_id) REFERENCES merchant_menu_items(merchant_id,id)
);

CREATE TABLE IF NOT EXISTS merchant_inventory_movements (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  inventory_item_id TEXT NOT NULL,
  menu_item_id TEXT NOT NULL,
  order_id TEXT,
  order_item_id TEXT,
  movement_type TEXT NOT NULL CHECK(movement_type IN ('INITIAL','RESTOCK','ORDER_DEDUCTION','ORDER_RESTORE','MANUAL_ADJUSTMENT','RESET')),
  quantity_delta INTEGER NOT NULL CHECK(typeof(quantity_delta)='integer' AND quantity_delta <> 0),
  quantity_before INTEGER NOT NULL CHECK(typeof(quantity_before)='integer' AND quantity_before >= 0),
  quantity_after INTEGER NOT NULL CHECK(typeof(quantity_after)='integer' AND quantity_after >= 0),
  reason TEXT,
  actor_type TEXT NOT NULL CHECK(actor_type IN ('customer','merchant','admin','system')),
  actor_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(merchant_id,inventory_item_id) REFERENCES merchant_inventory_items(merchant_id,id),
  FOREIGN KEY(order_id) REFERENCES merchant_food_orders(id),
  FOREIGN KEY(order_item_id) REFERENCES merchant_food_order_items(id),
  CHECK(quantity_after = quantity_before + quantity_delta)
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_merchant
  ON merchant_inventory_items(merchant_id,inventory_enabled,stock_on_hand);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_item
  ON merchant_inventory_movements(merchant_id,inventory_item_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_order_deduction
  ON merchant_inventory_movements(order_item_id,movement_type)
  WHERE order_item_id IS NOT NULL AND movement_type='ORDER_DEDUCTION';
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_order_restore
  ON merchant_inventory_movements(order_item_id,movement_type)
  WHERE order_item_id IS NOT NULL AND movement_type='ORDER_RESTORE';

CREATE TRIGGER IF NOT EXISTS trg_inventory_movements_no_update
BEFORE UPDATE ON merchant_inventory_movements
BEGIN SELECT RAISE(ABORT,'INVENTORY_LEDGER_IMMUTABLE'); END;

CREATE TRIGGER IF NOT EXISTS trg_inventory_movements_no_delete
BEFORE DELETE ON merchant_inventory_movements
BEGIN SELECT RAISE(ABORT,'INVENTORY_LEDGER_IMMUTABLE'); END;
