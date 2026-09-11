ALTER TABLE merchant_line_integrations ADD COLUMN messaging_api_channel_id TEXT;
ALTER TABLE merchant_line_integrations ADD COLUMN line_login_channel_id TEXT;
ALTER TABLE merchant_line_integrations ADD COLUMN liff_id TEXT;
ALTER TABLE merchant_line_integrations ADD COLUMN add_friend_option TEXT NOT NULL DEFAULT 'none'
  CHECK(add_friend_option IN ('none','normal','aggressive'));
ALTER TABLE merchant_line_integrations ADD COLUMN linked_official_account INTEGER NOT NULL DEFAULT 0
  CHECK(linked_official_account IN (0,1));
ALTER TABLE merchant_line_integrations ADD COLUMN webhook_url TEXT;
ALTER TABLE merchant_line_integrations ADD COLUMN webhook_enabled INTEGER NOT NULL DEFAULT 0
  CHECK(webhook_enabled IN (0,1));
ALTER TABLE merchant_line_integrations ADD COLUMN follow_webhook_enabled INTEGER NOT NULL DEFAULT 0
  CHECK(follow_webhook_enabled IN (0,1));
ALTER TABLE merchant_line_integrations ADD COLUMN unfollow_webhook_enabled INTEGER NOT NULL DEFAULT 0
  CHECK(unfollow_webhook_enabled IN (0,1));
ALTER TABLE merchant_line_integrations ADD COLUMN webhook_verified_at TEXT;

CREATE TABLE merchant_line_friendships (
  merchant_id TEXT NOT NULL,
  line_user_id_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('friend','blocked')),
  last_followed_at TEXT,
  last_unfollowed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(merchant_id,line_user_id_hash),
  FOREIGN KEY(merchant_id) REFERENCES merchants(id)
);

CREATE INDEX idx_merchant_line_friendships_status
  ON merchant_line_friendships(merchant_id,status,updated_at);

UPDATE merchant_line_integrations
SET integration_mode='linked_line_login',
    webhook_url='https://chuang-baiye-ai.baiye-platform.workers.dev/webhooks/line/demo_beef_noodle',
    updated_at=CURRENT_TIMESTAMP
WHERE merchant_id='demo_beef_noodle';
