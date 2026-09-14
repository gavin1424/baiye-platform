CREATE TABLE IF NOT EXISTS merchant_order_receipt_sequences (
  merchant_id TEXT NOT NULL,
  business_date TEXT NOT NULL,
  last_value INTEGER NOT NULL DEFAULT 0 CHECK (last_value >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (merchant_id, business_date),
  FOREIGN KEY (merchant_id) REFERENCES merchants(id)
);

ALTER TABLE merchant_food_orders ADD COLUMN receipt_number INTEGER;
ALTER TABLE merchant_food_orders ADD COLUMN receipt_business_date TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_merchant_food_orders_receipt_number
  ON merchant_food_orders(merchant_id, receipt_business_date, receipt_number)
  WHERE receipt_number IS NOT NULL AND receipt_business_date IS NOT NULL;
