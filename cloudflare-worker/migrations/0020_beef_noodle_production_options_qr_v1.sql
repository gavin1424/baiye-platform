-- Idempotent production option and QR seed scoped to demo_beef_noodle.
INSERT OR REPLACE INTO merchant_menu_option_groups(id,merchant_id,name,selection_type,required,min_select,max_select,sort_order,active,updated_at) VALUES
('bn_opt_noodle','demo_beef_noodle','麵條','single',1,1,1,10,1,CURRENT_TIMESTAMP),('bn_opt_spicy','demo_beef_noodle','辣度','single',1,1,1,20,1,CURRENT_TIMESTAMP),
('bn_opt_size','demo_beef_noodle','麵量','single',1,1,1,30,1,CURRENT_TIMESTAMP),('bn_opt_extra','demo_beef_noodle','加料','multiple',0,0,3,40,1,CURRENT_TIMESTAMP),
('bn_opt_pickles','demo_beef_noodle','酸菜','single',0,0,1,50,1,CURRENT_TIMESTAMP);
INSERT OR REPLACE INTO merchant_menu_option_values(id,merchant_id,group_id,name,price_delta_minor,sort_order,active,updated_at) VALUES
('bn_val_thin','demo_beef_noodle','bn_opt_noodle','細麵',0,10,1,CURRENT_TIMESTAMP),('bn_val_wide','demo_beef_noodle','bn_opt_noodle','寬麵',0,20,1,CURRENT_TIMESTAMP),
('bn_val_nospicy','demo_beef_noodle','bn_opt_spicy','不辣',0,10,1,CURRENT_TIMESTAMP),('bn_val_mild','demo_beef_noodle','bn_opt_spicy','小辣',0,20,1,CURRENT_TIMESTAMP),
('bn_val_medium','demo_beef_noodle','bn_opt_spicy','中辣',0,30,1,CURRENT_TIMESTAMP),('bn_val_hot','demo_beef_noodle','bn_opt_spicy','大辣',0,40,1,CURRENT_TIMESTAMP),
('bn_val_normal','demo_beef_noodle','bn_opt_size','正常',0,10,1,CURRENT_TIMESTAMP),('bn_val_more_noodle','demo_beef_noodle','bn_opt_size','加麵',2000,20,1,CURRENT_TIMESTAMP),
('bn_val_more_beef','demo_beef_noodle','bn_opt_extra','加牛肉',6000,10,1,CURRENT_TIMESTAMP),('bn_val_more_tendon','demo_beef_noodle','bn_opt_extra','加牛筋',7000,20,1,CURRENT_TIMESTAMP),
('bn_val_more_egg','demo_beef_noodle','bn_opt_extra','加滷蛋',2000,30,1,CURRENT_TIMESTAMP),('bn_val_more_pickles','demo_beef_noodle','bn_opt_extra','加酸菜',1000,40,1,CURRENT_TIMESTAMP),
('bn_val_no_pickles','demo_beef_noodle','bn_opt_pickles','不加',0,10,1,CURRENT_TIMESTAMP),('bn_val_regular_pickles','demo_beef_noodle','bn_opt_pickles','正常',0,20,1,CURRENT_TIMESTAMP),
('bn_val_double_pickles','demo_beef_noodle','bn_opt_pickles','多一份',1000,30,1,CURRENT_TIMESTAMP);
DELETE FROM merchant_menu_item_option_groups WHERE merchant_id='demo_beef_noodle';
INSERT INTO merchant_menu_item_option_groups(merchant_id,menu_item_id,option_group_id,sort_order)
SELECT 'demo_beef_noodle',i.id,g.id,g.sort_order FROM merchant_menu_items i CROSS JOIN merchant_menu_option_groups g
WHERE i.merchant_id='demo_beef_noodle' AND i.id IN('bn_item_01','bn_item_02','bn_item_03','bn_item_04','bn_item_05') AND g.merchant_id='demo_beef_noodle';

INSERT OR REPLACE INTO merchant_ordering_qr_codes(id,merchant_id,code,label,purpose,table_label,active,expires_at,updated_at) VALUES
('bn_qr_a1','demo_beef_noodle','y6KGFA0pQkEKLjf41zNBS6Nb1u1hCHUR','A1 桌','dine_in','A1',1,NULL,CURRENT_TIMESTAMP),
('bn_qr_a2','demo_beef_noodle','BglF2FaHBWxFDZxCgWXQm0rAsXAIAndg','A2 桌','dine_in','A2',1,NULL,CURRENT_TIMESTAMP),
('bn_qr_takeaway','demo_beef_noodle','g5DM12ohl0qpEMN-hqkqQbZLPqZEOeyP','外帶點餐','takeaway',NULL,1,NULL,CURRENT_TIMESTAMP);
