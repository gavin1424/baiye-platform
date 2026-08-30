-- Partner contractor identity and three-month contract term V1.
-- Existing signed contracts and private artifacts remain immutable.

ALTER TABLE partners ADD COLUMN id_number_encrypted TEXT;
ALTER TABLE partners ADD COLUMN id_number_hash TEXT;
ALTER TABLE partners ADD COLUMN id_number_last4 TEXT;
ALTER TABLE partners ADD COLUMN identity_completion_required INTEGER NOT NULL DEFAULT 1 CHECK(identity_completion_required IN (0,1));

CREATE UNIQUE INDEX IF NOT EXISTS idx_partners_id_number_hash_unique
  ON partners(id_number_hash) WHERE id_number_hash IS NOT NULL;

ALTER TABLE contract_versions ADD COLUMN contract_term_months INTEGER CHECK(contract_term_months IS NULL OR contract_term_months > 0);
ALTER TABLE contract_versions ADD COLUMN staging_signing_enabled INTEGER NOT NULL DEFAULT 0 CHECK(staging_signing_enabled IN (0,1));

ALTER TABLE contract_signatures ADD COLUMN contract_term_months INTEGER;
ALTER TABLE contract_signatures ADD COLUMN contract_period_start TEXT;
ALTER TABLE contract_signatures ADD COLUMN contract_period_end TEXT;
ALTER TABLE contract_signatures ADD COLUMN id_number_hash TEXT;
ALTER TABLE contract_signatures ADD COLUMN id_number_last4 TEXT;

CREATE TABLE IF NOT EXISTS partner_contract_periods (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL REFERENCES partners(id),
  contract_signature_id TEXT NOT NULL UNIQUE REFERENCES contract_signatures(id),
  contract_version_id TEXT NOT NULL REFERENCES contract_versions(id),
  contract_term_months INTEGER NOT NULL DEFAULT 3 CHECK(contract_term_months = 3),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Taipei' CHECK(timezone = 'Asia/Taipei'),
  renewal_status TEXT NOT NULL DEFAULT 'active'
    CHECK(renewal_status IN ('active','expiring','renewal_required','renewed','expired','terminated')),
  renewed_by_period_id TEXT REFERENCES partner_contract_periods(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(period_end >= period_start),
  UNIQUE(partner_id,contract_version_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_contract_periods_partner_end
  ON partner_contract_periods(partner_id,period_end,renewal_status);

CREATE TRIGGER IF NOT EXISTS trg_partner_identity_immutable
BEFORE UPDATE OF id_number_encrypted,id_number_hash,id_number_last4 ON partners
WHEN OLD.id_number_hash IS NOT NULL
BEGIN SELECT RAISE(ABORT,'PARTNER_IDENTITY_IMMUTABLE'); END;

CREATE TRIGGER IF NOT EXISTS trg_partner_contract_period_core_immutable
BEFORE UPDATE OF partner_id,contract_signature_id,contract_version_id,contract_term_months,period_start,period_end,timezone ON partner_contract_periods
BEGIN SELECT RAISE(ABORT,'PARTNER_CONTRACT_PERIOD_IMMUTABLE'); END;

CREATE TRIGGER IF NOT EXISTS trg_partner_contract_period_delete
BEFORE DELETE ON partner_contract_periods
BEGIN SELECT RAISE(ABORT,'PARTNER_CONTRACT_PERIOD_IMMUTABLE'); END;

CREATE TRIGGER IF NOT EXISTS trg_partner_contract_version_signed_content_immutable
BEFORE UPDATE OF content_html,content_hash ON contract_versions
WHEN EXISTS (SELECT 1 FROM contract_signatures WHERE contract_version_id=OLD.id)
BEGIN SELECT RAISE(ABORT,'SIGNED_CONTRACT_VERSION_IMMUTABLE'); END;

CREATE TRIGGER IF NOT EXISTS trg_partner_contract_version_signed_delete
BEFORE DELETE ON contract_versions
WHEN EXISTS (SELECT 1 FROM contract_signatures WHERE contract_version_id=OLD.id)
BEGIN SELECT RAISE(ABORT,'SIGNED_CONTRACT_VERSION_IMMUTABLE'); END;

INSERT OR IGNORE INTO contract_versions (
  id,version,title,content_html,content_hash,effective_date,is_active,requires_resign,
  legal_review_required,legal_review_status,contract_term_months,staging_signing_enabled
) VALUES (
  'contractor_partner_v1_5','v1.5','創百業智慧鏈｜承攬夥伴合作契約（法律審閱草稿）',
  '<h1>創百業智慧鏈｜承攬夥伴合作契約 v1.5</h1><p><strong>STAGING / DRAFT FOR LEGAL REVIEW</strong></p><h2>一、契約雙方與合作性質</h2><p>甲方為平台正式設定所載法律主體；乙方為經核准之承攬夥伴。本合作屬獨立承攬／居間合作，非僱傭關係，不設打卡、固定工時、排班或固定工作地點。</p><h2>二、合作期間</h2><p>本契約合作期間以三個月為一期，自契約生效日起計算。每一期屆滿後之續約、終止或後續合作方式，依雙方當時有效之契約版本、平台規範及雙方約定辦理。</p><h2>三、有效成交與五級獎勵</h2><p>有效成交須具正確推薦歸因、完成當期標準方案全額付款，且非續約、維護費、重複、取消、退款、虛假、拆單或測試案件。</p><ul><li>初階承攬夥伴：累計有效成交 1～10 件，每件 NT$1,000。</li><li>進階承攬夥伴：累計有效成交 11～30 件，每件 NT$1,500。</li><li>中階承攬夥伴：累計有效成交 31～70 件，每件 NT$2,000。</li><li>高階承攬夥伴：累計有效成交 71～120 件，每件 NT$2,500。</li><li>資深承攬夥伴：累計有效成交 121 件以上，每件 NT$3,000。</li></ul><p>升級非追溯，自下一有效成交適用。</p><h2>四、資格維持與升降級</h2><p>初階、進階每月最低 1 件；中階 2 件；高階 3 件；資深 4 件。高階身份未達最低資格時，次月獎勵降一階但歷史身份不變。初階自啟用後第一個完整曆月起，連續兩個完整曆月 0 件者依契約終止。</p><h2>五、VIP 獎勵</h2><p>每三年為獨立週期；單一週期累計 1,000 家有效新商家，經正式審核後可取得一次性稅前 NT$1,000,000，每週期最多一次且不得跨期累計。</p><h2>六、退款、稅務與禁止行為</h2><p>退款或失效案件之佣金與獎勵依約沖回。稅務依適用法令及乙方實際稅務身分辦理，不硬列固定稅率。乙方不得私收平台服務款、假交易、拆單、不實廣告、未授權承諾或洩漏商業機密。</p><h2>七、個資、歸因、終止與既有案件</h2><p>乙方應依合法目的最小化處理個資；推薦歸因以平台稽核紀錄為準。終止後之既有案件、報酬及資料保存依本契約與法令處理。</p><h2>八、電子形式、正楷簽署與契約版本</h2><p>雙方同意以電子形式完成契約程序。乙方應由本人以正楷清楚簽寫完整姓名。手寫簽名軌跡、明確同意、時間、Session、IP、User-Agent 與雜湊為線上簽署證據，不等同憑證式數位簽章或政府認證；平台不以本系統宣稱辨識本人字跡。條款變更以新版本或補充協議處理，舊文件永久保留。</p><h2>九、準據法與管轄</h2><p>依中華民國法律；管轄條款須於正式法律審閱時確認。</p><p><strong>LEGAL_REVIEW_REQUIRED：未經台灣執業律師審閱及平台授權管理員核准前，不得於 Production 簽署。</strong></p>',
  'f5qNiADjKh3b2KnUZFedD2Z20DUW1nPq4bL4i7KAIC0','2026-08-30',0,1,1,'pending_review',3,1
);
