-- 承攬夥伴 V1.3：五級獎勵、合作資格維持、三年 VIP 百萬推廣獎勵與新版電子契約。
ALTER TABLE partners ADD COLUMN activated_at TEXT;
ALTER TABLE partners ADD COLUMN terminated_for_inactivity_at TEXT;

-- VIP eligibility is deliberately explicit and independent of the promotional price.
-- Existing financial records remain excluded until an authorized reviewer marks a
-- qualifying, attributable standard-promotion order as eligible.
ALTER TABLE orders ADD COLUMN partner_order_kind TEXT NOT NULL DEFAULT 'other'
  CHECK(partner_order_kind IN ('standard_merchant_promotion','renewal','custom','test','other'));
ALTER TABLE orders ADD COLUMN partner_vip_eligible INTEGER NOT NULL DEFAULT 0
  CHECK(partner_vip_eligible IN (0,1));
ALTER TABLE orders ADD COLUMN partner_vip_eligibility_note TEXT;

CREATE TABLE IF NOT EXISTS partner_monthly_qualifications (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL REFERENCES partners(id),
  month_start TEXT NOT NULL,
  identity_level TEXT NOT NULL,
  required_sales INTEGER NOT NULL,
  actual_sales INTEGER NOT NULL DEFAULT 0,
  next_month_rate REAL NOT NULL DEFAULT 0,
  result TEXT NOT NULL CHECK(result IN ('met','missed','grace')),
  evaluated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(partner_id, month_start)
);

CREATE TABLE IF NOT EXISTS partner_vip_rewards (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL REFERENCES partners(id),
  cycle_no INTEGER NOT NULL,
  cycle_start TEXT NOT NULL,
  cycle_end TEXT NOT NULL,
  valid_new_merchants INTEGER NOT NULL DEFAULT 0,
  target_merchants INTEGER NOT NULL DEFAULT 1000,
  reward_amount REAL NOT NULL DEFAULT 1000000,
  status TEXT NOT NULL DEFAULT 'tracking' CHECK(status IN ('tracking','pending_review','approved','paid','cancelled')),
  qualified_at TEXT,
  approved_at TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(partner_id, cycle_no)
);

CREATE INDEX IF NOT EXISTS idx_partner_monthly_qualifications_partner ON partner_monthly_qualifications(partner_id, month_start);
CREATE INDEX IF NOT EXISTS idx_partner_vip_rewards_partner ON partner_vip_rewards(partner_id, cycle_no, status);
CREATE INDEX IF NOT EXISTS idx_orders_partner_vip_eligible ON orders(partner_id, partner_vip_eligible, payment_status);

UPDATE partners
SET activated_at = COALESCE(activated_at, contract_signed_at, approved_at, created_at)
WHERE status IN ('active','suspended','terminated') AND activated_at IS NULL;

UPDATE contract_versions SET is_active = 0 WHERE is_active = 1;
INSERT OR IGNORE INTO contract_versions (
  id, version, title, content_html, content_hash, effective_date, is_active, requires_resign, legal_review_required
) VALUES (
  'contract_v1_3',
  'v1.3',
  '創百業智慧鏈承攬夥伴合作契約（法律審閱草稿）',
  '<h1>創百業智慧鏈｜承攬夥伴合作契約 v1.3</h1><p>甲方：陳靈有限公司；乙方：線上申請並經核准之承攬夥伴。</p><h2>一、合作性質</h2><p>雙方為獨立承攬／居間合作關係，非僱傭關係。乙方自行安排合作時間、地點及開發方式，甲方不設打卡、固定工時、排班或每日出勤管理。本契約所定合作資格維持條件，係成果型合作資格與獎勵級距之約定。</p><h2>二、有效成交與分級獎勵</h2><p>有效成交係指經系統正確歸因予乙方之新商家，完成當期標準商家行銷推廣方案全額付款，且交易未取消、未退款、非重複、虛假或拆單案件。現行商家方案原價 NT$30,000，現階段響應政府推動 AI 應用及產業數位轉型政策，由甲方自行提供推廣促銷價 NT$18,000；此為甲方自主促銷，非政府補助、核准或保證。標準規格網站基礎建置為方案免費附贈項目，建置費 NT$0；超出標準規格之新增頁面、設計、功能、第三方 API／系統串接或客製需求，另行報價。</p><p>歷史累計有效成交 1～10 件：每件 NT$1,000；11～30 件：每件 NT$1,500；31～70 件：每件 NT$2,000；71～120 件：每件 NT$2,500；121 件以上：每件 NT$3,000。升級採非追溯式，自下一筆有效成交起適用新級距。</p><h2>三、合作資格維持條件</h2><p>初階承攬夥伴每月最低有效成交 1 件；進階 1 件；中階 2 件；高階 3 件；資深 4 件。歷史累計成交決定承攬夥伴身份等級；前一完整曆月是否符合該身份等級之合作資格維持條件，決定次月單件獎勵適用級距。</p><p>進階以上承攬夥伴如前一完整曆月未達最低有效成交件數，次月單件獎勵暫降一階；其歷史身份等級不變。次月重新達成原身份等級之最低件數後，自再下一月恢復原獎勵級距。</p><p>初階承攬夥伴自帳號啟用後第一個完整曆月起計算；如連續兩個完整曆月均未達每月至少 1 件有效成交，雙方承攬合作關係於第二個未達標月份結束後之次月終止，甲方得關閉承攬夥伴中心及推廣權限。終止前已成立之有效報酬仍依約結算。</p><h2>四、VIP 百萬推廣大獎</h2><p>自乙方帳號正式啟用日起，每三年為一個獨立獎勵週期。乙方於單一三年週期內累計達 1,000 家有效新商家，經甲方完成付款、退款、重複案件及歸因查核後，可獲該週期一次性 VIP 推廣大獎 NT$1,000,000（稅前）。每一週期最多領取一次，下一週期件數重新自 0 計算。</p><p>商家續約、第三年起平台上架費、網域費、後台／網站維持費、同一商家重複付款或其他非新商家交易，不計入 1,000 家門檻。獎金依法辦理扣繳與申報。</p><h2>五、退款、撤銷與扣回</h2><p>商家交易因取消、退款、刷退或其他原因全部或部分失效時，失效案件不計入有效成交及 VIP 件數；已建立或已發放之獎勵，甲方得依實際失效情形調整、沖回，或自後續應付報酬中扣抵，並保留系統稽核紀錄。</p><h2>六、商業規範</h2><p>乙方應保密甲方及商家非公開資訊，不得私下收取甲方服務款項、飛單、偽造推薦、拆單湊件、重複申請、虛假交易、不實宣稱政府補助或保證，亦不得承諾未經甲方核准之價格、功能、折扣或服務。</p><h2>七、終止與既有案件</h2><p>除本契約另有約定外，任一方得依約終止合作。合作終止前已於系統正式建立且可查驗之推薦名單，如於終止日起 30 日內完成有效成交，得依歸因與契約規則認列；終止後新建立之名單不再享有推廣權益。</p><h2>八、電子簽署與法律審閱</h2><p>乙方同意使用電子方式簽署；系統得保存契約版本、簽署時間、手寫電子簽名、IP／裝置資訊、內容雜湊、簽名雜湊及已簽 PDF 作為查驗紀錄。</p><p><strong>LEGAL_REVIEW_REQUIRED：本版本為系統法律審閱草稿，正式大規模使用前應由台灣執業律師依實際合作流程完成最終法律審閱。若依法應適用強制性法令，仍依該法令辦理。</strong></p>',
  'yzhu-RpN0LNxzSO5FPv_I2XIECTPfejqa6uVrb6dD94',
  '2026-08-23',
  1,
  1,
  1
);
