-- Rollback is intentionally schema-only and must only be used when no
-- self-service merchant onboarding records or signed merchant contracts exist.
DROP TRIGGER IF EXISTS trg_merchant_standard_terms_preset_no_delete;
DROP TRIGGER IF EXISTS trg_merchant_standard_terms_preset_immutable;
DROP INDEX IF EXISTS idx_merchant_onboarding_operation_gate;
DROP TABLE IF EXISTS merchant_onboarding_states;
DROP TABLE IF EXISTS merchant_commercial_terms_presets;
-- SQLite cannot safely drop the two additive columns without a table rebuild.
-- Keep them inert on rollback; never rebuild merchant contract tables containing data.
