// Additive migration. Codes/counters and legacy product foreign keys are never deleted.
export const stoneSchema=`
CREATE TABLE IF NOT EXISTS xy_stone_series_counters(series_prefix TEXT PRIMARY KEY CHECK(series_prefix IN('MET','WOD','WAT','FIR','EAR')),last_number INTEGER NOT NULL CHECK(last_number>=0));
CREATE TABLE IF NOT EXISTS xy_stones(
 id TEXT PRIMARY KEY,code TEXT NOT NULL UNIQUE,series_prefix TEXT NOT NULL,sequence_number INTEGER NOT NULL,
 product_template_id TEXT REFERENCES ls_products(id),batch_id TEXT REFERENCES ls_batches(id),
 cultural_theme TEXT NOT NULL CHECK(cultural_theme IN('metal','wood','water','fire','earth')),price_minor INTEGER CHECK(price_minor>=0),currency TEXT NOT NULL DEFAULT 'TWD',public_name TEXT NOT NULL,shape TEXT NOT NULL DEFAULT '',color_description TEXT NOT NULL DEFAULT '',origin_public TEXT NOT NULL DEFAULT '',provenance_note TEXT NOT NULL DEFAULT '',condition_note TEXT NOT NULL DEFAULT '',
 received_on TEXT,measured_on TEXT,weight_g REAL CHECK(weight_g>0),length_mm REAL CHECK(length_mm>0),width_mm REAL CHECK(width_mm>0),height_mm REAL CHECK(height_mm>0),collection_grade TEXT,
 sale_status TEXT NOT NULL DEFAULT 'inquiry' CHECK(sale_status IN('inquiry','display','collected','withdrawn')),
 published INTEGER NOT NULL DEFAULT 0 CHECK(published IN(0,1)),ever_published INTEGER NOT NULL DEFAULT 0 CHECK(ever_published IN(0,1)),is_test INTEGER NOT NULL DEFAULT 0 CHECK(is_test IN(0,1)),
 revision INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(series_prefix,sequence_number));
CREATE TRIGGER IF NOT EXISTS xy_stone_code_immutable BEFORE UPDATE OF code,series_prefix,sequence_number ON xy_stones
 WHEN NEW.code!=OLD.code OR NEW.series_prefix!=OLD.series_prefix OR NEW.sequence_number!=OLD.sequence_number BEGIN SELECT RAISE(ABORT,'PERMANENT_CODE'); END;
CREATE TRIGGER IF NOT EXISTS xy_stone_no_delete BEFORE DELETE ON xy_stones BEGIN SELECT RAISE(ABORT,'PERMANENT_RECORD'); END;
CREATE TRIGGER IF NOT EXISTS xy_stone_counter_no_delete BEFORE DELETE ON xy_stone_series_counters BEGIN SELECT RAISE(ABORT,'PERMANENT_COUNTER'); END;
CREATE TRIGGER IF NOT EXISTS xy_stone_counter_monotonic BEFORE UPDATE ON xy_stone_series_counters WHEN NEW.last_number<OLD.last_number BEGIN SELECT RAISE(ABORT,'COUNTER_CANNOT_REWIND'); END;
CREATE TABLE IF NOT EXISTS xy_stone_requests(actor_id TEXT NOT NULL,request_key TEXT NOT NULL,request_hash TEXT NOT NULL,stone_id TEXT NOT NULL REFERENCES xy_stones(id),PRIMARY KEY(actor_id,request_key));
CREATE TABLE IF NOT EXISTS xy_stone_photos(id TEXT PRIMARY KEY,stone_id TEXT NOT NULL REFERENCES xy_stones(id),storage_key TEXT,fixture_path TEXT,kind TEXT NOT NULL CHECK(kind IN('front','back','side','macro')),verified_real INTEGER NOT NULL DEFAULT 0 CHECK(verified_real IN(0,1)),is_public INTEGER NOT NULL DEFAULT 0 CHECK(is_public IN(0,1)),sha256 TEXT NOT NULL,alt TEXT NOT NULL DEFAULT '',sort_order INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS xy_stone_documents(id TEXT PRIMARY KEY,stone_id TEXT NOT NULL REFERENCES xy_stones(id),storage_key TEXT,mime TEXT NOT NULL,sha256 TEXT NOT NULL,doc_type TEXT NOT NULL,status TEXT NOT NULL,verified_by TEXT NOT NULL,public_visible INTEGER NOT NULL DEFAULT 0 CHECK(public_visible IN(0,1)));
CREATE TABLE IF NOT EXISTS xy_stone_tests(id TEXT PRIMARY KEY,stone_id TEXT NOT NULL REFERENCES xy_stones(id),sample_id TEXT NOT NULL,device TEXT NOT NULL,analysis_mode TEXT NOT NULL,tested_at TEXT NOT NULL,institution TEXT NOT NULL DEFAULT '',status TEXT NOT NULL CHECK(status IN('unverified','confirmed','rejected')),document_id TEXT REFERENCES xy_stone_documents(id),identity_evidence TEXT NOT NULL,is_public INTEGER NOT NULL DEFAULT 0 CHECK(is_public IN(0,1)),reviewer TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS xy_stone_test_points(id TEXT PRIMARY KEY,test_id TEXT NOT NULL REFERENCES xy_stone_tests(id),point_label TEXT NOT NULL,photo_id TEXT REFERENCES xy_stone_photos(id),x REAL CHECK(x>=0 AND x<=1),y REAL CHECK(y>=0 AND y<=1),UNIQUE(test_id,point_label));
CREATE TABLE IF NOT EXISTS xy_stone_readings(id TEXT PRIMARY KEY,point_id TEXT NOT NULL REFERENCES xy_stone_test_points(id),element TEXT NOT NULL,reading TEXT NOT NULL,unit TEXT NOT NULL,uncertainty TEXT,UNIQUE(point_id,element));
CREATE TABLE IF NOT EXISTS xy_stone_audit(id TEXT PRIMARY KEY,stone_id TEXT NOT NULL REFERENCES xy_stones(id),actor_id TEXT NOT NULL,action TEXT NOT NULL,revision INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS xy_stone_template ON xy_stones(product_template_id,published);
`;
