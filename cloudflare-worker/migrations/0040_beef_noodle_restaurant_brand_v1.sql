-- 百工牛肉麵正式菜單品牌化：移除誤建測試品項、統一分類、換上各品項專屬圖片。
UPDATE merchant_menu_categories
SET name = '牛肉麵', updated_at = CURRENT_TIMESTAMP
WHERE merchant_id = 'demo_beef_noodle' AND id = 'bn_cat_beef';

UPDATE merchant_menu_categories
SET active = 0, archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
WHERE merchant_id = 'demo_beef_noodle'
  AND id IN ('menucat_bc7f3643-ca73-40e6-8a94-38a088eb6279', 'menucat_4a78d839-1656-4bb5-887a-21e4fe5edcb8');

UPDATE merchant_menu_items
SET status = 'archived', available = 0, archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
WHERE merchant_id = 'demo_beef_noodle'
  AND id IN ('menuitem_5f1912f4-d270-4166-9a18-b7e7b542d1d3', 'menuitem_76130d61-7816-4f7d-8b07-1d44a155d74d');

UPDATE merchant_menu_items SET image_url = 'https://baiyeconnect.com/assets/beef-noodle-menu/signature-braised-beef-noodles.webp', updated_at = CURRENT_TIMESTAMP WHERE id = 'bn_item_01';
UPDATE merchant_menu_items SET image_url = 'https://baiyeconnect.com/assets/beef-noodle-menu/half-tendon-beef-noodles.webp', updated_at = CURRENT_TIMESTAMP WHERE id = 'bn_item_02';
UPDATE merchant_menu_items SET image_url = 'https://baiyeconnect.com/assets/beef-noodle-menu/extra-beef-noodles.webp', updated_at = CURRENT_TIMESTAMP WHERE id = 'bn_item_03';
UPDATE merchant_menu_items SET image_url = 'https://baiyeconnect.com/assets/beef-noodle-menu/clear-broth-beef-noodles.webp', updated_at = CURRENT_TIMESTAMP WHERE id = 'bn_item_04';
UPDATE merchant_menu_items SET image_url = 'https://baiyeconnect.com/assets/beef-noodle-menu/beef-tendon-noodles.webp', updated_at = CURRENT_TIMESTAMP WHERE id = 'bn_item_05';
UPDATE merchant_menu_items SET image_url = 'https://baiyeconnect.com/assets/beef-noodle-menu/chili-beef-dry-noodles.webp', updated_at = CURRENT_TIMESTAMP WHERE id = 'bn_item_06';
UPDATE merchant_menu_items SET image_url = 'https://baiyeconnect.com/assets/beef-noodle-menu/sesame-noodles.webp', updated_at = CURRENT_TIMESTAMP WHERE id = 'bn_item_07';
UPDATE merchant_menu_items SET image_url = 'https://baiyeconnect.com/assets/beef-noodle-menu/beef-soup.webp', updated_at = CURRENT_TIMESTAMP WHERE id = 'bn_item_08';
UPDATE merchant_menu_items SET image_url = 'https://baiyeconnect.com/assets/beef-noodle-menu/meatball-soup.webp', updated_at = CURRENT_TIMESTAMP WHERE id = 'bn_item_09';
UPDATE merchant_menu_items SET image_url = 'https://baiyeconnect.com/assets/beef-noodle-menu/braised-egg.webp', updated_at = CURRENT_TIMESTAMP WHERE id = 'bn_item_10';
UPDATE merchant_menu_items SET image_url = 'https://baiyeconnect.com/assets/beef-noodle-menu/blanched-greens.webp', updated_at = CURRENT_TIMESTAMP WHERE id = 'bn_item_11';
UPDATE merchant_menu_items SET image_url = 'https://baiyeconnect.com/assets/beef-noodle-menu/braised-tofu.webp', updated_at = CURRENT_TIMESTAMP WHERE id = 'bn_item_12';
UPDATE merchant_menu_items SET image_url = 'https://baiyeconnect.com/assets/beef-noodle-menu/cucumber-salad.webp', updated_at = CURRENT_TIMESTAMP WHERE id = 'bn_item_13';
UPDATE merchant_menu_items SET image_url = 'https://baiyeconnect.com/assets/beef-noodle-menu/beef-tripe-platter.webp', updated_at = CURRENT_TIMESTAMP WHERE id = 'bn_item_14';
UPDATE merchant_menu_items SET image_url = 'https://baiyeconnect.com/assets/beef-noodle-menu/black-tea.webp', updated_at = CURRENT_TIMESTAMP WHERE id = 'bn_item_15';
UPDATE merchant_menu_items SET image_url = 'https://baiyeconnect.com/assets/beef-noodle-menu/winter-melon-tea.webp', updated_at = CURRENT_TIMESTAMP WHERE id = 'bn_item_16';
UPDATE merchant_menu_items SET image_url = 'https://baiyeconnect.com/assets/beef-noodle-menu/unsweetened-tea.webp', updated_at = CURRENT_TIMESTAMP WHERE id = 'bn_item_17';
UPDATE merchant_menu_items SET image_url = 'https://baiyeconnect.com/assets/beef-noodle-menu/braised-beef-rice.webp', updated_at = CURRENT_TIMESTAMP WHERE id = 'bn_item_18';
UPDATE merchant_menu_items SET image_url = 'https://baiyeconnect.com/assets/beef-noodle-menu/hot-sour-soup.webp', updated_at = CURRENT_TIMESTAMP WHERE id = 'bn_item_19';
UPDATE merchant_menu_items SET image_url = 'https://baiyeconnect.com/assets/beef-noodle-menu/plum-iced-tea.webp', updated_at = CURRENT_TIMESTAMP WHERE id = 'bn_item_20';

UPDATE production_demo_golden_menu_items
SET image_url = (SELECT m.image_url FROM merchant_menu_items m WHERE m.id = production_demo_golden_menu_items.id),
    updated_at = CURRENT_TIMESTAMP
WHERE id BETWEEN 'bn_item_01' AND 'bn_item_20';
