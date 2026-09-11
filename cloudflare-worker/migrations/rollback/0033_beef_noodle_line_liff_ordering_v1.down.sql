DROP INDEX IF EXISTS idx_merchant_line_friendships_status;
DROP TABLE IF EXISTS merchant_line_friendships;
-- SQLite production rollbacks keep the nullable integration columns in place.
-- Disable the unfinished integration so existing branded ordering URLs remain safe.
UPDATE merchant_line_integrations
SET enabled=0,integration_mode='add_friend_link',updated_at=CURRENT_TIMESTAMP
WHERE merchant_id='demo_beef_noodle';
