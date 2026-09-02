-- Idempotent production seed scoped to demo_beef_noodle.
INSERT OR IGNORE INTO merchants(id,merchant_code,name,contact_name,phone,email,status,demo_environment,official_demo,demo_contract_exemption)
VALUES('demo_beef_noodle','DEMO-BEEF-NOODLE','百工牛肉麵｜完整功能試用店','百工官方示範','0900000026',NULL,'active',1,1,1);
UPDATE merchants SET name='百工牛肉麵｜完整功能試用店',phone='0900000026',demo_environment=1,official_demo=1,demo_contract_exemption=1,updated_at=CURRENT_TIMESTAMP WHERE id='demo_beef_noodle';
INSERT OR IGNORE INTO production_demo_merchants(merchant_id,display_badge) VALUES('demo_beef_noodle','百工官方示範');

INSERT OR IGNORE INTO merchant_roles(id,merchant_id,code,name,is_system) VALUES('demo_beef_owner_role','demo_beef_noodle','owner','管理者',1);
INSERT OR IGNORE INTO merchant_role_permissions(role_id,permission_code) SELECT 'demo_beef_owner_role',code FROM merchant_permissions WHERE code LIKE 'ordering.%' OR code LIKE 'merchant.%';

INSERT INTO merchant_ordering_settings(merchant_id,display_name,enabled,currency,dine_in_enabled,takeaway_enabled,require_member,consent_version,ordering_open,accepting_orders,temporary_closed_message,auto_accept_orders,order_number_prefix,max_items_per_order,customer_cancel_before_accept,estimated_prep_minutes,new_order_sound_enabled,table_session_enabled,show_sold_out_items,timezone)
VALUES('demo_beef_noodle','百工牛肉麵｜完整功能試用店',1,'TWD',1,1,1,'PRODUCTION-DEMO-2026-09',1,1,'示範店目前暫停接單',0,'BN',50,1,15,1,1,1,'Asia/Taipei')
ON CONFLICT(merchant_id) DO UPDATE SET display_name=excluded.display_name,enabled=1,ordering_open=1,accepting_orders=1,dine_in_enabled=1,takeaway_enabled=1,require_member=1,updated_at=CURRENT_TIMESTAMP;

INSERT INTO merchant_admin_profiles(merchant_id,brand_name,business_description,support_phone,business_address,business_hours,transportation_info,homepage_notice,shopping_cart_enabled)
VALUES('demo_beef_noodle','百工牛肉麵','紅燒與清燉慢熬湯頭，手機掃碼即可點餐的完整功能試用店。','02-0000-0000','臺北市（百工官方示範）','每日 11:00–20:30','百工官方示範資料，不代表實際營業地址。','示範資料／不進行真實交易',1)
ON CONFLICT(merchant_id) DO UPDATE SET brand_name=excluded.brand_name,business_description=excluded.business_description,homepage_notice=excluded.homepage_notice,updated_at=CURRENT_TIMESTAMP;
INSERT OR IGNORE INTO merchant_line_integrations(merchant_id,enabled,display_name) VALUES('demo_beef_noodle',0,'百工牛肉麵 LINE');

INSERT OR REPLACE INTO merchant_menu_categories(id,merchant_id,name,description,sort_order,active,updated_at) VALUES
('bn_cat_beef','demo_beef_noodle','招牌牛肉麵','紅燒與清燉慢熬湯頭',10,1,CURRENT_TIMESTAMP),
('bn_cat_noodles','demo_beef_noodle','乾麵／拌麵','香辣乾拌麵與家常麵食',20,1,CURRENT_TIMESTAMP),
('bn_cat_sides','demo_beef_noodle','小菜','台式經典小菜',30,1,CURRENT_TIMESTAMP),
('bn_cat_soups','demo_beef_noodle','湯品','暖胃湯品',40,1,CURRENT_TIMESTAMP),
('bn_cat_drinks','demo_beef_noodle','飲品','清爽茶飲',50,1,CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO merchant_menu_items(id,merchant_id,category_id,sku,name,description,price_minor,image_url,available,sort_order,status,allow_customer_note,daily_limit,updated_at) VALUES
('bn_item_01','demo_beef_noodle','bn_cat_beef','BN-001','招牌紅燒牛肉麵','慢燉紅燒湯頭搭配厚切牛腱。',18000,'https://baiyeconnect.com/assets/demo-beef-noodle/braised-bowl.svg',1,10,'active',1,NULL,CURRENT_TIMESTAMP),
('bn_item_02','demo_beef_noodle','bn_cat_beef','BN-002','半筋半肉牛肉麵','牛腱與牛筋雙重口感。',22000,'https://baiyeconnect.com/assets/demo-beef-noodle/tendon-bowl.svg',1,20,'active',1,NULL,CURRENT_TIMESTAMP),
('bn_item_03','demo_beef_noodle','bn_cat_beef','BN-003','滿滿牛肉麵','加量厚切牛肉。',25000,'https://baiyeconnect.com/assets/demo-beef-noodle/braised-bowl.svg',1,30,'active',1,NULL,CURRENT_TIMESTAMP),
('bn_item_04','demo_beef_noodle','bn_cat_beef','BN-004','清燉牛肉麵','清爽湯底與厚切牛肉。',19000,'https://baiyeconnect.com/assets/demo-beef-noodle/tendon-bowl.svg',1,40,'active',1,NULL,CURRENT_TIMESTAMP),
('bn_item_05','demo_beef_noodle','bn_cat_beef','BN-005','牛筋麵','軟嫩牛筋搭配慢燉湯頭。',23000,'https://baiyeconnect.com/assets/demo-beef-noodle/tendon-bowl.svg',1,50,'active',1,NULL,CURRENT_TIMESTAMP),
('bn_item_06','demo_beef_noodle','bn_cat_noodles','BN-006','紅油牛肉乾拌麵','香辣紅油拌麵配牛肉。',16000,'https://baiyeconnect.com/assets/demo-beef-noodle/dry-noodle.svg',1,10,'active',1,NULL,CURRENT_TIMESTAMP),
('bn_item_07','demo_beef_noodle','bn_cat_noodles','BN-007','麻醬麵','濃香芝麻醬拌麵。',8000,'https://baiyeconnect.com/assets/demo-beef-noodle/dry-noodle.svg',1,20,'active',1,NULL,CURRENT_TIMESTAMP),
('bn_item_08','demo_beef_noodle','bn_cat_soups','BN-008','牛肉湯','慢燉牛肉湯。',12000,'https://baiyeconnect.com/assets/demo-beef-noodle/braised-bowl.svg',1,10,'active',1,NULL,CURRENT_TIMESTAMP),
('bn_item_09','demo_beef_noodle','bn_cat_soups','BN-009','貢丸湯','家常清湯與貢丸。',6000,'https://baiyeconnect.com/assets/demo-beef-noodle/braised-bowl.svg',1,20,'active',1,NULL,CURRENT_TIMESTAMP),
('bn_item_10','demo_beef_noodle','bn_cat_sides','BN-010','滷蛋','香滷入味。',2000,'https://baiyeconnect.com/assets/demo-beef-noodle/side-dish.svg',1,10,'active',1,NULL,CURRENT_TIMESTAMP),
('bn_item_11','demo_beef_noodle','bn_cat_sides','BN-011','燙青菜','當日青菜。',5000,'https://baiyeconnect.com/assets/demo-beef-noodle/side-dish.svg',1,20,'active',1,NULL,CURRENT_TIMESTAMP),
('bn_item_12','demo_beef_noodle','bn_cat_sides','BN-012','滷豆干','台式滷味。',4000,'https://baiyeconnect.com/assets/demo-beef-noodle/side-dish.svg',1,30,'active',1,NULL,CURRENT_TIMESTAMP),
('bn_item_13','demo_beef_noodle','bn_cat_sides','BN-013','涼拌小黃瓜','爽脆開胃。',4500,'https://baiyeconnect.com/assets/demo-beef-noodle/side-dish.svg',1,40,'active',1,NULL,CURRENT_TIMESTAMP),
('bn_item_14','demo_beef_noodle','bn_cat_sides','BN-014','牛肚拼盤','滷牛肚拼盤。',10000,'https://baiyeconnect.com/assets/demo-beef-noodle/side-dish.svg',1,50,'active',1,NULL,CURRENT_TIMESTAMP),
('bn_item_15','demo_beef_noodle','bn_cat_drinks','BN-015','古早味紅茶','清爽茶飲。',3500,'https://baiyeconnect.com/assets/demo-beef-noodle/side-dish.svg',1,10,'active',0,NULL,CURRENT_TIMESTAMP),
('bn_item_16','demo_beef_noodle','bn_cat_drinks','BN-016','冬瓜茶','清涼冬瓜茶。',3500,'https://baiyeconnect.com/assets/demo-beef-noodle/side-dish.svg',1,20,'active',0,NULL,CURRENT_TIMESTAMP),
('bn_item_17','demo_beef_noodle','bn_cat_drinks','BN-017','無糖茶','無糖清茶。',3000,'https://baiyeconnect.com/assets/demo-beef-noodle/side-dish.svg',1,30,'active',0,NULL,CURRENT_TIMESTAMP),
('bn_item_18','demo_beef_noodle','bn_cat_noodles','BN-018','紅燒牛肉燴飯','慢燉紅燒牛肉與白飯。',17000,'https://baiyeconnect.com/assets/demo-beef-noodle/braised-bowl.svg',1,30,'active',1,NULL,CURRENT_TIMESTAMP),
('bn_item_19','demo_beef_noodle','bn_cat_soups','BN-019','酸辣湯','酸香開胃的熱湯。',5500,'https://baiyeconnect.com/assets/demo-beef-noodle/side-dish.svg',1,30,'active',0,NULL,CURRENT_TIMESTAMP),
('bn_item_20','demo_beef_noodle','bn_cat_drinks','BN-020','梅子冰茶','清爽梅香茶飲。',4000,'https://baiyeconnect.com/assets/demo-beef-noodle/side-dish.svg',1,40,'active',0,NULL,CURRENT_TIMESTAMP);
