PRAGMA foreign_keys=OFF;
-- Isolated Soft-POS demo only.  This file is never a Production migration.

INSERT INTO merchants(id,merchant_code,name,status)
VALUES('demo_soft_pos_foodstall','DEMO-SOFTPOS','百工鹹酥雞｜Soft-POS 示範','active');

INSERT INTO merchant_ordering_settings(merchant_id,display_name,enabled,accepting_orders,ordering_open,timezone)
VALUES('demo_soft_pos_foodstall','百工鹹酥雞｜Soft-POS 示範',1,1,1,'Asia/Taipei');

INSERT INTO merchant_pos_profiles(merchant_id,enabled,soft_pos_enabled,business_mode,kitchen_enabled,inventory_mode,printer_adapter)
VALUES('demo_soft_pos_foodstall',1,1,'food_stall',1,'simple_stock','browser_print');

INSERT INTO merchant_menu_categories(id,merchant_id,name,sort_order,active) VALUES
('sp-cat-main','demo_soft_pos_foodstall','招牌炸物',1,1),
('sp-cat-side','demo_soft_pos_foodstall','小點',2,1),
('sp-cat-drink','demo_soft_pos_foodstall','飲品',3,1);

INSERT INTO merchant_menu_items(id,merchant_id,category_id,sku,name,price_minor,cost_minor,status,available,sort_order) VALUES
('sp-chicken','demo_soft_pos_foodstall','sp-cat-main','SNACK-001','雞排',8000,3500,'active',1,1),
('sp-salty','demo_soft_pos_foodstall','sp-cat-main','SNACK-002','鹹酥雞',7000,3000,'active',1,2),
('sp-tempura','demo_soft_pos_foodstall','sp-cat-main','SNACK-003','甜不辣',4500,1600,'active',1,3),
('sp-rice','demo_soft_pos_foodstall','sp-cat-main','SNACK-004','米血',3500,1200,'active',1,4),
('sp-tofu','demo_soft_pos_foodstall','sp-cat-main','SNACK-005','百頁豆腐',4500,1800,'active',1,5),
('sp-squid','demo_soft_pos_foodstall','sp-cat-main','SNACK-006','魷魚',7500,3400,'active',1,6),
('sp-bean','demo_soft_pos_foodstall','sp-cat-side','SNACK-007','四季豆',5000,2200,'active',1,1),
('sp-mushroom','demo_soft_pos_foodstall','sp-cat-side','SNACK-008','杏鮑菇',5500,2500,'active',1,2),
('sp-fries','demo_soft_pos_foodstall','sp-cat-side','SNACK-009','薯條',4500,1600,'active',1,3),
('sp-radish','demo_soft_pos_foodstall','sp-cat-side','SNACK-010','蘿蔔糕',4500,1800,'active',1,4),
('sp-blacktea','demo_soft_pos_foodstall','sp-cat-drink','DRINK-001','古早味紅茶',3000,700,'active',1,1),
('sp-wintermelon','demo_soft_pos_foodstall','sp-cat-drink','DRINK-002','冬瓜茶',3000,700,'active',1,2);

INSERT INTO merchant_menu_option_groups(id,merchant_id,name,selection_type,required,min_select,max_select,sort_order,active) VALUES
('sp-spicy','demo_soft_pos_foodstall','辣度','single',1,1,1,1,1),
('sp-toppings','demo_soft_pos_foodstall','加料','multiple',0,0,2,2,1);
INSERT INTO merchant_menu_option_values(id,merchant_id,group_id,name,price_delta_minor,sort_order,active) VALUES
('sp-no-spicy','demo_soft_pos_foodstall','sp-spicy','不辣',0,1,1),
('sp-mild','demo_soft_pos_foodstall','sp-spicy','小辣',0,2,1),
('sp-hot','demo_soft_pos_foodstall','sp-spicy','大辣',0,3,1),
('sp-garlic','demo_soft_pos_foodstall','sp-toppings','加蒜',0,1,1),
('sp-basil','demo_soft_pos_foodstall','sp-toppings','九層塔',0,2,1),
('sp-cheese','demo_soft_pos_foodstall','sp-toppings','起司粉',1000,3,1);
INSERT INTO merchant_menu_item_option_groups(merchant_id,menu_item_id,option_group_id,sort_order)
SELECT 'demo_soft_pos_foodstall',id,'sp-spicy',1 FROM merchant_menu_items WHERE merchant_id='demo_soft_pos_foodstall' AND category_id<>'sp-cat-drink';
INSERT INTO merchant_menu_item_option_groups(merchant_id,menu_item_id,option_group_id,sort_order)
SELECT 'demo_soft_pos_foodstall',id,'sp-toppings',2 FROM merchant_menu_items WHERE merchant_id='demo_soft_pos_foodstall' AND category_id<>'sp-cat-drink';

INSERT INTO inventory_locations(id,merchant_id,name) VALUES('sp-main-stock','demo_soft_pos_foodstall','主庫存');
INSERT INTO inventory_items(id,merchant_id,menu_item_id,sku,name,safety_stock_minor) SELECT 'stock-'||id,merchant_id,id,sku,name,5 FROM merchant_menu_items WHERE merchant_id='demo_soft_pos_foodstall';
INSERT INTO inventory_transactions(id,merchant_id,location_id,inventory_item_id,transaction_type,quantity_delta_minor,idempotency_key,actor_type,note)
SELECT 'opening-'||id,'demo_soft_pos_foodstall','sp-main-stock',id,'purchase',50,'seed-opening-'||id,'system','STAGING 開店庫存' FROM inventory_items WHERE merchant_id='demo_soft_pos_foodstall';

PRAGMA foreign_keys=ON;
