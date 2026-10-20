-- Apply only to the brand's dedicated SQLite store. Never apply to the platform database.
CREATE TABLE xy_members(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,salt TEXT NOT NULL,display_name TEXT NOT NULL DEFAULT '',member_no TEXT NOT NULL UNIQUE,role TEXT NOT NULL DEFAULT 'member' CHECK(role IN('member','admin')),status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','deleting')),joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE xy_sessions(token_hash TEXT PRIMARY KEY,member_id TEXT NOT NULL REFERENCES xy_members(id) ON DELETE CASCADE,csrf TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE INDEX xy_sessions_owner ON xy_sessions(member_id);
CREATE TABLE xy_rate_limits(key TEXT NOT NULL,bucket INTEGER NOT NULL,attempts INTEGER NOT NULL,PRIMARY KEY(key,bucket));
CREATE TABLE xy_photos(id TEXT PRIMARY KEY,member_id TEXT NOT NULL REFERENCES xy_members(id),day TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',storage_key TEXT NOT NULL UNIQUE,mime TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX xy_photos_owner ON xy_photos(member_id,day);
ALTER TABLE ls_journal ADD COLUMN aroma TEXT NOT NULL DEFAULT '';
ALTER TABLE ls_journal ADD COLUMN ritual TEXT NOT NULL DEFAULT '';
