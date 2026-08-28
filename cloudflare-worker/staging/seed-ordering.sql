-- Synthetic staging-only data. Never apply to Production.
INSERT INTO merchants(id,merchant_code,name,status,email) VALUES('staging_ordering_merchant','STAGING-ORDERING','STAGING｜QR 點餐驗收餐廳','active','ordering-owner@example.test');
INSERT INTO merchant_ordering_settings(merchant_id,display_name,enabled,accepting_orders,ordering_open,order_number_prefix,temporary_closed_message) VALUES('staging_ordering_merchant','STAGING｜QR 點餐驗收餐廳',1,1,1,'STG','STAGING 店家目前暫停接單');

INSERT INTO merchant_ordering_qr_codes(id,merchant_id,code,label,purpose,table_label) VALUES
('stg_qr_a1','staging_ordering_merchant','stg_Qx7A1p9Lm2Vr8Kf4Nz6T','A1桌點餐','dine_in','A1'),
('stg_qr_a2','staging_ordering_merchant','stg_Wm3B2q8Xp5Hs9Ld7Rc1K','A2桌點餐','dine_in','A2'),
('stg_qr_a3','staging_ordering_merchant','stg_Kr6C3n1Vt8Yp4Gm9Qw2D','A3桌點餐','dine_in','A3'),
('stg_qr_a4','staging_ordering_merchant','stg_Hz9D4s7Jk2Nb5Xc1Vq8M','A4桌點餐','dine_in','A4'),
('stg_qr_a5','staging_ordering_merchant','stg_Pt2E5m8Lc3Rw7Ka9Bn1Y','A5桌點餐','dine_in','A5'),
('stg_qr_a6','staging_ordering_merchant','stg_Nv8F6q2Zh9Xs4Jm1Kd7C','A6桌點餐','dine_in','A6'),
('stg_qr_a7','staging_ordering_merchant','stg_Cy1G7r5Wp3Ln8Vq2Hx9M','A7桌點餐','dine_in','A7'),
('stg_qr_a8','staging_ordering_merchant','stg_Bk4H9m1Ts6Qx2Nc8Vr5L','A8桌點餐','dine_in','A8'),
('stg_qr_a9','staging_ordering_merchant','stg_Rq7J2p6Yv1Md9Kx4Cn8W','A9桌點餐','dine_in','A9'),
('stg_qr_a10','staging_ordering_merchant','stg_Lm5K8s3Xq7Vn1Pc9Hr2D','A10桌點餐','dine_in','A10');

INSERT INTO merchant_menu_categories(id,merchant_id,name,description,sort_order) VALUES
('stg_cat_main','staging_ordering_merchant','主餐','現點現做餐點',1),
('stg_cat_drink','staging_ordering_merchant','飲品','冷熱飲品',2),
('stg_cat_side','staging_ordering_merchant','點心','搭配小食',3);

INSERT INTO merchant_menu_items(id,merchant_id,category_id,sku,name,description,price_minor,sort_order,status,allow_customer_note,daily_limit) VALUES
('stg_item_01','staging_ordering_merchant','stg_cat_main','STG-M01','招牌牛肉飯','STAGING 測試品項',16000,1,'active',1,30),
('stg_item_02','staging_ordering_merchant','stg_cat_main','STG-M02','照燒雞腿飯','STAGING 測試品項',15000,2,'active',1,30),
('stg_item_03','staging_ordering_merchant','stg_cat_main','STG-M03','蔬食咖哩飯','STAGING 測試品項',13000,3,'active',1,20),
('stg_item_04','staging_ordering_merchant','stg_cat_main','STG-M04','海鮮烏龍麵','STAGING 測試品項',18000,4,'active',1,20),
('stg_item_05','staging_ordering_merchant','stg_cat_drink','STG-D01','紅茶','STAGING 測試飲品',4000,1,'active',1,50),
('stg_item_06','staging_ordering_merchant','stg_cat_drink','STG-D02','鮮奶茶','STAGING 測試飲品',6500,2,'active',1,50),
('stg_item_07','staging_ordering_merchant','stg_cat_drink','STG-D03','美式咖啡','STAGING 測試飲品',7000,3,'active',1,40),
('stg_item_08','staging_ordering_merchant','stg_cat_drink','STG-D04','檸檬氣泡飲','STAGING 測試飲品',8000,4,'active',1,40),
('stg_item_09','staging_ordering_merchant','stg_cat_side','STG-S01','酥炸薯條','STAGING 測試點心',6000,1,'active',1,30),
('stg_item_10','staging_ordering_merchant','stg_cat_side','STG-S02','起司可樂餅','STAGING 測試點心',7000,2,'active',1,30),
('stg_item_11','staging_ordering_merchant','stg_cat_side','STG-S03','今日濃湯','STAGING 測試點心',5000,3,'active',1,20),
('stg_item_12','staging_ordering_merchant','stg_cat_side','STG-S04','焦糖布丁','STAGING 測試點心',5500,4,'active',1,20);

INSERT INTO merchant_menu_option_groups(id,merchant_id,name,selection_type,required,min_select,max_select,sort_order) VALUES
('stg_opt_sweet','staging_ordering_merchant','甜度','single',1,1,1,1),
('stg_opt_ice','staging_ordering_merchant','冰量','single',1,1,1,2),
('stg_opt_addon','staging_ordering_merchant','加料','multiple',0,0,2,3),
('stg_opt_size','staging_ordering_merchant','尺寸','single',1,1,1,4),
('stg_opt_spicy','staging_ordering_merchant','辣度','single',0,0,1,5);
INSERT INTO merchant_menu_option_values(id,merchant_id,group_id,name,price_delta_minor,sort_order) VALUES
('stg_val_s0','staging_ordering_merchant','stg_opt_sweet','無糖',0,1),('stg_val_s1','staging_ordering_merchant','stg_opt_sweet','半糖',0,2),('stg_val_s2','staging_ordering_merchant','stg_opt_sweet','正常甜',0,3),
('stg_val_i0','staging_ordering_merchant','stg_opt_ice','去冰',0,1),('stg_val_i1','staging_ordering_merchant','stg_opt_ice','少冰',0,2),('stg_val_i2','staging_ordering_merchant','stg_opt_ice','正常冰',0,3),
('stg_val_a1','staging_ordering_merchant','stg_opt_addon','珍珠',1000,1),('stg_val_a2','staging_ordering_merchant','stg_opt_addon','起司',2000,2),
('stg_val_z0','staging_ordering_merchant','stg_opt_size','中杯',0,1),('stg_val_z1','staging_ordering_merchant','stg_opt_size','大杯',2000,2),
('stg_val_p0','staging_ordering_merchant','stg_opt_spicy','不辣',0,1),('stg_val_p1','staging_ordering_merchant','stg_opt_spicy','小辣',0,2);
INSERT INTO merchant_menu_item_option_groups(merchant_id,menu_item_id,option_group_id,sort_order)
SELECT 'staging_ordering_merchant',id,'stg_opt_spicy',1 FROM merchant_menu_items WHERE merchant_id='staging_ordering_merchant' AND category_id='stg_cat_main';
INSERT INTO merchant_menu_item_option_groups(merchant_id,menu_item_id,option_group_id,sort_order)
SELECT 'staging_ordering_merchant',id,'stg_opt_sweet',1 FROM merchant_menu_items WHERE merchant_id='staging_ordering_merchant' AND category_id='stg_cat_drink';
INSERT INTO merchant_menu_item_option_groups(merchant_id,menu_item_id,option_group_id,sort_order)
SELECT 'staging_ordering_merchant',id,'stg_opt_ice',2 FROM merchant_menu_items WHERE merchant_id='staging_ordering_merchant' AND category_id='stg_cat_drink';
INSERT INTO merchant_menu_item_option_groups(merchant_id,menu_item_id,option_group_id,sort_order)
SELECT 'staging_ordering_merchant',id,'stg_opt_addon',3 FROM merchant_menu_items WHERE merchant_id='staging_ordering_merchant' AND category_id='stg_cat_drink';
INSERT INTO merchant_menu_item_option_groups(merchant_id,menu_item_id,option_group_id,sort_order) VALUES('staging_ordering_merchant','stg_item_06','stg_opt_size',4);

INSERT INTO merchant_users(id,merchant_id,email,password_hash,password_salt,password_iterations,status,display_name) VALUES('stg_owner','staging_ordering_merchant','ordering-owner@example.test','2G6puGTXU5sj1-Y4Gq7BV5R6zsDjr8WBeNAqbuqN4R4','ordering-staging-salt-v1',600000,'active','STAGING 商家老闆');
INSERT INTO merchant_roles(id,merchant_id,code,name,is_system) VALUES('stg_owner_role','staging_ordering_merchant','owner','商家擁有者',1);
INSERT INTO merchant_user_roles(merchant_id,user_id,role_id) VALUES('staging_ordering_merchant','stg_owner','stg_owner_role');
INSERT INTO merchant_role_permissions(role_id,permission_code) SELECT 'stg_owner_role',code FROM merchant_permissions WHERE module='ordering';
