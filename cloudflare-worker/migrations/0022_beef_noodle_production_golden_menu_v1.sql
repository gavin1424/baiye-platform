-- Immutable golden category and menu snapshot for the official demo.
CREATE TABLE production_demo_golden_menu_categories AS SELECT * FROM merchant_menu_categories WHERE merchant_id='demo_beef_noodle';
CREATE TABLE production_demo_golden_menu_items AS SELECT * FROM merchant_menu_items WHERE merchant_id='demo_beef_noodle';
