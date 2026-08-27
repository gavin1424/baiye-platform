-- Gate 1 forward fix: grant operational CMS permissions to existing merchant owner/admin roles.
INSERT OR IGNORE INTO merchant_permissions(code,module,description) VALUES
  ('site.read','cms','Read merchant site and CMS resources'),
  ('site.write','cms','Create and edit merchant site and CMS resources'),
  ('site.publish','cms','Publish and unpublish merchant pages');

INSERT OR IGNORE INTO merchant_role_permissions(role_id,permission_code)
SELECT id,'site.read' FROM merchant_roles WHERE code IN ('owner','administrator');

INSERT OR IGNORE INTO merchant_role_permissions(role_id,permission_code)
SELECT id,'site.write' FROM merchant_roles WHERE code IN ('owner','administrator');

INSERT OR IGNORE INTO merchant_role_permissions(role_id,permission_code)
SELECT id,'site.publish' FROM merchant_roles WHERE code IN ('owner','administrator');
