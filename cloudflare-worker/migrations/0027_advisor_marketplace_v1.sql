-- Advisor Marketplace V1. Advisor is an independent domain: never a merchant.
PRAGMA foreign_keys=ON;

CREATE TABLE advisor_categories (
  id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
  description TEXT, icon_name TEXT, seo_title TEXT, seo_description TEXT,
  policy_disclaimer TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE advisor_applications (
  id TEXT PRIMARY KEY, platform_member_id TEXT NOT NULL, display_name TEXT NOT NULL,
  legal_name_ciphertext TEXT NOT NULL, legal_name_iv TEXT NOT NULL, identity_hmac TEXT NOT NULL,
  email_ciphertext TEXT NOT NULL, email_iv TEXT NOT NULL, phone_hmac TEXT NOT NULL,
  experience TEXT NOT NULL, introduction TEXT NOT NULL, service_modes_json TEXT NOT NULL,
  proposed_services_json TEXT NOT NULL, desired_pricing_json TEXT NOT NULL,
  portfolio_urls_json TEXT NOT NULL DEFAULT '[]', declarations_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'APPLIED' CHECK(status IN('APPLIED','UNDER_REVIEW','APPROVED','CONTRACT_REQUIRED','PROFILE_SETUP','ACTIVE','REJECTED','SUSPENDED','TERMINATED')),
  review_note TEXT, reviewed_by TEXT, reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(platform_member_id) REFERENCES platform_members(id)
);
CREATE UNIQUE INDEX uq_advisor_application_open ON advisor_applications(platform_member_id)
  WHERE status NOT IN('REJECTED','TERMINATED');

CREATE TABLE advisors (
  id TEXT PRIMARY KEY, platform_member_id TEXT NOT NULL UNIQUE, application_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'CONTRACT_REQUIRED' CHECK(status IN('CONTRACT_REQUIRED','PROFILE_SETUP','ACTIVE','SUSPENDED','TERMINATED')),
  contract_status TEXT NOT NULL DEFAULT 'unsigned' CHECK(contract_status IN('unsigned','signed','revoked')),
  completed_services_count INTEGER NOT NULL DEFAULT 0 CHECK(completed_services_count>=0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(platform_member_id) REFERENCES platform_members(id),
  FOREIGN KEY(application_id) REFERENCES advisor_applications(id)
);

CREATE TABLE advisor_profiles (
  advisor_id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
  tagline TEXT NOT NULL, biography TEXT NOT NULL, specialties_json TEXT NOT NULL DEFAULT '[]',
  photo_url TEXT, og_image_url TEXT, public_contact_json TEXT NOT NULL DEFAULT '{}',
  profile_completeness INTEGER NOT NULL DEFAULT 0 CHECK(profile_completeness BETWEEN 0 AND 100),
  moderation_status TEXT NOT NULL DEFAULT 'draft' CHECK(moderation_status IN('draft','pending_review','approved','rejected','suspended')),
  average_rating_bp INTEGER NOT NULL DEFAULT 0 CHECK(average_rating_bp BETWEEN 0 AND 500),
  published INTEGER NOT NULL DEFAULT 0 CHECK(published IN(0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(advisor_id) REFERENCES advisors(id)
);

CREATE TABLE advisor_profile_categories (
  advisor_id TEXT NOT NULL, category_id TEXT NOT NULL, PRIMARY KEY(advisor_id,category_id),
  FOREIGN KEY(advisor_id) REFERENCES advisors(id), FOREIGN KEY(category_id) REFERENCES advisor_categories(id)
);

CREATE TABLE advisor_services (
  id TEXT PRIMARY KEY, advisor_id TEXT NOT NULL, category_id TEXT NOT NULL,
  name TEXT NOT NULL, description TEXT NOT NULL, price_minor INTEGER NOT NULL CHECK(price_minor>=0),
  currency TEXT NOT NULL DEFAULT 'TWD' CHECK(currency='TWD'),
  duration_minutes INTEGER NOT NULL CHECK(duration_minutes BETWEEN 15 AND 480),
  service_mode TEXT NOT NULL CHECK(service_mode IN('online','in_person','phone','line_call','google_meet','other')),
  delivery_details TEXT, notice TEXT,
  moderation_status TEXT NOT NULL DEFAULT 'draft' CHECK(moderation_status IN('draft','pending_review','approved','rejected','suspended')),
  active INTEGER NOT NULL DEFAULT 0 CHECK(active IN(0,1)), sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(advisor_id,id), FOREIGN KEY(advisor_id) REFERENCES advisors(id), FOREIGN KEY(category_id) REFERENCES advisor_categories(id)
);

CREATE TABLE advisor_availability (
  id TEXT PRIMARY KEY, advisor_id TEXT NOT NULL, weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
  start_time TEXT NOT NULL, end_time TEXT NOT NULL, timezone TEXT NOT NULL DEFAULT 'Asia/Taipei',
  max_concurrent INTEGER NOT NULL DEFAULT 1 CHECK(max_concurrent BETWEEN 1 AND 10),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(advisor_id) REFERENCES advisors(id), CHECK(start_time<end_time)
);
CREATE TABLE advisor_blackouts (
  id TEXT PRIMARY KEY, advisor_id TEXT NOT NULL, start_at TEXT NOT NULL, end_at TEXT NOT NULL,
  reason TEXT, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(advisor_id) REFERENCES advisors(id), CHECK(start_at<end_at)
);

CREATE TABLE advisor_sessions (
  id TEXT PRIMARY KEY, advisor_id TEXT NOT NULL, platform_member_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE, csrf_hash TEXT NOT NULL, expires_at TEXT NOT NULL,
  revoked_at TEXT, last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(advisor_id) REFERENCES advisors(id), FOREIGN KEY(platform_member_id) REFERENCES platform_members(id)
);
CREATE TABLE advisor_auth_rate_limits (
  scope TEXT NOT NULL, rate_key_hash TEXT NOT NULL, bucket_start TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count>=0), locked_until TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(scope,rate_key_hash,bucket_start)
);

CREATE TABLE advisor_consumer_terms_versions (
  id TEXT PRIMARY KEY, version TEXT NOT NULL UNIQUE, title TEXT NOT NULL, content_html TEXT NOT NULL,
  content_hash TEXT NOT NULL, legal_review_status TEXT NOT NULL DEFAULT 'pending_review' CHECK(legal_review_status IN('pending_review','approved','revoked')),
  approved_content_hash TEXT, cancellation_policy_status TEXT NOT NULL DEFAULT 'LEGAL_REVIEW_REQUIRED',
  is_active INTEGER NOT NULL DEFAULT 0 CHECK(is_active IN(0,1)), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE advisor_bookings (
  id TEXT PRIMARY KEY, booking_code TEXT NOT NULL UNIQUE, advisor_id TEXT NOT NULL,
  service_id TEXT NOT NULL, platform_member_id TEXT NOT NULL,
  start_at TEXT NOT NULL, end_at TEXT NOT NULL, blocked_start_at TEXT NOT NULL, blocked_end_at TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Taipei', service_mode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','SLOT_HELD','PAYMENT_PENDING','CONFIRMED','IN_SERVICE','COMPLETED','CANCELLED','REFUND_PENDING','REFUNDED','DISPUTED')),
  service_price_minor INTEGER NOT NULL CHECK(service_price_minor>=0), currency TEXT NOT NULL DEFAULT 'TWD' CHECK(currency='TWD'),
  payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(payment_status IN('PENDING','PAID','FAILED','REFUND_PENDING','REFUNDED','VOID')),
  payment_provider TEXT NOT NULL DEFAULT 'PAYMENT_PROVIDER_DISABLED', test_data INTEGER NOT NULL DEFAULT 0 CHECK(test_data IN(0,1)),
  customer_note TEXT, terms_version TEXT, terms_hash TEXT, completed_at TEXT, cancelled_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(advisor_id,id), FOREIGN KEY(advisor_id,service_id) REFERENCES advisor_services(advisor_id,id),
  FOREIGN KEY(platform_member_id) REFERENCES platform_members(id)
);
CREATE INDEX idx_advisor_booking_collision ON advisor_bookings(advisor_id,blocked_start_at,blocked_end_at,status);
CREATE INDEX idx_advisor_booking_member ON advisor_bookings(platform_member_id,created_at);

CREATE TABLE advisor_booking_events (
  id TEXT PRIMARY KEY, booking_id TEXT NOT NULL, advisor_id TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK(actor_type IN('consumer','advisor','admin','system')),
  actor_id TEXT, event_type TEXT NOT NULL, from_status TEXT, to_status TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(advisor_id,booking_id) REFERENCES advisor_bookings(advisor_id,id)
);

CREATE TABLE advisor_consumer_terms_acceptances (
  id TEXT PRIMARY KEY, booking_id TEXT NOT NULL UNIQUE, platform_member_id TEXT NOT NULL,
  terms_version TEXT NOT NULL, terms_hash TEXT NOT NULL, accepted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_hash TEXT NOT NULL, session_evidence_hash TEXT NOT NULL, consent_json TEXT NOT NULL,
  FOREIGN KEY(booking_id) REFERENCES advisor_bookings(id), FOREIGN KEY(platform_member_id) REFERENCES platform_members(id)
);

CREATE TABLE advisor_reviews (
  id TEXT PRIMARY KEY, booking_id TEXT NOT NULL UNIQUE, advisor_id TEXT NOT NULL, platform_member_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), review_text TEXT,
  moderation_status TEXT NOT NULL DEFAULT 'pending_review' CHECK(moderation_status IN('pending_review','approved','hidden','rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(advisor_id,booking_id) REFERENCES advisor_bookings(advisor_id,id), FOREIGN KEY(platform_member_id) REFERENCES platform_members(id)
);
CREATE TABLE advisor_review_reports (
  id TEXT PRIMARY KEY, review_id TEXT NOT NULL, reporter_member_id TEXT NOT NULL,
  reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending_review' CHECK(status IN('pending_review','resolved','dismissed')),
  reviewed_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(review_id,reporter_member_id), FOREIGN KEY(review_id) REFERENCES advisor_reviews(id), FOREIGN KEY(reporter_member_id) REFERENCES platform_members(id)
);

CREATE TABLE advisor_commission_policies (
  id TEXT PRIMARY KEY, version TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','APPROVED','RETIRED')),
  commission_application_mode TEXT NOT NULL CHECK(commission_application_mode IN('progressive_nonretroactive','monthly_final_tier_retroactive')),
  provider_fee_policy TEXT NOT NULL CHECK(provider_fee_policy IN('policy_required','platform_absorbs','advisor_absorbs','before_split','pro_rata','custom')),
  tax_withholding_mode TEXT NOT NULL DEFAULT 'manual_review' CHECK(tax_withholding_mode IN('disabled','manual_review','configured')),
  tiers_json TEXT NOT NULL, refund_policy_version TEXT NOT NULL,
  legal_review_status TEXT NOT NULL DEFAULT 'pending_review', finance_review_status TEXT NOT NULL DEFAULT 'pending_review',
  effective_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE advisor_commission_ledger (
  id TEXT PRIMARY KEY, advisor_id TEXT NOT NULL, booking_id TEXT NOT NULL,
  entry_type TEXT NOT NULL CHECK(entry_type IN('COMMISSION','REFUND_REVERSAL','MANUAL_ADJUSTMENT')),
  original_entry_id TEXT, service_price_minor INTEGER NOT NULL, provider_fee_minor INTEGER NOT NULL DEFAULT 0,
  advisor_rate_bp INTEGER NOT NULL CHECK(advisor_rate_bp BETWEEN 0 AND 10000),
  platform_rate_bp INTEGER NOT NULL CHECK(platform_rate_bp BETWEEN 0 AND 10000),
  commission_policy_version TEXT NOT NULL, monthly_completed_count_at_snapshot INTEGER NOT NULL,
  advisor_share_minor INTEGER NOT NULL, platform_share_minor INTEGER NOT NULL,
  refund_policy_version TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(booking_id,entry_type), FOREIGN KEY(advisor_id,booking_id) REFERENCES advisor_bookings(advisor_id,id),
  FOREIGN KEY(original_entry_id) REFERENCES advisor_commission_ledger(id)
);

CREATE TABLE advisor_settlement_statements (
  id TEXT PRIMARY KEY, statement_no TEXT NOT NULL UNIQUE, advisor_id TEXT NOT NULL,
  period_start TEXT NOT NULL, period_end TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'TWD' CHECK(currency='TWD'),
  gross_service_minor INTEGER NOT NULL DEFAULT 0, advisor_share_minor INTEGER NOT NULL DEFAULT 0,
  reversal_minor INTEGER NOT NULL DEFAULT 0, net_payable_minor INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','review','locked','paid','void')),
  provider_fee_policy TEXT NOT NULL, tax_withholding_mode TEXT NOT NULL,
  payout_block_reason TEXT, locked_at TEXT, paid_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(advisor_id) REFERENCES advisors(id)
);
CREATE TABLE advisor_settlement_items (
  id TEXT PRIMARY KEY, statement_id TEXT NOT NULL, ledger_entry_id TEXT NOT NULL UNIQUE,
  amount_minor INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(statement_id,ledger_entry_id), FOREIGN KEY(statement_id) REFERENCES advisor_settlement_statements(id),
  FOREIGN KEY(ledger_entry_id) REFERENCES advisor_commission_ledger(id)
);

CREATE TABLE advisor_media_assets (
  id TEXT PRIMARY KEY, advisor_id TEXT NOT NULL, asset_type TEXT NOT NULL CHECK(asset_type IN('profile_photo','og_image','voice','video','script')),
  object_key TEXT, public_url TEXT, consent_contract_signature_id TEXT,
  moderation_status TEXT NOT NULL DEFAULT 'draft' CHECK(moderation_status IN('draft','pending_review','approved','rejected','suspended')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(advisor_id) REFERENCES advisors(id)
);
CREATE TABLE advisor_ai_video_requests (
  id TEXT PRIMARY KEY, advisor_id TEXT NOT NULL, script_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','script_review','approved_for_generation','generating','review_required','published','rejected')),
  portrait_consent_confirmed INTEGER NOT NULL DEFAULT 0 CHECK(portrait_consent_confirmed IN(0,1)),
  voice_consent_confirmed INTEGER NOT NULL DEFAULT 0 CHECK(voice_consent_confirmed IN(0,1)),
  provider_reference TEXT, reviewed_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(advisor_id) REFERENCES advisors(id)
);

CREATE TABLE advisor_policy_flags (
  id TEXT PRIMARY KEY, advisor_id TEXT, service_id TEXT, media_request_id TEXT,
  risk_code TEXT NOT NULL, matched_text_hash TEXT NOT NULL, severity TEXT NOT NULL CHECK(severity IN('review','blocked')),
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK(status IN('pending_review','resolved','dismissed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(advisor_id) REFERENCES advisors(id)
);

CREATE TABLE advisor_contract_versions (
  id TEXT PRIMARY KEY, version TEXT NOT NULL UNIQUE, title TEXT NOT NULL, content_html TEXT NOT NULL,
  content_hash TEXT NOT NULL, legal_review_status TEXT NOT NULL DEFAULT 'pending_review' CHECK(legal_review_status IN('pending_review','approved','revoked')),
  approved_content_hash TEXT, is_active INTEGER NOT NULL DEFAULT 0 CHECK(is_active IN(0,1)),
  commission_policy_version TEXT NOT NULL, customer_relationship_policy TEXT NOT NULL DEFAULT 'LEGAL_POLICY_REQUIRED',
  cancellation_policy TEXT NOT NULL DEFAULT 'LEGAL_REVIEW_REQUIRED', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE advisor_contract_signatures (
  id TEXT PRIMARY KEY, public_id TEXT NOT NULL UNIQUE, advisor_id TEXT NOT NULL, contract_version_id TEXT NOT NULL,
  legal_name TEXT NOT NULL, signed_at TEXT NOT NULL, contract_content_hash TEXT NOT NULL,
  signature_hash TEXT NOT NULL, document_hash TEXT NOT NULL, signature_data TEXT NOT NULL,
  signature_assurance_level TEXT NOT NULL, consent_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'VALID' CHECK(status IN('VALID','REVOKED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(advisor_id,contract_version_id),
  FOREIGN KEY(advisor_id) REFERENCES advisors(id), FOREIGN KEY(contract_version_id) REFERENCES advisor_contract_versions(id)
);
CREATE TABLE advisor_contract_artifacts (
  id TEXT PRIMARY KEY, advisor_id TEXT NOT NULL, signature_id TEXT NOT NULL,
  artifact_type TEXT NOT NULL CHECK(artifact_type IN('signed_pdf','evidence_json')),
  object_key TEXT NOT NULL UNIQUE, sha256 TEXT NOT NULL, content_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(signature_id,artifact_type),
  FOREIGN KEY(advisor_id,signature_id) REFERENCES advisor_contract_signatures(advisor_id,id)
);
CREATE UNIQUE INDEX uq_advisor_contract_signature_scope ON advisor_contract_signatures(advisor_id,id);
CREATE TABLE advisor_contract_operations (
  id TEXT PRIMARY KEY, party_type TEXT NOT NULL DEFAULT 'advisor' CHECK(party_type='advisor'), party_id TEXT NOT NULL,
  operation_type TEXT NOT NULL, idempotency_key TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'processing' CHECK(status IN('processing','completed','failed')),
  result_json TEXT, expires_at TEXT NOT NULL, completed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(party_type,party_id,operation_type,idempotency_key)
);

CREATE TABLE advisor_platform_policies (
  policy_key TEXT PRIMARY KEY, policy_value TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'DRAFT', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE advisor_audit_logs (
  id TEXT PRIMARY KEY, advisor_id TEXT, actor_type TEXT NOT NULL CHECK(actor_type IN('consumer','advisor','admin','system')),
  actor_id TEXT, action TEXT NOT NULL, resource_type TEXT NOT NULL, resource_id TEXT,
  ip_hash TEXT, user_agent_hash TEXT, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_advisors_status ON advisors(status,completed_services_count);
CREATE INDEX idx_advisor_profiles_public ON advisor_profiles(published,moderation_status,average_rating_bp);
CREATE INDEX idx_advisor_services_public ON advisor_services(category_id,active,moderation_status,price_minor);
CREATE INDEX idx_advisor_sessions_active ON advisor_sessions(token_hash,expires_at,revoked_at);
CREATE INDEX idx_advisor_auth_lockout ON advisor_auth_rate_limits(scope,rate_key_hash,locked_until);
CREATE INDEX idx_advisor_ledger_advisor ON advisor_commission_ledger(advisor_id,created_at);
CREATE INDEX idx_advisor_settlement_status ON advisor_settlement_statements(advisor_id,status,period_start);

CREATE TRIGGER trg_advisor_ledger_immutable_update BEFORE UPDATE ON advisor_commission_ledger BEGIN SELECT RAISE(ABORT,'ADVISOR_LEDGER_IMMUTABLE'); END;
CREATE TRIGGER trg_advisor_ledger_immutable_delete BEFORE DELETE ON advisor_commission_ledger BEGIN SELECT RAISE(ABORT,'ADVISOR_LEDGER_IMMUTABLE'); END;
CREATE TRIGGER trg_advisor_terms_acceptance_immutable_update BEFORE UPDATE ON advisor_consumer_terms_acceptances BEGIN SELECT RAISE(ABORT,'ADVISOR_TERMS_EVIDENCE_IMMUTABLE'); END;
CREATE TRIGGER trg_advisor_terms_acceptance_immutable_delete BEFORE DELETE ON advisor_consumer_terms_acceptances BEGIN SELECT RAISE(ABORT,'ADVISOR_TERMS_EVIDENCE_IMMUTABLE'); END;
CREATE TRIGGER trg_advisor_contract_signature_immutable_update BEFORE UPDATE ON advisor_contract_signatures BEGIN SELECT RAISE(ABORT,'ADVISOR_SIGNED_CONTRACT_IMMUTABLE'); END;
CREATE TRIGGER trg_advisor_contract_signature_immutable_delete BEFORE DELETE ON advisor_contract_signatures BEGIN SELECT RAISE(ABORT,'ADVISOR_SIGNED_CONTRACT_IMMUTABLE'); END;
CREATE TRIGGER trg_advisor_contract_artifact_immutable_update BEFORE UPDATE ON advisor_contract_artifacts BEGIN SELECT RAISE(ABORT,'ADVISOR_CONTRACT_ARTIFACT_IMMUTABLE'); END;
CREATE TRIGGER trg_advisor_contract_artifact_immutable_delete BEFORE DELETE ON advisor_contract_artifacts BEGIN SELECT RAISE(ABORT,'ADVISOR_CONTRACT_ARTIFACT_IMMUTABLE'); END;
CREATE TRIGGER trg_advisor_contract_version_signed_immutable BEFORE UPDATE OF content_html,content_hash,version ON advisor_contract_versions WHEN EXISTS(SELECT 1 FROM advisor_contract_signatures WHERE contract_version_id=OLD.id) BEGIN SELECT RAISE(ABORT,'ADVISOR_CONTRACT_VERSION_SIGNED_IMMUTABLE'); END;
CREATE TRIGGER trg_advisor_contract_version_delete_guard BEFORE DELETE ON advisor_contract_versions BEGIN SELECT RAISE(ABORT,'ADVISOR_CONTRACT_VERSION_IMMUTABLE'); END;
CREATE TRIGGER trg_advisor_consumer_terms_accepted_immutable BEFORE UPDATE OF content_html,content_hash,version ON advisor_consumer_terms_versions WHEN EXISTS(SELECT 1 FROM advisor_consumer_terms_acceptances WHERE terms_version=OLD.version) BEGIN SELECT RAISE(ABORT,'ADVISOR_CONSUMER_TERMS_ACCEPTED_IMMUTABLE'); END;
CREATE TRIGGER trg_advisor_consumer_terms_delete_guard BEFORE DELETE ON advisor_consumer_terms_versions BEGIN SELECT RAISE(ABORT,'ADVISOR_CONSUMER_TERMS_IMMUTABLE'); END;

INSERT OR IGNORE INTO advisor_categories(id,slug,display_name,description,icon_name,seo_title,seo_description,policy_disclaimer,sort_order) VALUES
('advisor_cat_ziwei','ziwei','紫微斗數','以文化與生活探索角度整理人生方向。','Sparkle','紫微斗數生活顧問','探索紫微斗數顧問與服務。','本分類服務屬文化、娛樂與生活探索用途。',10),
('advisor_cat_bazi','bazi','八字／命理','以傳統文化角度進行生活探索。','CalendarDots','八字命理生活顧問','探索八字與命理顧問服務。','本分類服務不構成醫療、法律或投資建議。',20),
('advisor_cat_palm','palm-face','手相／面相','手相與面相文化探索。','HandPalm','手相面相顧問','探索手相與面相服務。','本分類不保證任何結果或準確性。',30),
('advisor_cat_tarot','tarot','塔羅','以牌卡協助整理想法與生活方向。','Cards','塔羅生活顧問','探索塔羅顧問與預約時段。','本分類不替代專業醫療、法律或投資服務。',40),
('advisor_cat_dream','dream','解夢','從文化與個人敘事角度探索夢境。','MoonStars','夢境探索顧問','探索夢境與生活方向。','本分類不提供心理診斷或治療。',50),
('advisor_cat_wellness','mind-body-spirit','身心靈','一般身心靈生活探索與陪談。','Lotus','身心靈生活顧問','探索生活成長顧問。','本分類不替代醫療或心理治療。',60),
('advisor_cat_meditation','meditation','冥想／禪修','冥想與日常覺察練習。','FlowerLotus','冥想生活顧問','探索冥想與禪修服務。','如有身心不適，請尋求合格專業人員。',70),
('advisor_cat_energy','spiritual-growth','能量／靈性成長','個人成長與靈性文化探索。','SunHorizon','靈性成長顧問','探索靈性成長服務。','不得宣稱治癒疾病或保證結果。',80),
('advisor_cat_life','relationship-life','情感／人生方向','一般情感整理與人生方向陪談。','Heart','情感人生方向顧問','探索情感與人生方向服務。','本分類不屬心理治療或法律諮詢。',90),
('advisor_cat_career','career','事業／職涯諮詢','工作方向、能力盤點與生涯探索。','Briefcase','事業職涯顧問','探索職涯與事業方向服務。','本分類不保證就業、收入或投資結果。',100);

INSERT OR IGNORE INTO advisor_commission_policies(id,version,status,commission_application_mode,provider_fee_policy,tax_withholding_mode,tiers_json,refund_policy_version)
VALUES('advisor_commission_draft_v1','advisor-commission-draft-v1','DRAFT','progressive_nonretroactive','policy_required','manual_review','[{"min":1,"max":30,"advisor_bp":5000},{"min":31,"max":60,"advisor_bp":5200},{"min":61,"max":99,"advisor_bp":5300},{"min":100,"max":199,"advisor_bp":5500},{"min":200,"max":null,"advisor_bp":6000}]','advisor-refund-policy-draft-v1');

INSERT OR IGNORE INTO advisor_platform_policies(policy_key,policy_value,status) VALUES
('REAL_ADVISOR_PAYMENT_ENABLED','false','LOCKED'),('REAL_ADVISOR_PAYOUT_ENABLED','false','LOCKED'),
('customer_relationship_policy','LEGAL_POLICY_REQUIRED','DRAFT'),('consumer_cancellation_policy','LEGAL_REVIEW_REQUIRED','DRAFT'),
('provider_fee_policy','PAYOUT_BLOCKED_POLICY_REQUIRED','DRAFT'),('tax_withholding_policy','manual_review','DRAFT');

INSERT OR IGNORE INTO advisor_contract_versions(id,version,title,content_html,content_hash,legal_review_status,is_active,commission_policy_version)
VALUES('advisor_partner_v1_0','advisor_partner_v1_0','創百業智慧鏈｜身心靈生活顧問合作契約','<h1>創百業智慧鏈｜身心靈生活顧問合作契約</h1><p>本契約為法律審閱草稿。合作為獨立服務提供者關係，平台提供品牌頁、預約、付款準備、評價、AI 客服與媒體流程，不保證流量、客戶或收入。</p><h2>服務與內容義務</h2><p>顧問應遵守服務價格、分潤版本、結算、取消退款、爭議款、客訴、個資與平台外交易政策；禁止醫療診斷、治療或停藥指示，禁止法律或投資保證，禁止婚姻結果、災禍、死亡或百分之百準確宣稱。</p><h2>資料與智慧財產</h2><p>客戶關係政策、取消政策、照片、肖像、聲音、AI 影片、品牌推廣及社群刊登範圍均須另經正式版本與個別授權確認。未簽授權不得生成 AI 影片。</p><h2>終止與保存</h2><p>終止後 Profile 與 Media 依正式政策處理；歷史訂單、財務、稽核與契約證據依法與依政策保存。電子簽署建立 PDF、內容雜湊及私有證據。</p><p><strong>LEGAL_REVIEW_REQUIRED：客戶歸屬、取消退款、手續費、扣繳與爭議條款須由法律、商業及財務人工確認後始得正式啟用。</strong></p>','79c9e66d4e097ee4016e85fea28218a15a62bfc6a52ad481d0d45818aeeb84c8','pending_review',1,'advisor-commission-draft-v1');

UPDATE advisor_contract_versions SET content_html=content_html||'<h2>A｜合作雙方</h2><p>平台與顧問之身分及通知資料以簽署證據為準。</p><h2>B–C｜合作性質與獨立服務提供者</h2><p>雙方為獨立合作關係，不構成僱傭、代理或收入保證。</p><h2>D–E｜平台服務與顧問義務</h2><p>平台提供品牌、會員、預約、付款準備與推廣工具；顧問應依約提供合法、安全且真實的服務。</p><h2>F–I｜價格、分潤、結算與手續費</h2><p>服務價格、分潤政策版本、結算週期與金流手續費政策均以每筆快照及人工核准政策為準。</p><h2>J–L｜取消、退款、爭議款與客訴</h2><p>依版本化政策處理取消、退款、Chargeback、爭議與客訴，不得刪除原始財務紀錄。</p><h2>M｜評價制度</h2><p>僅已完成且已付款服務可評價，並受檢舉及內容審核。</p><h2>N–O｜個資與客戶資料邊界</h2><p>僅處理服務必要資料；客戶關係政策須完成法律及商業人工審閱。</p><h2>P｜平台外交易</h2><p>平台外交易規範、責任與資料使用須依正式政策版本。</p><h2>Q–R｜內容規範與禁止宣稱</h2><p>禁止醫療診斷、治療或停藥指示，禁止投資獲利、婚姻結果、災禍及百分之百準確保證。</p><h2>S–T｜照片、肖像、AI 影片與網站內容授權</h2><p>使用範圍、期間、媒體及撤回處理以個別正式授權為準；未簽授權不得生成或發布。</p><h2>U｜智慧財產權</h2><p>顧問應確保提供素材具有合法權利，平台僅於授權範圍使用。</p><h2>V–W｜終止及 Profile／Media 處理</h2><p>合作暫停或終止後，公開資料與媒體依正式政策下架、保留或處理。</p><h2>X｜歷史資料保存</h2><p>歷史訂單、財務、契約及稽核資料依法律與政策保存。</p><h2>Y｜電子契約</h2><p>簽署建立 Canonical Hash、PDF、Private R2 Evidence 及驗證紀錄。</p><h2>Z｜通知與爭議處理</h2><p>通知方式、管轄及爭議處理須待法律審閱後生效。</p>',content_hash='4e10d583a048c3c857aee4009dccd3362a7d221f11f823b944200486ee7b9878' WHERE version='advisor_partner_v1_0';

INSERT OR IGNORE INTO advisor_consumer_terms_versions(id,version,title,content_html,content_hash,legal_review_status,is_active)
VALUES('advisor_consumer_service_terms_v1_0','advisor_consumer_service_terms_v1_0','身心靈生活顧問服務條款','<h1>顧問服務條款</h1><p>服務主要屬文化、娛樂、生活探索、個人成長與一般陪談用途，不替代醫療、心理治療、法律、投資或其他依法須由專業資格人員提供的服務。</p><p>服務內容、價格、時間、方式、取消退款規則與平台角色須於結帳逐項確認。</p><p><strong>LEGAL_REVIEW_REQUIRED</strong></p>','ee72dd3c0f4c0ea6e07251c13b578c816996890ee589397d627947a5ed27d052','pending_review',1);

