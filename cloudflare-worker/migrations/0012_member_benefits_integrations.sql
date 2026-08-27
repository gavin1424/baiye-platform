PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS merchant_coupon_campaigns (
 id TEXT PRIMARY KEY, merchant_id TEXT NOT NULL REFERENCES merchant_ordering_settings(merchant_id), name TEXT NOT NULL,
 campaign_type TEXT NOT NULL DEFAULT 'welcome_member' CHECK(campaign_type='welcome_member'),
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN(0,1)), production_ready INTEGER NOT NULL DEFAULT 0 CHECK(production_ready IN(0,1)),
 discount_type TEXT NOT NULL DEFAULT 'fixed_amount' CHECK(discount_type='fixed_amount'),
 discount_value_minor INTEGER NOT NULL DEFAULT 10000 CHECK(discount_value_minor=10000),
 minimum_spend_minor INTEGER NOT NULL DEFAULT 0 CHECK(minimum_spend_minor>=0), valid_days INTEGER NOT NULL DEFAULT 30 CHECK(valid_days BETWEEN 1 AND 365),
 starts_at TEXT, ends_at TEXT, redemption_channel TEXT NOT NULL DEFAULT 'ordering' CHECK(redemption_channel='ordering'),
 phone_verification_required INTEGER NOT NULL DEFAULT 0 CHECK(phone_verification_required IN(0,1)),
 restore_on_unpaid_cancel INTEGER NOT NULL DEFAULT 1 CHECK(restore_on_unpaid_cancel IN(0,1)),
 stackable INTEGER NOT NULL DEFAULT 0 CHECK(stackable=0), funding_source TEXT NOT NULL DEFAULT 'merchant' CHECK(funding_source='merchant'),
 terms_version TEXT NOT NULL DEFAULT 'DRAFT_FOR_LEGAL_REVIEW', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(merchant_id,campaign_type)
);
CREATE TABLE IF NOT EXISTS merchant_member_coupons (
 id TEXT PRIMARY KEY, merchant_id TEXT NOT NULL, membership_id TEXT NOT NULL, campaign_id TEXT NOT NULL REFERENCES merchant_coupon_campaigns(id),
 status TEXT NOT NULL CHECK(status IN('pending_verification','active','reserved','redeemed','expired','revoked')),
 issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, activates_at TEXT, expires_at TEXT NOT NULL, reserved_order_id TEXT REFERENCES merchant_food_orders(id),
 reserved_at TEXT, redeemed_order_id TEXT REFERENCES merchant_food_orders(id), redeemed_at TEXT, revoked_at TEXT, revoked_reason TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(merchant_id,membership_id,campaign_id), UNIQUE(merchant_id,id),
 FOREIGN KEY(merchant_id,membership_id) REFERENCES merchant_memberships(merchant_id,id)
);
CREATE TABLE IF NOT EXISTS merchant_coupon_redemptions (
 id TEXT PRIMARY KEY, merchant_id TEXT NOT NULL, coupon_id TEXT NOT NULL REFERENCES merchant_member_coupons(id), membership_id TEXT NOT NULL,
 order_id TEXT REFERENCES merchant_food_orders(id), action TEXT NOT NULL CHECK(action IN('issued','activated','reserved','released','redeemed','expired','revoked')),
 amount_minor INTEGER NOT NULL DEFAULT 0 CHECK(amount_minor>=0), idempotency_key TEXT NOT NULL, actor_type TEXT NOT NULL CHECK(actor_type IN('customer','admin','system')),
 actor_id TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(merchant_id,idempotency_key)
);
CREATE TABLE IF NOT EXISTS merchant_order_pricing (
 order_id TEXT PRIMARY KEY REFERENCES merchant_food_orders(id), merchant_id TEXT NOT NULL, gross_subtotal_minor INTEGER NOT NULL CHECK(gross_subtotal_minor>=0),
 coupon_discount_minor INTEGER NOT NULL DEFAULT 0 CHECK(coupon_discount_minor>=0), payable_total_minor INTEGER NOT NULL CHECK(payable_total_minor>=0),
 coupon_id TEXT REFERENCES merchant_member_coupons(id), merchant_funded_minor INTEGER NOT NULL DEFAULT 0 CHECK(merchant_funded_minor>=0),
 platform_funded_minor INTEGER NOT NULL DEFAULT 0 CHECK(platform_funded_minor=0), calculation_version TEXT NOT NULL DEFAULT 'coupon-v1',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, CHECK(payable_total_minor=max(gross_subtotal_minor-coupon_discount_minor,0)),
 CHECK(merchant_funded_minor=coupon_discount_minor)
);
CREATE TABLE IF NOT EXISTS merchant_payment_integrations (
 id TEXT PRIMARY KEY, merchant_id TEXT NOT NULL REFERENCES merchant_ordering_settings(merchant_id), provider TEXT NOT NULL CHECK(provider IN('easywallet','easycard')),
 mode TEXT NOT NULL CHECK(mode IN('easywallet_qr_manual','easywallet_api','easycard_terminal_counter')), enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN(0,1)),
 production_ready INTEGER NOT NULL DEFAULT 0 CHECK(production_ready IN(0,1)),
 provider_status TEXT NOT NULL DEFAULT 'disabled' CHECK(provider_status IN('disabled','application_pending','approved','staging','active','suspended','rejected')),
 merchant_account_reference TEXT, display_name TEXT NOT NULL, official_qr_asset_key TEXT, official_payment_url TEXT,
 legal_review_status TEXT NOT NULL DEFAULT 'pending', technical_review_status TEXT NOT NULL DEFAULT 'pending', effective_from TEXT, effective_to TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(merchant_id,provider,mode)
);
CREATE TABLE IF NOT EXISTS merchant_order_payment_intents (
 id TEXT PRIMARY KEY, merchant_id TEXT NOT NULL, order_id TEXT NOT NULL REFERENCES merchant_food_orders(id), provider TEXT NOT NULL CHECK(provider IN('easywallet','easycard')),
 mode TEXT NOT NULL CHECK(mode IN('easywallet_qr_manual','easywallet_api','easycard_terminal_counter')), amount_minor INTEGER NOT NULL CHECK(amount_minor>=0),
 currency TEXT NOT NULL DEFAULT 'TWD', status TEXT NOT NULL CHECK(status IN('created','pending_customer_payment','pending_merchant_confirmation','confirmed','failed','cancelled','refunded')),
 provider_reference TEXT, merchant_confirmation_reference TEXT, idempotency_key TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 confirmed_at TEXT, failed_at TEXT, cancelled_at TEXT, refunded_at TEXT, UNIQUE(merchant_id,order_id,idempotency_key)
);
CREATE TABLE IF NOT EXISTS merchant_delivery_links (
 id TEXT PRIMARY KEY, merchant_id TEXT NOT NULL REFERENCES merchant_ordering_settings(merchant_id),
 provider TEXT NOT NULL CHECK(provider IN('uber_eats','foodpanda','uber_direct','line','custom')), display_name TEXT NOT NULL, order_url TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN(0,1)), production_ready INTEGER NOT NULL DEFAULT 0 CHECK(production_ready IN(0,1)),
 verified_status TEXT NOT NULL DEFAULT 'pending' CHECK(verified_status IN('pending','verified','rejected')),
 coupon_supported INTEGER NOT NULL DEFAULT 0 CHECK(coupon_supported=0), sort_order INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS merchant_delivery_clicks (
 id TEXT PRIMARY KEY, merchant_id TEXT NOT NULL, delivery_link_id TEXT NOT NULL REFERENCES merchant_delivery_links(id),
 membership_id TEXT, qr_id TEXT, clicked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, referrer_context TEXT
);
CREATE TABLE IF NOT EXISTS financing_partners (
 id TEXT PRIMARY KEY, legal_name TEXT NOT NULL, brand_name TEXT NOT NULL, tax_id TEXT NOT NULL,
 institution_type TEXT NOT NULL CHECK(institution_type IN('bank','finance_leasing','licensed_financial_service')),
 regulator TEXT NOT NULL, license_reference TEXT NOT NULL, official_domain TEXT NOT NULL, privacy_policy_url TEXT NOT NULL, terms_url TEXT NOT NULL,
 verified_status TEXT NOT NULL DEFAULT 'pending' CHECK(verified_status IN('pending','verified','rejected')),
 legal_review_status TEXT NOT NULL DEFAULT 'pending' CHECK(legal_review_status IN('pending','approved','rejected')),
 active INTEGER NOT NULL DEFAULT 0 CHECK(active IN(0,1)), production_ready INTEGER NOT NULL DEFAULT 0 CHECK(production_ready IN(0,1)),
 verified_at TEXT, review_expires_at TEXT, sponsored INTEGER NOT NULL DEFAULT 0 CHECK(sponsored IN(0,1)), sort_order INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS financing_products (
 id TEXT PRIMARY KEY, partner_id TEXT NOT NULL REFERENCES financing_partners(id), name TEXT NOT NULL, borrower_type TEXT NOT NULL, purpose TEXT NOT NULL,
 amount_min_minor INTEGER, amount_max_minor INTEGER, interest_rate_min REAL, interest_rate_max REAL, apr_min REAL, apr_max REAL,
 term_min_months INTEGER, term_max_months INTEGER, fees_description TEXT, collateral_description TEXT, eligibility_description TEXT,
 official_application_url TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 0 CHECK(active IN(0,1)), verified_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS financing_referral_consents (
 id TEXT PRIMARY KEY, consent_version TEXT NOT NULL, partner_id TEXT NOT NULL REFERENCES financing_partners(id), data_categories_json TEXT NOT NULL,
 purpose TEXT NOT NULL, retention_days INTEGER NOT NULL DEFAULT 180 CHECK(retention_days BETWEEN 1 AND 365), consented_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 ip_hash TEXT, user_agent_hash TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS financing_referral_leads (
 id TEXT PRIMARY KEY, partner_id TEXT NOT NULL REFERENCES financing_partners(id), merchant_name TEXT NOT NULL, contact_name_encrypted TEXT NOT NULL,
 phone_encrypted TEXT NOT NULL, email_encrypted TEXT NOT NULL, phone_hash TEXT NOT NULL, requested_amount_range TEXT NOT NULL, funding_purpose TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN('submitted','reviewed','referred','contacted','closed','rejected','deleted')),
 consent_id TEXT NOT NULL REFERENCES financing_referral_consents(id), source_page TEXT NOT NULL, idempotency_key TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, contacted_at TEXT, closed_at TEXT, deleted_at TEXT, UNIQUE(partner_id,idempotency_key)
);
CREATE TABLE IF NOT EXISTS financing_audit_logs (
 id TEXT PRIMARY KEY, actor_type TEXT NOT NULL, actor_id TEXT, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT,
 metadata TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS financing_outbound_clicks (
 id TEXT PRIMARY KEY, partner_id TEXT NOT NULL REFERENCES financing_partners(id), product_id TEXT REFERENCES financing_products(id),
 clicked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, referrer_context TEXT
);
CREATE INDEX IF NOT EXISTS idx_member_coupons_lookup ON merchant_member_coupons(merchant_id,membership_id,status,expires_at);
CREATE INDEX IF NOT EXISTS idx_payment_intents_admin ON merchant_order_payment_intents(merchant_id,status,created_at);
CREATE INDEX IF NOT EXISTS idx_delivery_links_public ON merchant_delivery_links(merchant_id,enabled,verified_status,sort_order);
CREATE INDEX IF NOT EXISTS idx_financing_public ON financing_partners(active,verified_status,legal_review_status,review_expires_at);
CREATE INDEX IF NOT EXISTS idx_financing_leads_admin ON financing_referral_leads(partner_id,status,created_at);
CREATE TRIGGER IF NOT EXISTS trg_order_pricing_no_update BEFORE UPDATE ON merchant_order_pricing BEGIN SELECT RAISE(ABORT,'order pricing is immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_order_pricing_no_delete BEFORE DELETE ON merchant_order_pricing BEGIN SELECT RAISE(ABORT,'order pricing is immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_order_pricing_coupon_reservation BEFORE INSERT ON merchant_order_pricing
WHEN NEW.coupon_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM merchant_member_coupons c WHERE c.id=NEW.coupon_id AND c.merchant_id=NEW.merchant_id AND c.status='reserved' AND c.reserved_order_id=NEW.order_id)
BEGIN SELECT RAISE(ABORT,'coupon reservation mismatch'); END;
