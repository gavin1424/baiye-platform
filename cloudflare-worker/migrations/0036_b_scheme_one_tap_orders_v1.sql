PRAGMA foreign_keys=ON;

ALTER TABLE merchant_food_orders ADD COLUMN accepted_by TEXT;
ALTER TABLE merchant_food_orders ADD COLUMN completed_by TEXT;

-- The official beef-noodle merchant uses Dining Spirit B mode. Other merchants
-- retain their existing choice and can toggle the canonical setting normally.
UPDATE merchant_ordering_settings
SET auto_accept_orders=1,updated_at=CURRENT_TIMESTAMP
WHERE merchant_id='demo_beef_noodle';
