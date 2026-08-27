PRAGMA foreign_keys=OFF;

DROP TRIGGER IF EXISTS trg_ordering_order_item_merchant;
DROP TRIGGER IF EXISTS trg_ordering_daily_limit_guard;
DROP TRIGGER IF EXISTS trg_ordering_daily_limit_increment;
DROP TRIGGER IF EXISTS trg_ordering_option_value_group_merchant;
DROP TRIGGER IF EXISTS trg_ordering_dining_session_merchant;
DROP TRIGGER IF EXISTS trg_ordering_item_option_immutable_delete;
DROP TRIGGER IF EXISTS trg_ordering_item_option_immutable_update;

DROP INDEX IF EXISTS idx_merchant_ordering_sessions;
DROP INDEX IF EXISTS idx_ordering_rate_limit_bucket;
DROP INDEX IF EXISTS idx_ordering_orders_status;
DROP INDEX IF EXISTS idx_ordering_orders_session;
DROP INDEX IF EXISTS idx_ordering_order_options;
DROP INDEX IF EXISTS idx_ordering_item_groups;
DROP INDEX IF EXISTS idx_ordering_options_group;
DROP INDEX IF EXISTS idx_ordering_sessions_table;
DROP INDEX IF EXISTS uq_ordering_open_table_session;

DROP TABLE IF EXISTS merchant_auth_rate_limits;
DROP TABLE IF EXISTS merchant_security_events;
DROP TABLE IF EXISTS merchant_user_roles;
DROP TABLE IF EXISTS merchant_role_permissions;
DROP TABLE IF EXISTS merchant_permissions;
DROP TABLE IF EXISTS merchant_roles;
DROP TABLE IF EXISTS merchant_user_sessions;
DROP TABLE IF EXISTS merchant_users;
DROP TABLE IF EXISTS ordering_rate_limits;
DROP TABLE IF EXISTS merchant_order_payment_events;
DROP TABLE IF EXISTS merchant_food_order_item_options;
DROP TABLE IF EXISTS merchant_dining_sessions;
DROP TABLE IF EXISTS merchant_menu_item_option_groups;
DROP TABLE IF EXISTS merchant_menu_option_values;
DROP TABLE IF EXISTS merchant_menu_option_groups;

-- SQLite cannot safely DROP COLUMN across every D1 compatibility target.
-- The rollback removes new relational data and access-control tables while
-- preserving additive nullable/defaulted columns and all historical orders.
PRAGMA foreign_keys=ON;
