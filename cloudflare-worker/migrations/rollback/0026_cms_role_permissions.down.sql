-- Remove only the Gate 1 owner/admin grants. Permission definitions remain for custom roles.
DELETE FROM merchant_role_permissions
WHERE permission_code IN ('site.read','site.write','site.publish')
  AND role_id IN (SELECT id FROM merchant_roles WHERE code IN ('owner','administrator'));
