-- Immutable golden option and profile snapshot for the official demo.
CREATE TABLE production_demo_golden_option_groups AS SELECT * FROM merchant_menu_option_groups WHERE merchant_id='demo_beef_noodle';
CREATE TABLE production_demo_golden_option_values AS SELECT * FROM merchant_menu_option_values WHERE merchant_id='demo_beef_noodle';
CREATE TABLE production_demo_golden_item_option_groups AS SELECT * FROM merchant_menu_item_option_groups WHERE merchant_id='demo_beef_noodle';
CREATE TABLE production_demo_golden_admin_profile AS SELECT * FROM merchant_admin_profiles WHERE merchant_id='demo_beef_noodle';
