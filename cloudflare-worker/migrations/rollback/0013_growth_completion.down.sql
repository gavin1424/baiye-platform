-- SQLite cannot safely DROP COLUMN on all deployed compatibility versions.
-- Rollback disables every growth integration and retains the audit columns.
UPDATE merchant_coupon_campaigns SET enabled=0,production_ready=0;
UPDATE merchant_payment_integrations SET enabled=0,production_ready=0,provider_status='disabled';
UPDATE merchant_delivery_links SET enabled=0,production_ready=0;
UPDATE financing_partners SET active=0,production_ready=0;
DROP TABLE IF EXISTS merchant_integration_operations;
