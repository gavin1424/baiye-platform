DROP INDEX IF EXISTS idx_password_resets_active;
DROP INDEX IF EXISTS idx_auth_rate_limits_bucket;
DROP TRIGGER IF EXISTS trg_stock_reservation_immutable;
DROP TRIGGER IF EXISTS trg_stock_reservation_consume;
DROP TRIGGER IF EXISTS trg_stock_reservation_release;
DROP TRIGGER IF EXISTS trg_stock_reservation_hold;
DROP TRIGGER IF EXISTS trg_stock_reservation_validate;
DROP TRIGGER IF EXISTS trg_password_reset_consume;
DROP TABLE IF EXISTS merchant_auth_rate_limits;
-- SQLite cannot safely drop the added columns without rebuilding tables.
-- Forward recovery keeps nullable reset metadata and password_algorithm in place.
