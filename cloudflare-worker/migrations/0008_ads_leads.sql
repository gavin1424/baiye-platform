CREATE TABLE IF NOT EXISTS ads_leads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  shop_name TEXT,
  phone TEXT NOT NULL,
  line_id TEXT,
  email TEXT,
  industry TEXT NOT NULL,
  has_website TEXT,
  has_ordering TEXT,
  interests TEXT,
  attribution TEXT NOT NULL DEFAULT '{}',
  page TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ads_leads_created ON ads_leads(created_at);
