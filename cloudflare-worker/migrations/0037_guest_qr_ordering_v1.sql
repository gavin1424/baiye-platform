PRAGMA foreign_keys=OFF;

DROP TRIGGER IF EXISTS trg_food_orders_immutable_values;
DROP TRIGGER IF EXISTS trg_ordering_dining_session_merchant;
DROP TRIGGER IF EXISTS trg_ordering_order_item_merchant;

CREATE TABLE merchant_food_orders_guest_v1 (
  id TEXT PRIMARY KEY,
  order_code TEXT NOT NULL UNIQUE,
  merchant_id TEXT NOT NULL,
  membership_id TEXT,
  qr_id TEXT NOT NULL,
  table_label TEXT,
  order_type TEXT NOT NULL CHECK(order_type IN ('dine_in','takeaway')),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','accepted','preparing','ready','served','completed','cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid','paid','refunded')),
  payment_method TEXT NOT NULL DEFAULT 'counter' CHECK(payment_method IN ('counter','cash','line_pay','card','other')),
  subtotal_minor INTEGER NOT NULL CHECK(subtotal_minor >= 0),
  total_minor INTEGER NOT NULL CHECK(total_minor >= 0),
  customer_note TEXT,
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_at TEXT,
  completed_at TEXT,
  cancelled_at TEXT,
  dining_session_id TEXT,
  cancel_reason TEXT,
  cancelled_by_type TEXT CHECK(cancelled_by_type IS NULL OR cancelled_by_type IN('customer','merchant','admin','system')),
  cancelled_by_id TEXT,
  payment_method_v1 TEXT NOT NULL DEFAULT 'counter' CHECK(payment_method_v1 IN('counter','cash','card','line_pay','easycard_terminal','other')),
  payment_reference TEXT,
  payment_confirmed_at TEXT,
  payment_confirmed_by TEXT,
  preparing_at TEXT,
  ready_at TEXT,
  served_at TEXT,
  admin_override INTEGER NOT NULL DEFAULT 0 CHECK(admin_override IN(0,1)),
  demo_reset_at TEXT,
  line_context_id TEXT,
  accepted_by TEXT,
  completed_by TEXT,
  UNIQUE(merchant_id,membership_id,idempotency_key),
  UNIQUE(merchant_id,id),
  FOREIGN KEY(merchant_id,membership_id) REFERENCES merchant_ordering_memberships(merchant_id,id),
  FOREIGN KEY(merchant_id,qr_id) REFERENCES merchant_ordering_qr_codes(merchant_id,id),
  CHECK(total_minor = subtotal_minor),
  CHECK(order_type <> 'dine_in' OR (table_label IS NOT NULL AND length(trim(table_label)) > 0))
);

INSERT INTO merchant_food_orders_guest_v1 (
  id,order_code,merchant_id,membership_id,qr_id,table_label,order_type,status,
  payment_status,payment_method,subtotal_minor,total_minor,customer_note,idempotency_key,
  created_at,updated_at,accepted_at,completed_at,cancelled_at,dining_session_id,
  cancel_reason,cancelled_by_type,cancelled_by_id,payment_method_v1,payment_reference,
  payment_confirmed_at,payment_confirmed_by,preparing_at,ready_at,served_at,admin_override,
  demo_reset_at,line_context_id,accepted_by,completed_by
)
SELECT
  id,order_code,merchant_id,membership_id,qr_id,table_label,order_type,status,
  payment_status,payment_method,subtotal_minor,total_minor,customer_note,idempotency_key,
  created_at,updated_at,accepted_at,completed_at,cancelled_at,dining_session_id,
  cancel_reason,cancelled_by_type,cancelled_by_id,payment_method_v1,payment_reference,
  payment_confirmed_at,payment_confirmed_by,preparing_at,ready_at,served_at,admin_override,
  demo_reset_at,line_context_id,accepted_by,completed_by
FROM merchant_food_orders;

DROP TABLE merchant_food_orders;
ALTER TABLE merchant_food_orders_guest_v1 RENAME TO merchant_food_orders;

CREATE INDEX idx_food_orders_queue ON merchant_food_orders(merchant_id,status,created_at);
CREATE INDEX idx_food_orders_member ON merchant_food_orders(merchant_id,membership_id,created_at);
CREATE INDEX idx_ordering_orders_session ON merchant_food_orders(merchant_id,dining_session_id,created_at);
CREATE INDEX idx_ordering_orders_status ON merchant_food_orders(merchant_id,status,created_at);
CREATE INDEX idx_food_orders_line_context ON merchant_food_orders(merchant_id,line_context_id);
CREATE UNIQUE INDEX uq_food_orders_guest_idempotency
  ON merchant_food_orders(merchant_id,idempotency_key)
  WHERE membership_id IS NULL;

CREATE TRIGGER trg_food_orders_immutable_values
BEFORE UPDATE OF merchant_id,membership_id,qr_id,order_type,table_label,subtotal_minor,total_minor,idempotency_key ON merchant_food_orders
BEGIN
  SELECT RAISE(ABORT, 'submitted order values are immutable');
END;

CREATE TRIGGER trg_ordering_dining_session_merchant
BEFORE INSERT ON merchant_food_orders
WHEN NEW.dining_session_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM merchant_dining_sessions s WHERE s.id=NEW.dining_session_id AND s.merchant_id=NEW.merchant_id AND s.status='open'
) BEGIN SELECT RAISE(ABORT,'DINING_SESSION_MERCHANT_MISMATCH'); END;

CREATE TRIGGER trg_ordering_order_item_merchant
BEFORE INSERT ON merchant_food_order_item_options
WHEN NOT EXISTS(
  SELECT 1 FROM merchant_food_order_items i JOIN merchant_food_orders o ON o.id=i.order_id
  WHERE i.id=NEW.order_item_id AND o.id=NEW.order_id AND o.merchant_id=NEW.merchant_id
) BEGIN SELECT RAISE(ABORT,'ORDER_ITEM_MERCHANT_MISMATCH'); END;

UPDATE merchant_ordering_settings
SET require_member=0,updated_at=CURRENT_TIMESTAMP
WHERE merchant_id='demo_beef_noodle';

PRAGMA foreign_keys=ON;
