import {v4Catalog} from './catalog-v4-data.js';
export const artSchema=`CREATE TABLE IF NOT EXISTS xy_concept_art(
 product_id TEXT PRIMARY KEY REFERENCES ls_products(id),catalog_sku TEXT NOT NULL UNIQUE,
 thumb_url TEXT NOT NULL,display_category TEXT NOT NULL,price_type TEXT NOT NULL DEFAULT 'PROPOSED_RETAIL',
 image_sha256 TEXT NOT NULL,thumb_sha256 TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS xy_asset_imports(version TEXT PRIMARY KEY,source_sha256 TEXT NOT NULL,applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`;
export function importV4(sql){
 if(sql.exec('SELECT version FROM xy_asset_imports WHERE version=?',v4Catalog.version).toArray().length)return false;
 for(const p of v4Catalog.products){
  if(!sql.exec('SELECT id FROM ls_products WHERE id=?',p.id).toArray().length)throw Error('V4_PRODUCT_MAPPING_MISSING');
  // Planned retail price is stored server-side. Never unlock sales or overwrite staff-set prices.
  sql.exec("UPDATE ls_products SET price_minor=?,currency='TWD',revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND price_minor IS NULL AND status='display'",p.priceTWD*100,p.id);
  sql.exec("UPDATE xy_product_records SET concept_url=?,concept_sha256=?,media_provenance='AI_CONCEPT_V4' WHERE product_id=?",p.image,p.imageSha256,p.id);
  sql.exec('INSERT INTO xy_concept_art(product_id,catalog_sku,thumb_url,display_category,image_sha256,thumb_sha256) VALUES(?,?,?,?,?,?) ON CONFLICT(product_id) DO UPDATE SET catalog_sku=excluded.catalog_sku,thumb_url=excluded.thumb_url,display_category=excluded.display_category,image_sha256=excluded.image_sha256,thumb_sha256=excluded.thumb_sha256',p.id,p.sku,p.thumb,p.displayCategory,p.imageSha256,p.thumbSha256);
 }
 sql.exec('INSERT INTO xy_asset_imports(version,source_sha256) VALUES(?,?)',v4Catalog.version,v4Catalog.sourceArchiveSha256);
 return true;
}
