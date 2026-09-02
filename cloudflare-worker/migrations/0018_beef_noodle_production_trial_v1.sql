-- Production-only targeted release for the official Baiye beef noodle trial.
-- Every seed mutation is scoped to demo_beef_noodle and is idempotent.
PRAGMA foreign_keys=ON;

ALTER TABLE merchants ADD COLUMN demo_environment INTEGER NOT NULL DEFAULT 0 CHECK(demo_environment IN(0,1));
ALTER TABLE merchants ADD COLUMN official_demo INTEGER NOT NULL DEFAULT 0 CHECK(official_demo IN(0,1));
ALTER TABLE merchants ADD COLUMN demo_contract_exemption INTEGER NOT NULL DEFAULT 0 CHECK(demo_contract_exemption IN(0,1));
ALTER TABLE merchant_users ADD COLUMN phone_normalized TEXT;
ALTER TABLE merchant_users ADD COLUMN platform_member_id TEXT REFERENCES platform_members(id);
ALTER TABLE merchant_users ADD COLUMN auth_mode TEXT NOT NULL DEFAULT 'password' CHECK(auth_mode IN('password','passwordless_phone'));
ALTER TABLE merchant_user_sessions ADD COLUMN platform_member_id TEXT REFERENCES platform_members(id);
ALTER TABLE merchant_user_sessions ADD COLUMN assurance_level TEXT NOT NULL DEFAULT 'trusted_existing_session' CHECK(assurance_level IN('activation_invite','verified_phone','trusted_existing_session'));
ALTER TABLE merchant_user_sessions ADD COLUMN issued_via TEXT NOT NULL DEFAULT 'legacy_password';
ALTER TABLE merchant_food_orders ADD COLUMN demo_reset_at TEXT;
ALTER TABLE merchant_bookings ADD COLUMN demo_reset_at TEXT;

CREATE TABLE production_demo_merchants(
  merchant_id TEXT PRIMARY KEY REFERENCES merchants(id),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN(0,1)),
  official_demo INTEGER NOT NULL DEFAULT 1 CHECK(official_demo=1),
  demo_contract_exemption INTEGER NOT NULL DEFAULT 1 CHECK(demo_contract_exemption=1),
  display_badge TEXT NOT NULL DEFAULT '百工官方示範',
  reset_generation INTEGER NOT NULL DEFAULT 0,
  last_reset_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(merchant_id='demo_beef_noodle')
);

CREATE TABLE production_demo_access_credentials(
  merchant_id TEXT PRIMARY KEY REFERENCES production_demo_merchants(merchant_id),
  platform_member_id TEXT NOT NULL REFERENCES platform_members(id),
  phone_hash TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  code_salt TEXT NOT NULL,
  code_iterations INTEGER NOT NULL DEFAULT 600000 CHECK(code_iterations>=600000),
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK(failed_attempts>=0),
  locked_until TEXT,
  status TEXT NOT NULL DEFAULT 'pending_provision' CHECK(status IN('pending_provision','active','disabled')),
  provisioned_at TEXT,
  last_used_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(merchant_id='demo_beef_noodle')
);

CREATE TABLE production_demo_auth_events(
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL CHECK(merchant_id='demo_beef_noodle'),
  platform_member_id TEXT,
  phone_hash TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN('login_failed','login_rate_limited','login_success','session_rotated','demo_reset')),
  ip_hash TEXT,
  user_agent_hash TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_production_demo_auth_events ON production_demo_auth_events(merchant_id,created_at);

CREATE TABLE merchant_owner_links(
  merchant_id TEXT NOT NULL,
  merchant_user_id TEXT NOT NULL,
  platform_member_id TEXT NOT NULL,
  phone_normalized TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner' CHECK(role='owner'),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','suspended','disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(merchant_id,merchant_user_id),
  UNIQUE(merchant_id,platform_member_id),
  UNIQUE(merchant_id,phone_normalized),
  FOREIGN KEY(merchant_id,merchant_user_id) REFERENCES merchant_users(merchant_id,id),
  FOREIGN KEY(platform_member_id) REFERENCES platform_members(id)
);
CREATE INDEX idx_merchant_owner_member ON merchant_owner_links(platform_member_id,status,merchant_id);
CREATE TRIGGER trg_merchant_owner_link_identity_immutable BEFORE UPDATE OF merchant_id,merchant_user_id,platform_member_id,phone_normalized,role ON merchant_owner_links BEGIN SELECT RAISE(ABORT,'MERCHANT_OWNER_IDENTITY_IMMUTABLE'); END;
CREATE TRIGGER trg_merchant_owner_link_delete BEFORE DELETE ON merchant_owner_links BEGIN SELECT RAISE(ABORT,'MERCHANT_OWNER_LINK_IMMUTABLE'); END;

CREATE TABLE merchant_admin_profiles(
  merchant_id TEXT PRIMARY KEY REFERENCES merchants(id), brand_name TEXT,business_description TEXT,
  support_phone TEXT,support_email TEXT,business_address TEXT,business_hours TEXT,transportation_info TEXT,
  social_links_json TEXT NOT NULL DEFAULT '{}',homepage_notice TEXT,
  shopping_cart_enabled INTEGER NOT NULL DEFAULT 0 CHECK(shopping_cart_enabled IN(0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE merchant_admin_audit_logs(
  id TEXT PRIMARY KEY,actor_member_id TEXT,merchant_id TEXT NOT NULL REFERENCES merchants(id),role TEXT NOT NULL,
  action TEXT NOT NULL,resource_type TEXT NOT NULL,resource_id TEXT,before_json TEXT,after_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_merchant_admin_audit_merchant ON merchant_admin_audit_logs(merchant_id,created_at);

CREATE TABLE merchant_line_integrations(
  merchant_id TEXT PRIMARY KEY REFERENCES merchants(id),enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN(0,1)),
  basic_id TEXT,display_name TEXT,add_friend_url TEXT,integration_mode TEXT NOT NULL DEFAULT 'add_friend_link',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE merchant_product_assets(
  id TEXT PRIMARY KEY,merchant_id TEXT NOT NULL REFERENCES merchants(id),product_id TEXT NOT NULL,object_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL CHECK(content_type IN('image/jpeg','image/png','image/webp')),
  byte_size INTEGER NOT NULL CHECK(byte_size BETWEEN 1 AND 5242880),status TEXT NOT NULL DEFAULT 'staged' CHECK(status IN('staged','attached','deleted')),
  created_by_user_id TEXT NOT NULL REFERENCES merchant_users(id),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,attached_at TEXT,deleted_at TEXT,
  UNIQUE(merchant_id,id),FOREIGN KEY(merchant_id,product_id) REFERENCES merchant_menu_items(merchant_id,id)
);
CREATE INDEX idx_merchant_product_assets_product ON merchant_product_assets(merchant_id,product_id,status,created_at);

CREATE TABLE merchant_inventory_items(
  id TEXT PRIMARY KEY,merchant_id TEXT NOT NULL,menu_item_id TEXT NOT NULL,
  stock_on_hand INTEGER NOT NULL CHECK(typeof(stock_on_hand)='integer' AND stock_on_hand>=0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK(typeof(low_stock_threshold)='integer' AND low_stock_threshold>=0),
  inventory_enabled INTEGER NOT NULL DEFAULT 1 CHECK(inventory_enabled IN(0,1)),notes TEXT,reset_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,id),FOREIGN KEY(merchant_id,menu_item_id) REFERENCES merchant_menu_items(merchant_id,id)
);
CREATE TABLE merchant_inventory_movements(
  id TEXT PRIMARY KEY,merchant_id TEXT NOT NULL,inventory_item_id TEXT NOT NULL,menu_item_id TEXT NOT NULL,
  order_id TEXT,order_item_id TEXT,movement_type TEXT NOT NULL CHECK(movement_type IN('INITIAL','RESTOCK','ORDER_DEDUCTION','ORDER_RESTORE','MANUAL_ADJUSTMENT')),
  quantity_delta INTEGER NOT NULL CHECK(typeof(quantity_delta)='integer' AND quantity_delta<>0),
  quantity_before INTEGER NOT NULL CHECK(quantity_before>=0),quantity_after INTEGER NOT NULL CHECK(quantity_after>=0),
  reason TEXT,actor_type TEXT NOT NULL CHECK(actor_type IN('customer','merchant','admin','system')),actor_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(merchant_id,inventory_item_id) REFERENCES merchant_inventory_items(merchant_id,id),
  FOREIGN KEY(order_id) REFERENCES merchant_food_orders(id),FOREIGN KEY(order_item_id) REFERENCES merchant_food_order_items(id),
  CHECK(quantity_after=quantity_before+quantity_delta)
);
CREATE INDEX idx_inventory_items_merchant ON merchant_inventory_items(merchant_id,reset_at,inventory_enabled,stock_on_hand);
CREATE UNIQUE INDEX uq_active_inventory_menu_item ON merchant_inventory_items(merchant_id,menu_item_id) WHERE reset_at IS NULL;
CREATE INDEX idx_inventory_movements_item ON merchant_inventory_movements(merchant_id,inventory_item_id,created_at DESC);
CREATE UNIQUE INDEX uq_inventory_order_deduction ON merchant_inventory_movements(order_item_id,movement_type) WHERE order_item_id IS NOT NULL AND movement_type='ORDER_DEDUCTION';
CREATE UNIQUE INDEX uq_inventory_order_restore ON merchant_inventory_movements(order_item_id,movement_type) WHERE order_item_id IS NOT NULL AND movement_type='ORDER_RESTORE';
CREATE TRIGGER trg_inventory_movements_no_update BEFORE UPDATE ON merchant_inventory_movements BEGIN SELECT RAISE(ABORT,'INVENTORY_LEDGER_IMMUTABLE'); END;
CREATE TRIGGER trg_inventory_movements_no_delete BEFORE DELETE ON merchant_inventory_movements BEGIN SELECT RAISE(ABORT,'INVENTORY_LEDGER_IMMUTABLE'); END;

INSERT OR IGNORE INTO merchant_permissions(code,module,description) VALUES
 ('merchant.profile.read','merchant','查看商家基本資料'),('merchant.profile.write','merchant','編輯示範商家資料'),
 ('merchant.products.read','merchant','查看商品與菜單'),('merchant.products.write','merchant','編輯商品與菜單'),
 ('merchant.bookings.read','merchant','查看本商家預約'),('merchant.bookings.write','merchant','管理本商家預約'),
 ('merchant.members.read','merchant','查看本商家會員'),('merchant.orders.read','merchant','查看本商家訂單'),
 ('merchant.orders.write','merchant','管理本商家訂單'),('merchant.inventory.read','merchant','查看本商家庫存'),
 ('merchant.inventory.write','merchant','管理本商家庫存');
