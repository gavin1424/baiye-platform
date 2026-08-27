import fs from "node:fs";
import crypto from "node:crypto";
import { deriveMerchantPassword } from "../cloudflare-worker/src/merchant-auth.js";

if (process.env.APP_MODE !== "staging") throw new Error("APP_MODE must be staging");
if (!process.env.STAGING_SEED_KEY || process.env.STAGING_SEED_KEY.length < 24) throw new Error("Strong one-time staging seed key required");
const output = process.argv[2];
if (!output) throw new Error("Output SQL path required");

const salt = crypto.randomBytes(18).toString("base64url");
const hash = await deriveMerchantPassword(process.env.STAGING_SEED_KEY, salt);
const modules = ["cms", "catalog", "inventory", "orders", "payments", "shipping", "invoice", "crm", "promotions", "credits", "group_buy", "affiliate", "analytics", "api", "booking", "ai", "line", "finance"];
const permissions = ["cms.manage", "catalog.manage", "inventory.manage", "orders.manage", "customers.manage", "marketing.manage", "analytics.view", "api.manage", "settings.manage"];
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;

const sql = `INSERT OR IGNORE INTO merchants(id,merchant_code,name,status) VALUES('staging_commerce_merchant','STAGINGCOMMERCE','STAGING Commerce Merchant','active');
INSERT OR IGNORE INTO merchants(id,merchant_code,name,status) VALUES('staging_isolation_merchant','STAGINGISOLATION','STAGING Isolation Merchant','active');
INSERT OR IGNORE INTO platform_plans(id,code,name,status) VALUES('staging_commerce_plan','staging_commerce','STAGING Commerce','active');
${modules.map((module) => `INSERT OR IGNORE INTO platform_modules(code,name) VALUES(${quote(module)},${quote(module)});`).join("\n")}
${modules.map((module) => `INSERT OR REPLACE INTO plan_entitlements(plan_id,module_code,enabled) VALUES('staging_commerce_plan',${quote(module)},1);`).join("\n")}
INSERT OR REPLACE INTO merchant_subscriptions(id,merchant_id,plan_id,status,starts_at) VALUES('staging_commerce_subscription','staging_commerce_merchant','staging_commerce_plan','active',CURRENT_TIMESTAMP);
INSERT OR REPLACE INTO merchant_users(id,merchant_id,email,password_hash,password_salt,password_iterations,status,display_name) VALUES('staging_commerce_owner','staging_commerce_merchant','staging-owner@invalid.example',${quote(hash)},${quote(salt)},100000,'active','STAGING Owner');
INSERT OR IGNORE INTO merchant_roles(id,merchant_id,code,name,is_system) VALUES('staging_commerce_owner_role','staging_commerce_merchant','owner','Owner',1);
${permissions.map((permission) => `INSERT OR IGNORE INTO merchant_permissions(code,module,description) VALUES(${quote(permission)},${quote(permission.split(".")[0])},${quote(permission)});\nINSERT OR IGNORE INTO merchant_role_permissions(role_id,permission_code) VALUES('staging_commerce_owner_role',${quote(permission)});`).join("\n")}
INSERT OR IGNORE INTO merchant_user_roles(merchant_id,user_id,role_id) VALUES('staging_commerce_merchant','staging_commerce_owner','staging_commerce_owner_role');
INSERT OR IGNORE INTO merchant_sites(id,merchant_id,name,status) VALUES('staging_commerce_site','staging_commerce_merchant','STAGING Commerce Site','draft');
INSERT OR IGNORE INTO commerce_inventory_locations(id,merchant_id,name,active) VALUES('staging_commerce_location','staging_commerce_merchant','STAGING Warehouse',1);
INSERT OR IGNORE INTO commerce_products(id,merchant_id,title,slug,product_type,status) VALUES('staging_isolation_product','staging_isolation_merchant','Isolation Product','isolation-product','physical','draft');
`;

fs.writeFileSync(output, sql, { encoding: "utf8", mode: 0o600 });
