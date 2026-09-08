PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS service_plan_contract_templates (
  id TEXT PRIMARY KEY,
  contract_type TEXT NOT NULL DEFAULT 'service_plan_agreement' CHECK(contract_type='service_plan_agreement'),
  plan_id TEXT NOT NULL,
  plan_slug TEXT NOT NULL,
  contract_name TEXT NOT NULL,
  contract_version TEXT NOT NULL,
  contract_snapshot TEXT NOT NULL,
  contract_content_hash TEXT NOT NULL,
  plan_details_snapshot TEXT NOT NULL,
  effective_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK(status IN ('draft','pending_review','approved','revoked')),
  legal_review_required INTEGER NOT NULL DEFAULT 1 CHECK(legal_review_required IN (0,1)),
  reviewed_by TEXT,
  reviewed_at TEXT,
  legal_counsel_reference TEXT,
  approved_content_hash TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(plan_id,contract_version),
  UNIQUE(plan_slug,contract_version)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_service_plan_contract
  ON service_plan_contract_templates(plan_id) WHERE is_active=1;

CREATE TABLE IF NOT EXISTS service_plan_contract_signatures (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  contract_template_id TEXT NOT NULL,
  contract_type TEXT NOT NULL CHECK(contract_type='service_plan_agreement'),
  merchant_id TEXT NOT NULL,
  signer_user_id TEXT NOT NULL,
  signer_platform_member_id TEXT,
  legal_name TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  plan_slug TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  plan_price_snapshot TEXT NOT NULL,
  plan_details_snapshot TEXT NOT NULL,
  contract_version TEXT NOT NULL,
  contract_snapshot TEXT NOT NULL,
  contract_content_hash TEXT NOT NULL,
  consent_states_json TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  electronic_signature TEXT NOT NULL,
  signature_hash TEXT NOT NULL,
  signed_at TEXT NOT NULL,
  timezone TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  request_metadata_json TEXT NOT NULL,
  document_hash TEXT NOT NULL,
  pdf_object_key TEXT NOT NULL,
  pdf_hash TEXT NOT NULL,
  evidence_object_key TEXT NOT NULL,
  signature_assurance_level TEXT NOT NULL DEFAULT 'standard_electronic_agreement_evidence',
  status TEXT NOT NULL DEFAULT 'VALID' CHECK(status IN ('VALID','SUPERSEDED','REVOKED')),
  final_confirmed_at TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,contract_template_id),
  FOREIGN KEY(contract_template_id) REFERENCES service_plan_contract_templates(id),
  FOREIGN KEY(merchant_id) REFERENCES merchants(id),
  FOREIGN KEY(merchant_id,signer_user_id) REFERENCES merchant_users(merchant_id,id)
);

CREATE TABLE IF NOT EXISTS service_plan_contract_artifacts (
  id TEXT PRIMARY KEY,
  signature_id TEXT NOT NULL,
  merchant_id TEXT NOT NULL,
  artifact_type TEXT NOT NULL CHECK(artifact_type IN ('signed_pdf','evidence_json')),
  object_key TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL,
  content_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(signature_id,artifact_type),
  FOREIGN KEY(signature_id) REFERENCES service_plan_contract_signatures(id),
  FOREIGN KEY(merchant_id) REFERENCES merchants(id)
);

CREATE TABLE IF NOT EXISTS service_plan_contract_events (
  id TEXT PRIMARY KEY,
  contract_template_id TEXT NOT NULL,
  signature_id TEXT,
  merchant_id TEXT,
  actor_type TEXT NOT NULL CHECK(actor_type IN ('visitor','merchant','admin','system')),
  actor_id TEXT,
  action TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(contract_template_id) REFERENCES service_plan_contract_templates(id),
  FOREIGN KEY(signature_id) REFERENCES service_plan_contract_signatures(id),
  FOREIGN KEY(merchant_id) REFERENCES merchants(id)
);

CREATE INDEX IF NOT EXISTS idx_service_plan_signatures_owner
  ON service_plan_contract_signatures(merchant_id,signed_at);
CREATE INDEX IF NOT EXISTS idx_service_plan_signatures_member
  ON service_plan_contract_signatures(signer_platform_member_id,signed_at);
CREATE INDEX IF NOT EXISTS idx_service_plan_events_template
  ON service_plan_contract_events(contract_template_id,created_at);

CREATE TRIGGER IF NOT EXISTS trg_service_plan_signature_immutable_update
BEFORE UPDATE ON service_plan_contract_signatures BEGIN SELECT RAISE(ABORT,'SIGNED_PLAN_CONTRACT_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS trg_service_plan_signature_immutable_delete
BEFORE DELETE ON service_plan_contract_signatures BEGIN SELECT RAISE(ABORT,'SIGNED_PLAN_CONTRACT_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS trg_service_plan_artifact_immutable_update
BEFORE UPDATE ON service_plan_contract_artifacts BEGIN SELECT RAISE(ABORT,'SIGNED_PLAN_ARTIFACT_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS trg_service_plan_artifact_immutable_delete
BEFORE DELETE ON service_plan_contract_artifacts BEGIN SELECT RAISE(ABORT,'SIGNED_PLAN_ARTIFACT_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS trg_service_plan_event_immutable_update
BEFORE UPDATE ON service_plan_contract_events BEGIN SELECT RAISE(ABORT,'PLAN_CONTRACT_AUDIT_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS trg_service_plan_event_immutable_delete
BEFORE DELETE ON service_plan_contract_events BEGIN SELECT RAISE(ABORT,'PLAN_CONTRACT_AUDIT_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS trg_service_plan_template_signed_immutable_update
BEFORE UPDATE OF plan_id,plan_slug,contract_name,contract_version,contract_snapshot,contract_content_hash,plan_details_snapshot,effective_at,approved_content_hash,reviewed_by,reviewed_at,legal_counsel_reference
ON service_plan_contract_templates
WHEN OLD.status='approved' OR EXISTS (SELECT 1 FROM service_plan_contract_signatures WHERE contract_template_id=OLD.id)
BEGIN SELECT RAISE(ABORT,'PLAN_CONTRACT_TEMPLATE_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS trg_service_plan_template_signed_immutable_delete
BEFORE DELETE ON service_plan_contract_templates
BEGIN SELECT RAISE(ABORT,'PLAN_CONTRACT_TEMPLATE_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS trg_service_plan_template_approved_status_guard
BEFORE UPDATE OF status ON service_plan_contract_templates
WHEN OLD.status='approved' AND NEW.status NOT IN ('approved','revoked')
BEGIN SELECT RAISE(ABORT,'APPROVED_PLAN_CONTRACT_STATUS_IMMUTABLE'); END;

INSERT INTO service_plan_contract_templates(id,plan_id,plan_slug,contract_name,contract_version,contract_snapshot,contract_content_hash,plan_details_snapshot,effective_at,status)
VALUES
('plan_contract_standard_v1_0','baiye_standard_18000_addons','standard-digital-18000','創百業智慧鏈｜百工標準方案合作契約','v1.0','<h1>創百業智慧鏈｜百工標準方案合作契約 v1.0</h1><p><strong>法律審閱草稿｜pending_review｜目前不可於 Production 正式簽署</strong></p><h2>一、契約雙方與所選方案</h2><p>甲方：陳靈有限公司（創百業智慧鏈）；乙方：完成電子簽署之商家或其合法授權代表。乙方所選方案為「百工標準方案」，方案識別碼為 baiye_standard_18000_addons。</p><h2>二、方案費用與付款方式</h2><p>方案費用 NT$18,000；實際付款方式由雙方於既有申請／付款流程另行確認，不因本草稿自動扣款。</p><p>公開頁面或後續報價如有變動，不影響已簽署契約所保存之費用及方案 Snapshot。未經乙方另行確認，不視為同意自動續約或自動扣款。</p><h2>三、服務期間、內容與交付範圍</h2><p>自雙方確認之服務啟用日起 24 個月。</p><p>品牌網站、AI 智能客服、LINE、會員、預約與 Google 地圖預約導流。</p><ul><li>品牌網站</li><li>AI 智能客服</li><li>LINE 官方帳號</li><li>會員與預約</li><li>Google 地圖預約導流</li><li>百工協助上架 20 項商品／服務</li></ul><h2>四、方案限制與另行約定事項</h2><ul><li>網站主要內容由百工協助維護，不開放完整 CMS。</li><li>基礎協助上架以 20 項商品／服務為限。</li><li>超過 20 項或原方案外功能，以加購報價及補充協議辦理。</li></ul><p>續用條件：第 3 年起如選擇續用：平台上架 NT$3,000、網域 NT$1,000、後台／網站維持 NT$3,000，合計 NT$7,000／年。</p><p>加購政策：超過 20 項商品或原方案外功能，以加購報價及補充協議辦理。</p><h2>五、雙方權利義務</h2><p>甲方依本契約 Snapshot 所列標準範圍提供建置、平台或營運工具；乙方應提供正確、合法且有權使用之商家、品牌、商品、服務與聯絡資料，並配合必要確認、測試及驗收。超出本方案範圍之需求，應另經雙方書面確認。</p><h2>六、第三方服務、交付與驗收</h2><p>金流、分期、電子發票、LINE、簡訊、物流、AI 或其他第三方服務之啟用、費率、審核與持續提供，依第三方業者及個別約定為準。甲方不保證第三方必然核准、永久免費或永久不中斷。交付及驗收依本方案服務清單與雙方後續確認之執行紀錄辦理。</p><h2>七、個資、AI、智慧財產與資料</h2><p>雙方應依適用法令處理個人資料。AI 產出應由乙方確認，不保證正確率、營收或搜尋排名。雙方既有智慧財產權仍歸原權利人；商家資料之合法性、授權及使用責任由提供資料之一方負責。</p><h2>八、費用、變更、終止與爭議</h2><p>退款、取消、違約、終止、不可抗力及其他未盡事項，應以完成法律審閱之正式版本、個別報價或補充協議為準。方案變更不得直接覆寫既有契約；改選其他方案時應建立並重新簽署該方案之新契約。</p><h2>九、電子形式、版本與證據</h2><p>雙方同意以電子形式完成程序；法定姓名、明確同意、手寫簽名軌跡、時間、Session、IP、User-Agent、方案 Snapshot、契約 Snapshot 與雜湊作為線上簽署證據。已簽署文件不得覆寫，條款或方案內容變更應建立新版本。</p><h2>十、法律審閱 Gate</h2><p>本版本尚待正式法律審閱。未經平台授權管理員依實際法律審閱結果核准並鎖定內容 Hash 前，不得於 Production 正式簽署；準據法、管轄及依法不得排除之權利義務，以完成法律審閱後之正式版本為準。</p>','723SSdZhOxjn4OejFAGFjHIegmx3qrZKMMPPUtjcTb8','{"plan_id":"baiye_standard_18000_addons","plan_slug":"standard-digital-18000","plan_name":"百工標準方案","plan_price_minor":1800000,"plan_price_display":"NT$18,000","currency":"TWD","term_months":24,"trial_months":0,"activation_fee_minor":0,"deposit_minor":0,"first_cycle_balance_minor":1800000,"payment_terms":"方案費用 NT$18,000；實際付款方式由雙方於既有申請／付款流程另行確認，不因本草稿自動扣款。","service_period":"自雙方確認之服務啟用日起 24 個月。","summary":"品牌網站、AI 智能客服、LINE、會員、預約與 Google 地圖預約導流。","service_items":["品牌網站","AI 智能客服","LINE 官方帳號","會員與預約","Google 地圖預約導流","百工協助上架 20 項商品／服務"],"limitations":["網站主要內容由百工協助維護，不開放完整 CMS。","基礎協助上架以 20 項商品／服務為限。","超過 20 項或原方案外功能，以加購報價及補充協議辦理。"],"renewal_terms":"第 3 年起如選擇續用：平台上架 NT$3,000、網域 NT$1,000、後台／網站維持 NT$3,000，合計 NT$7,000／年。","addon_policy":"超過 20 項商品或原方案外功能，以加購報價及補充協議辦理。"}','2026-09-08','pending_review'),
('plan_contract_commerce_v1_0','baiye_commerce_ai_45000','ai-commerce-45000','創百業智慧鏈｜AI 智慧商城完整版方案合作契約','v1.0','<h1>創百業智慧鏈｜AI 智慧商城完整版方案合作契約 v1.0</h1><p><strong>法律審閱草稿｜pending_review｜目前不可於 Production 正式簽署</strong></p><h2>一、契約雙方與所選方案</h2><p>甲方：陳靈有限公司（創百業智慧鏈）；乙方：完成電子簽署之商家或其合法授權代表。乙方所選方案為「AI 智慧商城完整版」，方案識別碼為 baiye_commerce_ai_45000。</p><h2>二、方案費用與付款方式</h2><p>方案費用 NT$45,000；實際付款方式由雙方於既有申請／付款流程另行確認，不因本草稿自動扣款。</p><p>公開頁面或後續報價如有變動，不影響已簽署契約所保存之費用及方案 Snapshot。未經乙方另行確認，不視為同意自動續約或自動扣款。</p><h2>三、服務期間、內容與交付範圍</h2><p>自雙方確認之服務啟用日起 24 個月。</p><p>AI、完整商城、商品管理、購物車、訂單與標準金流串接能力。</p><ul><li>AI 智慧營運</li><li>完整商城</li><li>商品、價格與圖片管理</li><li>分類、規格與上下架</li><li>購物車與訂單管理</li><li>標準金流串接能力</li></ul><h2>四、方案限制與另行約定事項</h2><ul><li>商家可自行管理商品、價格、圖片、分類、規格與上下架。</li><li>實際金流啟用仍依 Provider readiness、第三方審核及服務條件。</li><li>非標準客製、第三方費用與額外 AI 用量另行確認。</li></ul><p>續用條件：期滿續用條件由雙方另行確認，不會未經商家同意自動扣款。</p><p>加購政策：非標準客製、第三方費用與額外 AI 用量另行確認。</p><h2>五、雙方權利義務</h2><p>甲方依本契約 Snapshot 所列標準範圍提供建置、平台或營運工具；乙方應提供正確、合法且有權使用之商家、品牌、商品、服務與聯絡資料，並配合必要確認、測試及驗收。超出本方案範圍之需求，應另經雙方書面確認。</p><h2>六、第三方服務、交付與驗收</h2><p>金流、分期、電子發票、LINE、簡訊、物流、AI 或其他第三方服務之啟用、費率、審核與持續提供，依第三方業者及個別約定為準。甲方不保證第三方必然核准、永久免費或永久不中斷。交付及驗收依本方案服務清單與雙方後續確認之執行紀錄辦理。</p><h2>七、個資、AI、智慧財產與資料</h2><p>雙方應依適用法令處理個人資料。AI 產出應由乙方確認，不保證正確率、營收或搜尋排名。雙方既有智慧財產權仍歸原權利人；商家資料之合法性、授權及使用責任由提供資料之一方負責。</p><h2>八、費用、變更、終止與爭議</h2><p>退款、取消、違約、終止、不可抗力及其他未盡事項，應以完成法律審閱之正式版本、個別報價或補充協議為準。方案變更不得直接覆寫既有契約；改選其他方案時應建立並重新簽署該方案之新契約。</p><h2>九、電子形式、版本與證據</h2><p>雙方同意以電子形式完成程序；法定姓名、明確同意、手寫簽名軌跡、時間、Session、IP、User-Agent、方案 Snapshot、契約 Snapshot 與雜湊作為線上簽署證據。已簽署文件不得覆寫，條款或方案內容變更應建立新版本。</p><h2>十、法律審閱 Gate</h2><p>本版本尚待正式法律審閱。未經平台授權管理員依實際法律審閱結果核准並鎖定內容 Hash 前，不得於 Production 正式簽署；準據法、管轄及依法不得排除之權利義務，以完成法律審閱後之正式版本為準。</p>','RwBIZSTpqyWo8M7XFF697qbENlJTEZsBpw9WiDp852k','{"plan_id":"baiye_commerce_ai_45000","plan_slug":"ai-commerce-45000","plan_name":"AI 智慧商城完整版","plan_price_minor":4500000,"plan_price_display":"NT$45,000","currency":"TWD","term_months":24,"trial_months":0,"activation_fee_minor":0,"deposit_minor":0,"first_cycle_balance_minor":4500000,"payment_terms":"方案費用 NT$45,000；實際付款方式由雙方於既有申請／付款流程另行確認，不因本草稿自動扣款。","service_period":"自雙方確認之服務啟用日起 24 個月。","summary":"AI、完整商城、商品管理、購物車、訂單與標準金流串接能力。","service_items":["AI 智慧營運","完整商城","商品、價格與圖片管理","分類、規格與上下架","購物車與訂單管理","標準金流串接能力"],"limitations":["商家可自行管理商品、價格、圖片、分類、規格與上下架。","實際金流啟用仍依 Provider readiness、第三方審核及服務條件。","非標準客製、第三方費用與額外 AI 用量另行確認。"],"renewal_terms":"期滿續用條件由雙方另行確認，不會未經商家同意自動扣款。","addon_policy":"非標準客製、第三方費用與額外 AI 用量另行確認。"}','2026-09-08','pending_review'),
('plan_contract_softpos_v1_0','baiye_softpos_24000','softpos-24000','創百業智慧鏈｜免 POS 機智慧點餐方案合作契約','v1.0','<h1>創百業智慧鏈｜免 POS 機智慧點餐方案合作契約 v1.0</h1><p><strong>法律審閱草稿｜pending_review｜目前不可於 Production 正式簽署</strong></p><h2>一、契約雙方與所選方案</h2><p>甲方：陳靈有限公司（創百業智慧鏈）；乙方：完成電子簽署之商家或其合法授權代表。乙方所選方案為「免 POS 機智慧點餐」，方案識別碼為 baiye_softpos_24000。</p><h2>二、方案費用與付款方式</h2><p>前 3 個月系統服務費 NT$0；首次開通費 NT$3,000；首次保證金 NT$6,000，可抵第一個 24 個月週期，首週期尚需 NT$18,000；後續每 24 個月 NT$24,000。實際付款方式由雙方於既有申請／付款流程另行確認。</p><p>公開頁面或後續報價如有變動，不影響已簽署契約所保存之費用及方案 Snapshot。未經乙方另行確認，不視為同意自動續約或自動扣款。</p><h2>三、服務期間、內容與交付範圍</h2><p>前 3 個月系統服務費免費，其後為 24 個月正式服務週期。</p><p>QR 點餐、訂單、庫存、出餐看板與會員營運，不必購買專用 POS 主機。</p><ul><li>QR 手機點餐</li><li>訂單與出餐看板</li><li>庫存與售完同步</li><li>會員營運</li><li>手機／平板接單</li><li>點餐購物車</li></ul><h2>四、方案限制與另行約定事項</h2><ul><li>不包含專用 POS 主機。</li><li>第三方金流、發票、通訊與設備費用依實際啟用條件另計。</li><li>分期方案依合作銀行／金流服務商核准及當時可用條件為準。</li></ul><p>續用條件：首個正式週期以保證金 NT$6,000 抵充，尚需 NT$18,000；後續每 24 個月 NT$24,000。</p><p>加購政策：第三方金流、發票、通訊與設備費用依實際啟用條件另計。</p><h2>五、雙方權利義務</h2><p>甲方依本契約 Snapshot 所列標準範圍提供建置、平台或營運工具；乙方應提供正確、合法且有權使用之商家、品牌、商品、服務與聯絡資料，並配合必要確認、測試及驗收。超出本方案範圍之需求，應另經雙方書面確認。</p><h2>六、第三方服務、交付與驗收</h2><p>金流、分期、電子發票、LINE、簡訊、物流、AI 或其他第三方服務之啟用、費率、審核與持續提供，依第三方業者及個別約定為準。甲方不保證第三方必然核准、永久免費或永久不中斷。交付及驗收依本方案服務清單與雙方後續確認之執行紀錄辦理。</p><h2>七、個資、AI、智慧財產與資料</h2><p>雙方應依適用法令處理個人資料。AI 產出應由乙方確認，不保證正確率、營收或搜尋排名。雙方既有智慧財產權仍歸原權利人；商家資料之合法性、授權及使用責任由提供資料之一方負責。</p><h2>八、費用、變更、終止與爭議</h2><p>退款、取消、違約、終止、不可抗力及其他未盡事項，應以完成法律審閱之正式版本、個別報價或補充協議為準。方案變更不得直接覆寫既有契約；改選其他方案時應建立並重新簽署該方案之新契約。</p><h2>九、電子形式、版本與證據</h2><p>雙方同意以電子形式完成程序；法定姓名、明確同意、手寫簽名軌跡、時間、Session、IP、User-Agent、方案 Snapshot、契約 Snapshot 與雜湊作為線上簽署證據。已簽署文件不得覆寫，條款或方案內容變更應建立新版本。</p><h2>十、法律審閱 Gate</h2><p>本版本尚待正式法律審閱。未經平台授權管理員依實際法律審閱結果核准並鎖定內容 Hash 前，不得於 Production 正式簽署；準據法、管轄及依法不得排除之權利義務，以完成法律審閱後之正式版本為準。</p>','1zbX0IvLLT8mYHBZn3Qg-IjDolnCltTCbRimFJNrAq0','{"plan_id":"baiye_softpos_24000","plan_slug":"softpos-24000","plan_name":"免 POS 機智慧點餐","plan_price_minor":2400000,"plan_price_display":"NT$24,000","currency":"TWD","term_months":24,"trial_months":3,"activation_fee_minor":300000,"deposit_minor":600000,"first_cycle_balance_minor":1800000,"payment_terms":"前 3 個月系統服務費 NT$0；首次開通費 NT$3,000；首次保證金 NT$6,000，可抵第一個 24 個月週期，首週期尚需 NT$18,000；後續每 24 個月 NT$24,000。實際付款方式由雙方於既有申請／付款流程另行確認。","service_period":"前 3 個月系統服務費免費，其後為 24 個月正式服務週期。","summary":"QR 點餐、訂單、庫存、出餐看板與會員營運，不必購買專用 POS 主機。","service_items":["QR 手機點餐","訂單與出餐看板","庫存與售完同步","會員營運","手機／平板接單","點餐購物車"],"limitations":["不包含專用 POS 主機。","第三方金流、發票、通訊與設備費用依實際啟用條件另計。","分期方案依合作銀行／金流服務商核准及當時可用條件為準。"],"renewal_terms":"首個正式週期以保證金 NT$6,000 抵充，尚需 NT$18,000；後續每 24 個月 NT$24,000。","addon_policy":"第三方金流、發票、通訊與設備費用依實際啟用條件另計。"}','2026-09-08','pending_review');

INSERT INTO audit_logs(id,actor_type,actor_id,action,entity_type,entity_id,metadata)
VALUES
('audit_plan_contract_standard_draft','system','migration','plan.contract.draft_created','service_plan_contract_template','plan_contract_standard_v1_0','{"plan_id":"baiye_standard_18000_addons","status":"pending_review"}'),
('audit_plan_contract_commerce_draft','system','migration','plan.contract.draft_created','service_plan_contract_template','plan_contract_commerce_v1_0','{"plan_id":"baiye_commerce_ai_45000","status":"pending_review"}'),
('audit_plan_contract_softpos_draft','system','migration','plan.contract.draft_created','service_plan_contract_template','plan_contract_softpos_v1_0','{"plan_id":"baiye_softpos_24000","status":"pending_review"}');
