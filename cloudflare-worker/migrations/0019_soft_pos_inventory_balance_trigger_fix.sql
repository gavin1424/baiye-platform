-- Forward repair for environments that applied the initial 0018 trigger.
-- Ledger rows are immutable; only the derived balance projection expression is
-- corrected.  No historical sales, payments, or inventory transactions change.
DROP TRIGGER IF EXISTS trg_inventory_balance_apply;
CREATE TRIGGER trg_inventory_balance_apply AFTER INSERT ON inventory_transactions BEGIN
 UPDATE inventory_balances SET quantity_minor=quantity_minor+NEW.quantity_delta_minor,updated_at=CURRENT_TIMESTAMP
   WHERE merchant_id=NEW.merchant_id AND location_id=NEW.location_id AND inventory_item_id=NEW.inventory_item_id;
 INSERT INTO inventory_balances(merchant_id,location_id,inventory_item_id,quantity_minor,updated_at)
 SELECT NEW.merchant_id,NEW.location_id,NEW.inventory_item_id,NEW.quantity_delta_minor,CURRENT_TIMESTAMP
 WHERE NOT EXISTS(SELECT 1 FROM inventory_balances WHERE merchant_id=NEW.merchant_id AND location_id=NEW.location_id AND inventory_item_id=NEW.inventory_item_id);
END;
