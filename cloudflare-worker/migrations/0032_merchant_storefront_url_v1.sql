-- Merchant-owned public storefront origin for branded QR ordering links.
-- The opaque QR code remains the sole source of merchant/table identity.
ALTER TABLE merchant_ordering_settings ADD COLUMN storefront_url TEXT;

UPDATE merchant_ordering_settings
SET storefront_url = 'https://baiye-beef-noodle-demo.pages.dev',
    updated_at = CURRENT_TIMESTAMP
WHERE merchant_id = 'demo_beef_noodle'
  AND (storefront_url IS NULL OR trim(storefront_url) = '');
