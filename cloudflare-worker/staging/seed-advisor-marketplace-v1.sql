-- STAGING ONLY. Deliberately obvious test advisors; never apply to Production.
PRAGMA foreign_keys=ON;

INSERT OR IGNORE INTO ordering_customers(id,display_name,phone_normalized,phone_display,phone_verified,privacy_consent_version,privacy_consented_at) VALUES
('advisor_test_customer_1','TEST ADVISOR 紫微','0900001101','0900001101',0,'staging-advisor-v1',CURRENT_TIMESTAMP),
('advisor_test_customer_2','TEST ADVISOR 塔羅','0900001102','0900001102',0,'staging-advisor-v1',CURRENT_TIMESTAMP),
('advisor_test_customer_3','TEST ADVISOR 八字','0900001103','0900001103',0,'staging-advisor-v1',CURRENT_TIMESTAMP),
('advisor_test_customer_4','TEST ADVISOR 職涯','0900001104','0900001104',0,'staging-advisor-v1',CURRENT_TIMESTAMP),
('advisor_test_customer_5','TEST ADVISOR 冥想','0900001105','0900001105',0,'staging-advisor-v1',CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO platform_members(id,customer_id,member_no,joined_source,phone_verified,membership_origin_verified) VALUES
('advisor_test_member_1','advisor_test_customer_1','STAGING-ADVISOR-MBR-001','admin',0,0),
('advisor_test_member_2','advisor_test_customer_2','STAGING-ADVISOR-MBR-002','admin',0,0),
('advisor_test_member_3','advisor_test_customer_3','STAGING-ADVISOR-MBR-003','admin',0,0),
('advisor_test_member_4','advisor_test_customer_4','STAGING-ADVISOR-MBR-004','admin',0,0),
('advisor_test_member_5','advisor_test_customer_5','STAGING-ADVISOR-MBR-005','admin',0,0);

INSERT OR IGNORE INTO advisors(id,platform_member_id,status,contract_status,completed_services_count) VALUES
('advisor_test_ziwei','advisor_test_member_1','ACTIVE','signed',226),
('advisor_test_tarot','advisor_test_member_2','ACTIVE','signed',142),
('advisor_test_bazi','advisor_test_member_3','ACTIVE','signed',88),
('advisor_test_career','advisor_test_member_4','ACTIVE','signed',54),
('advisor_test_meditation','advisor_test_member_5','ACTIVE','signed',31);

INSERT OR IGNORE INTO advisor_profiles(advisor_id,slug,display_name,tagline,biography,specialties_json,photo_url,profile_completeness,moderation_status,average_rating_bp,published) VALUES
('advisor_test_ziwei','test-ziwei-lin','TEST ADVISOR｜林老師','用文化脈絡整理人生節奏','測試資料：以紫微斗數文化作為對話工具，陪伴使用者整理工作、關係與生活方向。','["紫微斗數","人生方向","年度規劃"]','/brand/chuang-baiye-smart-chain-logo.png',100,'approved',480,1),
('advisor_test_tarot','test-tarot-an','TEST ADVISOR｜安老師','用牌卡協助看見不同選擇','測試資料：透過塔羅牌卡與提問，協助整理當下想法，不提供保證性預測。','["塔羅","情感方向","生活探索"]','/brand/chuang-baiye-smart-chain-logo.png',96,'approved',470,1),
('advisor_test_bazi','test-bazi-chen','TEST ADVISOR｜陳老師','傳統文化與生活規劃對話','測試資料：以八字文化觀點整理個人節奏與生涯議題。','["八字","命理文化","生涯探索"]','/brand/chuang-baiye-smart-chain-logo.png',92,'approved',460,1),
('advisor_test_career','test-career-yu','TEST ADVISOR｜宇顧問','釐清工作瓶頸與下一步','測試資料：以一般職涯陪談與能力盤點協助釐清方向，不保證錄取或收入。','["事業方向","職涯探索","工作瓶頸"]','/brand/chuang-baiye-smart-chain-logo.png',94,'approved',490,1),
('advisor_test_meditation','test-meditation-he','TEST ADVISOR｜和老師','把覺察練習帶回日常','測試資料：提供一般冥想練習與生活覺察說明，不替代任何醫療或心理治療。','["冥想","覺察","個人成長"]','/brand/chuang-baiye-smart-chain-logo.png',90,'approved',450,1);

INSERT OR IGNORE INTO advisor_profile_categories(advisor_id,category_id) VALUES
('advisor_test_ziwei','advisor_cat_ziwei'),('advisor_test_tarot','advisor_cat_tarot'),
('advisor_test_bazi','advisor_cat_bazi'),('advisor_test_career','advisor_cat_career'),
('advisor_test_meditation','advisor_cat_meditation');

INSERT OR IGNORE INTO advisor_services(id,advisor_id,category_id,name,description,price_minor,duration_minutes,service_mode,delivery_details,notice,moderation_status,active,sort_order) VALUES
('advisor_service_ziwei','advisor_test_ziwei','advisor_cat_ziwei','紫微斗數年度方向探索','以文化與自我探索角度整理年度重點。',150000,60,'online','測試線上服務；實際連結由顧問確認。','不構成醫療、法律或投資建議。','approved',1,10),
('advisor_service_tarot','advisor_test_tarot','advisor_cat_tarot','塔羅感情方向探索','用牌卡與提問協助整理關係想法。',80000,30,'phone','測試電話服務。','不保證復合或特定結果。','approved',1,10),
('advisor_service_bazi','advisor_test_bazi','advisor_cat_bazi','八字生涯節奏探索','從傳統文化角度整理生涯議題。',120000,60,'in_person','測試實體服務地點於確認後提供。','不保證任何結果。','approved',1,10),
('advisor_service_career','advisor_test_career','advisor_cat_career','工作瓶頸陪談','盤點現況、限制與可行下一步。',100000,60,'google_meet','測試 Meet；目前未宣稱平台已整合。','不保證就業或收入。','approved',1,10),
('advisor_service_meditation','advisor_test_meditation','advisor_cat_meditation','日常冥想入門','一般呼吸覺察與日常練習。',60000,45,'online','測試線上服務。','身心不適請尋求合格專業人員。','approved',1,10);

INSERT OR IGNORE INTO advisor_availability(id,advisor_id,weekday,start_time,end_time,max_concurrent) VALUES
('advisor_avail_1','advisor_test_ziwei',1,'09:00','18:00',1),
('advisor_avail_2','advisor_test_tarot',2,'10:00','19:00',1),
('advisor_avail_3','advisor_test_bazi',3,'09:00','17:00',1),
('advisor_avail_4','advisor_test_career',4,'11:00','20:00',1),
('advisor_avail_5','advisor_test_meditation',5,'08:00','16:00',1);
