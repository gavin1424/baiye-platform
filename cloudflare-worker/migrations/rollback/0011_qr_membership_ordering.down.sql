PRAGMA foreign_keys = OFF;

DROP TRIGGER IF EXISTS trg_food_order_items_no_delete;
DROP TRIGGER IF EXISTS trg_food_order_items_no_update;
DROP TRIGGER IF EXISTS trg_food_orders_immutable_values;
DROP TABLE IF EXISTS merchant_ordering_audit_logs;
DROP TABLE IF EXISTS merchant_food_order_items;
DROP TABLE IF EXISTS merchant_food_orders;
DROP TABLE IF EXISTS merchant_menu_items;
DROP TABLE IF EXISTS merchant_menu_categories;
DROP TABLE IF EXISTS merchant_member_sessions;
DROP TABLE IF EXISTS merchant_memberships;
DROP TABLE IF EXISTS ordering_customers;
DROP TABLE IF EXISTS merchant_ordering_qr_codes;
DROP TABLE IF EXISTS merchant_ordering_settings;

PRAGMA foreign_keys = ON;
