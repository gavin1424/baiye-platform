ALTER TABLE merchant_users ADD COLUMN password_algorithm TEXT NOT NULL DEFAULT 'pbkdf2-sha256';
ALTER TABLE merchant_password_reset_tokens ADD COLUMN pending_password_hash TEXT;
ALTER TABLE merchant_password_reset_tokens ADD COLUMN pending_password_salt TEXT;
ALTER TABLE merchant_password_reset_tokens ADD COLUMN pending_password_iterations INTEGER;
ALTER TABLE merchant_password_reset_tokens ADD COLUMN pending_password_algorithm TEXT;

CREATE TABLE merchant_auth_rate_limits(
  scope TEXT NOT NULL,
  rate_key_hash TEXT NOT NULL,
  bucket_start TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(scope,rate_key_hash,bucket_start)
);

CREATE TRIGGER trg_password_reset_consume
AFTER UPDATE OF used_at ON merchant_password_reset_tokens
WHEN OLD.used_at IS NULL AND NEW.used_at IS NOT NULL
BEGIN
  UPDATE merchant_users
     SET password_hash=NEW.pending_password_hash,
         password_salt=NEW.pending_password_salt,
         password_iterations=NEW.pending_password_iterations,
         password_algorithm=NEW.pending_password_algorithm,
         updated_at=CURRENT_TIMESTAMP
   WHERE id=NEW.user_id AND merchant_id=NEW.merchant_id;
  UPDATE merchant_user_sessions
     SET revoked_at=CURRENT_TIMESTAMP
   WHERE user_id=NEW.user_id AND merchant_id=NEW.merchant_id AND revoked_at IS NULL;
END;

CREATE TRIGGER trg_stock_reservation_validate
BEFORE INSERT ON commerce_stock_reservations
WHEN NEW.status='active' AND COALESCE((
  SELECT on_hand-reserved
    FROM commerce_inventory_items
   WHERE id=NEW.inventory_item_id AND merchant_id=NEW.merchant_id
),-1)<NEW.quantity
BEGIN
  SELECT RAISE(ABORT,'INSUFFICIENT_STOCK');
END;

CREATE TRIGGER trg_stock_reservation_hold
AFTER INSERT ON commerce_stock_reservations
WHEN NEW.status='active'
BEGIN
  UPDATE commerce_inventory_items
     SET reserved=reserved+NEW.quantity,updated_at=CURRENT_TIMESTAMP
   WHERE id=NEW.inventory_item_id AND merchant_id=NEW.merchant_id;
END;

CREATE TRIGGER trg_stock_reservation_release
AFTER UPDATE OF status ON commerce_stock_reservations
WHEN OLD.status='active' AND NEW.status IN('released','expired')
BEGIN
  UPDATE commerce_inventory_items
     SET reserved=reserved-OLD.quantity,updated_at=CURRENT_TIMESTAMP
   WHERE id=OLD.inventory_item_id AND merchant_id=OLD.merchant_id;
END;

CREATE TRIGGER trg_stock_reservation_consume
AFTER UPDATE OF status ON commerce_stock_reservations
WHEN OLD.status='active' AND NEW.status='consumed'
BEGIN
  UPDATE commerce_inventory_items
     SET reserved=reserved-OLD.quantity,on_hand=on_hand-OLD.quantity,updated_at=CURRENT_TIMESTAMP
   WHERE id=OLD.inventory_item_id AND merchant_id=OLD.merchant_id;
END;

CREATE TRIGGER trg_stock_reservation_immutable
BEFORE UPDATE ON commerce_stock_reservations
WHEN NEW.quantity<>OLD.quantity OR NEW.inventory_item_id<>OLD.inventory_item_id OR NEW.merchant_id<>OLD.merchant_id
BEGIN SELECT RAISE(ABORT,'stock reservation immutable'); END;

CREATE INDEX idx_auth_rate_limits_bucket ON merchant_auth_rate_limits(bucket_start,last_attempt_at);
CREATE INDEX idx_password_resets_active ON merchant_password_reset_tokens(token_hash,expires_at,used_at);
