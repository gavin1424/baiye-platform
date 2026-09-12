DROP INDEX IF EXISTS idx_food_orders_line_context;
DROP INDEX IF EXISTS idx_line_ordering_sessions_active;
DROP TABLE IF EXISTS merchant_line_ordering_sessions;

-- SQLite cannot safely drop this additive compatibility column on older
-- Production runtimes. line_context_id remains nullable and unused after rollback.
