PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO merchants(id,merchant_code,name,contact_name,email,status)
VALUES('demo_beef_noodle','DEMO-BEEF-NOODLE','百工牛肉麵｜QR 點餐示範店','創百業示範環境','beef-noodle-demo@example.test','active');

INSERT INTO merchant_ordering_settings(
  merchant_id,display_name,enabled,currency,dine_in_enabled,takeaway_enabled,require_member,
  consent_version,ordering_open,accepting_orders,temporary_closed_message,auto_accept_orders,
  order_number_prefix,max_items_per_order,customer_cancel_before_accept,estimated_prep_minutes,
  new_order_sound_enabled,table_session_enabled,show_sold_out_items,timezone
) VALUES(
  'demo_beef_noodle','百工牛肉麵｜QR 點餐示範店',1,'TWD',1,1,1,
  'DEMO-2026-08-28',1,1,'示範店目前暫停接單',0,'BN',50,1,15,1,1,1,'Asia/Taipei'
) ON CONFLICT(merchant_id) DO UPDATE SET
  display_name=excluded.display_name,enabled=1,ordering_open=1,accepting_orders=1,
  dine_in_enabled=1,takeaway_enabled=1,require_member=1,customer_cancel_before_accept=1,
  estimated_prep_minutes=15,table_session_enabled=1,show_sold_out_items=1,timezone='Asia/Taipei',updated_at=CURRENT_TIMESTAMP;

INSERT OR IGNORE INTO merchant_roles(id,merchant_id,code,name,is_system)
VALUES('demo_beef_owner_role','demo_beef_noodle','owner','示範店擁有者',0);
INSERT OR IGNORE INTO merchant_role_permissions(role_id,permission_code)
SELECT 'demo_beef_owner_role',code FROM merchant_permissions WHERE code LIKE 'ordering.%';
INSERT OR IGNORE INTO merchant_users(
  id,merchant_id,email,password_hash,password_salt,password_iterations,password_algorithm,status,display_name
)
SELECT 'demo_beef_owner','demo_beef_noodle','beef-demo-owner@example.test',password_hash,password_salt,
  password_iterations,password_algorithm,'active','百工牛肉麵示範店管理者'
FROM merchant_users WHERE id='stg_owner';
INSERT OR IGNORE INTO merchant_user_roles(merchant_id,user_id,role_id)
VALUES('demo_beef_noodle','demo_beef_owner','demo_beef_owner_role');

INSERT OR REPLACE INTO merchant_menu_categories(id,merchant_id,name,description,sort_order,active,updated_at) VALUES
('bn_cat_beef','demo_beef_noodle','招牌牛肉麵','紅燒與清燉慢熬湯頭',10,1,CURRENT_TIMESTAMP),
('bn_cat_noodles','demo_beef_noodle','乾麵與湯品','乾拌麵、家常麵食與暖湯',20,1,CURRENT_TIMESTAMP),
('bn_cat_sides','demo_beef_noodle','小菜','搭配牛肉麵的台式經典小菜',30,1,CURRENT_TIMESTAMP),
('bn_cat_drinks','demo_beef_noodle','飲品','清爽茶飲',40,1,CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO merchant_menu_items(
 id,merchant_id,category_id,sku,name,description,price_minor,image_url,available,sort_order,status,allow_customer_note,updated_at
) VALUES
('bn_item_01','demo_beef_noodle','bn_cat_beef','BN-001','招牌紅燒牛肉麵','慢燉紅燒湯頭搭配厚切牛腱。',18000,'https://baiye-beef-noodle-demo.pages.dev/assets/demo-beef-noodle/braised-bowl.svg',1,10,'active',1,CURRENT_TIMESTAMP),
('bn_item_02','demo_beef_noodle','bn_cat_beef','BN-002','半筋半肉牛肉麵','牛腱與牛筋雙重口感。',22000,'https://baiye-beef-noodle-demo.pages.dev/assets/demo-beef-noodle/tendon-bowl.svg',1,20,'active',1,CURRENT_TIMESTAMP),
('bn_item_03','demo_beef_noodle','bn_cat_beef','BN-003','滿滿牛肉麵','加量厚切牛肉，適合想吃得滿足的你。',25000,'https://baiye-beef-noodle-demo.pages.dev/assets/demo-beef-noodle/braised-bowl.svg',1,30,'active',1,CURRENT_TIMESTAMP),
('bn_item_04','demo_beef_noodle','bn_cat_beef','BN-004','清燉牛肉麵','清爽湯底與厚切牛肉。',19000,'https://baiye-beef-noodle-demo.pages.dev/assets/demo-beef-noodle/tendon-bowl.svg',1,40,'active',1,CURRENT_TIMESTAMP),
('bn_item_05','demo_beef_noodle','bn_cat_beef','BN-005','牛筋麵','軟嫩牛筋搭配慢燉湯頭。',23000,'https://baiye-beef-noodle-demo.pages.dev/assets/demo-beef-noodle/tendon-bowl.svg',1,50,'active',1,CURRENT_TIMESTAMP),
('bn_item_06','demo_beef_noodle','bn_cat_noodles','BN-006','紅油牛肉乾拌麵','香辣紅油拌麵配牛肉。',16000,'https://baiye-beef-noodle-demo.pages.dev/assets/demo-beef-noodle/dry-noodle.svg',1,10,'active',1,CURRENT_TIMESTAMP),
('bn_item_07','demo_beef_noodle','bn_cat_noodles','BN-007','麻醬麵','濃香芝麻醬拌麵。',8000,'https://baiye-beef-noodle-demo.pages.dev/assets/demo-beef-noodle/dry-noodle.svg',1,20,'active',1,CURRENT_TIMESTAMP),
('bn_item_08','demo_beef_noodle','bn_cat_noodles','BN-008','牛肉湯','慢燉牛肉湯。',12000,'https://baiye-beef-noodle-demo.pages.dev/assets/demo-beef-noodle/braised-bowl.svg',1,30,'active',1,CURRENT_TIMESTAMP),
('bn_item_09','demo_beef_noodle','bn_cat_noodles','BN-009','貢丸湯','家常清湯與貢丸。',6000,'https://baiye-beef-noodle-demo.pages.dev/assets/demo-beef-noodle/braised-bowl.svg',1,40,'active',1,CURRENT_TIMESTAMP),
('bn_item_10','demo_beef_noodle','bn_cat_sides','BN-010','滷蛋','香滷入味。',2000,'https://baiye-beef-noodle-demo.pages.dev/assets/demo-beef-noodle/side-dish.svg',1,10,'active',1,CURRENT_TIMESTAMP),
('bn_item_11','demo_beef_noodle','bn_cat_sides','BN-011','燙青菜','當日青菜。',5000,'https://baiye-beef-noodle-demo.pages.dev/assets/demo-beef-noodle/side-dish.svg',1,20,'active',1,CURRENT_TIMESTAMP),
('bn_item_12','demo_beef_noodle','bn_cat_sides','BN-012','滷豆干','台式滷味。',4000,'https://baiye-beef-noodle-demo.pages.dev/assets/demo-beef-noodle/side-dish.svg',1,30,'active',1,CURRENT_TIMESTAMP),
('bn_item_13','demo_beef_noodle','bn_cat_sides','BN-013','涼拌小黃瓜','爽脆開胃。',4500,'https://baiye-beef-noodle-demo.pages.dev/assets/demo-beef-noodle/side-dish.svg',1,40,'active',1,CURRENT_TIMESTAMP),
('bn_item_14','demo_beef_noodle','bn_cat_sides','BN-014','牛肚拼盤','滷牛肚拼盤。',10000,'https://baiye-beef-noodle-demo.pages.dev/assets/demo-beef-noodle/side-dish.svg',1,50,'active',1,CURRENT_TIMESTAMP),
('bn_item_15','demo_beef_noodle','bn_cat_drinks','BN-015','古早味紅茶','示範茶飲，不進行實際交易。',3500,'https://baiye-beef-noodle-demo.pages.dev/assets/demo-beef-noodle/side-dish.svg',1,10,'active',0,CURRENT_TIMESTAMP),
('bn_item_16','demo_beef_noodle','bn_cat_drinks','BN-016','冬瓜茶','清涼冬瓜茶。',3500,'https://baiye-beef-noodle-demo.pages.dev/assets/demo-beef-noodle/side-dish.svg',1,20,'active',0,CURRENT_TIMESTAMP),
('bn_item_17','demo_beef_noodle','bn_cat_drinks','BN-017','無糖茶','無糖清茶。',3000,'https://baiye-beef-noodle-demo.pages.dev/assets/demo-beef-noodle/side-dish.svg',1,30,'active',0,CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO merchant_menu_option_groups(id,merchant_id,name,selection_type,required,min_select,max_select,sort_order,active,updated_at) VALUES
('bn_opt_noodle','demo_beef_noodle','麵條','single',1,1,1,10,1,CURRENT_TIMESTAMP),
('bn_opt_spicy','demo_beef_noodle','辣度','single',1,1,1,20,1,CURRENT_TIMESTAMP),
('bn_opt_size','demo_beef_noodle','麵量','single',1,1,1,30,1,CURRENT_TIMESTAMP),
('bn_opt_extra','demo_beef_noodle','加料','multiple',0,0,3,40,1,CURRENT_TIMESTAMP),
('bn_opt_pickles','demo_beef_noodle','酸菜','single',0,0,1,50,1,CURRENT_TIMESTAMP);

INSERT OR REPLACE INTO merchant_menu_option_values(id,merchant_id,group_id,name,price_delta_minor,sort_order,active,updated_at) VALUES
('bn_val_thin','demo_beef_noodle','bn_opt_noodle','細麵',0,10,1,CURRENT_TIMESTAMP),
('bn_val_wide','demo_beef_noodle','bn_opt_noodle','寬麵',0,20,1,CURRENT_TIMESTAMP),
('bn_val_nospicy','demo_beef_noodle','bn_opt_spicy','不辣',0,10,1,CURRENT_TIMESTAMP),
('bn_val_mild','demo_beef_noodle','bn_opt_spicy','小辣',0,20,1,CURRENT_TIMESTAMP),
('bn_val_medium','demo_beef_noodle','bn_opt_spicy','中辣',0,30,1,CURRENT_TIMESTAMP),
('bn_val_hot','demo_beef_noodle','bn_opt_spicy','大辣',0,40,1,CURRENT_TIMESTAMP),
('bn_val_normal','demo_beef_noodle','bn_opt_size','正常',0,10,1,CURRENT_TIMESTAMP),
('bn_val_more_noodle','demo_beef_noodle','bn_opt_size','加麵',2000,20,1,CURRENT_TIMESTAMP),
('bn_val_more_beef','demo_beef_noodle','bn_opt_extra','加牛肉',6000,10,1,CURRENT_TIMESTAMP),
('bn_val_more_tendon','demo_beef_noodle','bn_opt_extra','加牛筋',7000,20,1,CURRENT_TIMESTAMP),
('bn_val_more_egg','demo_beef_noodle','bn_opt_extra','加滷蛋',2000,30,1,CURRENT_TIMESTAMP),
('bn_val_more_pickles','demo_beef_noodle','bn_opt_extra','加酸菜',1000,40,1,CURRENT_TIMESTAMP),
('bn_val_no_pickles','demo_beef_noodle','bn_opt_pickles','不加',0,10,1,CURRENT_TIMESTAMP),
('bn_val_regular_pickles','demo_beef_noodle','bn_opt_pickles','正常',0,20,1,CURRENT_TIMESTAMP),
('bn_val_double_pickles','demo_beef_noodle','bn_opt_pickles','多一份',1000,30,1,CURRENT_TIMESTAMP);

DELETE FROM merchant_menu_item_option_groups WHERE merchant_id='demo_beef_noodle';
INSERT INTO merchant_menu_item_option_groups(merchant_id,menu_item_id,option_group_id,sort_order)
SELECT 'demo_beef_noodle',i.id,g.id,g.sort_order
FROM merchant_menu_items i CROSS JOIN merchant_menu_option_groups g
WHERE i.merchant_id='demo_beef_noodle' AND i.id IN('bn_item_01','bn_item_02','bn_item_03','bn_item_04','bn_item_05')
  AND g.merchant_id='demo_beef_noodle';

INSERT OR REPLACE INTO merchant_ordering_qr_codes(id,merchant_id,code,label,purpose,table_label,active,expires_at,updated_at) VALUES
('bn_qr_a1','demo_beef_noodle','myJghWaqQbCwMInWWsBUf2xRwsR02saT','A1 桌','dine_in','A1',1,NULL,CURRENT_TIMESTAMP),
('bn_qr_a2','demo_beef_noodle','FYBPEA-F44pPvPGkkP3d2vecgjTdFTPk','A2 桌','dine_in','A2',1,NULL,CURRENT_TIMESTAMP),
('bn_qr_a3','demo_beef_noodle','Vs8Jzt4-ZGYfXy-10_Ug_rjTGC2pJYek','A3 桌','dine_in','A3',1,NULL,CURRENT_TIMESTAMP),
('bn_qr_a4','demo_beef_noodle','JuGRh32bvS2poge6oYm4jSxIVY0vMJQR','A4 桌','dine_in','A4',1,NULL,CURRENT_TIMESTAMP),
('bn_qr_a5','demo_beef_noodle','xiP0xKOpDqaV8NItRLV25loOxWyIH7Ef','A5 桌','dine_in','A5',1,NULL,CURRENT_TIMESTAMP),
('bn_qr_takeaway','demo_beef_noodle','GgMBur68drtdBZZlndLJ6iq-n3QiU9hk','外帶點餐','takeaway',NULL,1,NULL,CURRENT_TIMESTAMP);
