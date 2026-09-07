PRAGMA foreign_keys=ON;

-- Merchant-owned LAN printers. The host is private configuration and is never
-- exposed by public ordering endpoints.
CREATE TABLE printers (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  name TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'XP-N160II',
  connection_type TEXT NOT NULL DEFAULT 'lan' CHECK(connection_type IN('lan')),
  host TEXT NOT NULL,
  port INTEGER NOT NULL CHECK(port BETWEEN 1 AND 65535),
  paper_width_mm INTEGER NOT NULL DEFAULT 80 CHECK(paper_width_mm IN(80)),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN(0,1)),
  auto_print INTEGER NOT NULL DEFAULT 0 CHECK(auto_print IN(0,1)),
  copies INTEGER NOT NULL DEFAULT 1 CHECK(copies BETWEEN 1 AND 5),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT,
  UNIQUE(merchant_id,id)
);

CREATE TABLE print_jobs (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  order_code TEXT NOT NULL,
  printer_id TEXT NOT NULL,
  print_type TEXT NOT NULL DEFAULT 'kitchen' CHECK(print_type IN('kitchen','counter','customer','label')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','claimed','printing','printed','failed','cancelled')),
  copies INTEGER NOT NULL DEFAULT 1 CHECK(copies BETWEEN 1 AND 5),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count>=0),
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  available_at TEXT,
  claimed_at TEXT,
  lease_expires_at TEXT,
  printed_at TEXT,
  failed_at TEXT,
  last_error TEXT,
  created_by TEXT NOT NULL,
  device_id TEXT,
  claim_request_id TEXT,
  claim_token_hash TEXT,
  delivery_outcome TEXT NOT NULL DEFAULT 'not_started' CHECK(delivery_outcome IN('not_started','in_progress','confirmed','safe_failure','ambiguous')),
  ambiguous_at TEXT,
  reprint_of_job_id TEXT,
  reprint_reason TEXT,
  reprint_operator TEXT,
  reprint_requested_at TEXT,
  reprint_sequence INTEGER NOT NULL DEFAULT 0 CHECK(reprint_sequence>=0),
  idempotency_key TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(merchant_id,id),
  UNIQUE(merchant_id,idempotency_key),
  FOREIGN KEY(merchant_id,order_id) REFERENCES merchant_food_orders(merchant_id,id),
  FOREIGN KEY(merchant_id,printer_id) REFERENCES printers(merchant_id,id),
  FOREIGN KEY(reprint_of_job_id) REFERENCES print_jobs(id),
  CHECK((reprint_sequence=0 AND reprint_of_job_id IS NULL AND reprint_reason IS NULL) OR
        (reprint_sequence>0 AND reprint_of_job_id IS NOT NULL AND length(trim(reprint_reason))>0 AND reprint_operator IS NOT NULL AND reprint_requested_at IS NOT NULL))
);

-- The original kitchen task is database-idempotent. Reprints use a non-zero
-- sequence and retain an explicit relationship to the original task.
CREATE UNIQUE INDEX uq_print_job_original
  ON print_jobs(merchant_id,order_code,printer_id,print_type)
  WHERE reprint_sequence=0;

CREATE TABLE print_job_attempts (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  print_job_id TEXT NOT NULL,
  attempt_no INTEGER NOT NULL CHECK(attempt_no>0),
  device_id TEXT NOT NULL,
  claim_token_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN('claimed','printing','printed','safe_failure','ambiguous')),
  claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  finished_at TEXT,
  error_code TEXT,
  error_message TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(metadata_json)),
  UNIQUE(print_job_id,attempt_no),
  FOREIGN KEY(merchant_id,print_job_id) REFERENCES print_jobs(merchant_id,id)
);

CREATE INDEX idx_printers_merchant ON printers(merchant_id,enabled,auto_print);
CREATE INDEX idx_print_jobs_poll ON print_jobs(merchant_id,status,available_at,created_at);
CREATE INDEX idx_print_jobs_device ON print_jobs(merchant_id,device_id,status,lease_expires_at);
CREATE UNIQUE INDEX uq_print_job_claim_request ON print_jobs(merchant_id,id,device_id,claim_request_id) WHERE claim_request_id IS NOT NULL;
CREATE INDEX idx_print_attempts_job ON print_job_attempts(merchant_id,print_job_id,attempt_no);

CREATE TRIGGER trg_print_job_identity_immutable
BEFORE UPDATE OF merchant_id,order_id,order_code,printer_id,print_type,reprint_of_job_id,reprint_sequence,idempotency_key ON print_jobs
BEGIN SELECT RAISE(ABORT,'PRINT_JOB_IDENTITY_IMMUTABLE'); END;

INSERT OR IGNORE INTO merchant_permissions(code,module,description) VALUES
 ('printing.read','printing','查看印表機與列印佇列'),
 ('printing.manage','printing','管理印表機、列印與補印');
