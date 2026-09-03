-- Stable, merchant-scoped general ordering entry. Existing A1/A2/takeaway QR rows are untouched.
INSERT OR IGNORE INTO merchant_ordering_qr_codes
  (id, merchant_id, code, label, purpose, table_label, active, expires_at, created_at, updated_at)
SELECT
  'bn_qr_general',
  'demo_beef_noodle',
  'TlTgDC3Wh5xo61yT1WWbPnJK9GZt_o4y',
  '線上點餐',
  'member_order',
  NULL,
  1,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM merchant_ordering_settings
WHERE merchant_id = 'demo_beef_noodle';
