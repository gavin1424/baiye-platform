# Production 0033 Reconciliation — 2026-09-12

Internal audit record. This file is not public website content.

## Scope and source

- Production D1: `baiye-finance` (`1662c6ab-57d7-4df7-8056-935fbead2d8c`)
- source migration: `0033_beef_noodle_line_liff_ordering_v1.sql`
- source SHA-256: `67B30106D1F83B8CEC0811A34100947B49B102390E84E0D691968E4095A0B455`
- Production export SHA-256: `CF1712F816DEA1121A018022603EC1AEE3E916FCE45FCB1B24C40564EC5E371A`
- Production writes during this audit: `0`

## Complete manifest and reconciliation matrix

| # | 0033 item | Expected | Production actual | Match | Action |
|---:|---|---|---|---|---|
| 1 | `messaging_api_channel_id` | `TEXT`, nullable, default NULL | Exact at column 8 | yes | NO_ACTION |
| 2 | `line_login_channel_id` | `TEXT`, nullable, default NULL | Exact at column 9 | yes | NO_ACTION |
| 3 | `liff_id` | `TEXT`, nullable, default NULL | Exact at column 10 | yes | NO_ACTION |
| 4 | `add_friend_option` | `TEXT NOT NULL DEFAULT 'none'`, CHECK `none/normal/aggressive` | Exact, CHECK present | yes | NO_ACTION |
| 5 | `linked_official_account` | `INTEGER NOT NULL DEFAULT 0`, CHECK `0/1` | Exact, CHECK present | yes | NO_ACTION |
| 6 | `webhook_url` | `TEXT`, nullable, default NULL | Exact at column 13 | yes | NO_ACTION |
| 7 | `webhook_enabled` | `INTEGER NOT NULL DEFAULT 0`, CHECK `0/1` | Exact, CHECK present | yes | NO_ACTION |
| 8 | `follow_webhook_enabled` | `INTEGER NOT NULL DEFAULT 0`, CHECK `0/1` | Exact, CHECK present | yes | NO_ACTION |
| 9 | `unfollow_webhook_enabled` | `INTEGER NOT NULL DEFAULT 0`, CHECK `0/1` | Exact, CHECK present | yes | NO_ACTION |
| 10 | `webhook_verified_at` | `TEXT`, nullable, default NULL | Exact at column 17 | yes | NO_ACTION |
| 11 | `merchant_line_friendships` | Six exact columns; composite PK `(merchant_id,line_user_id_hash)`; status CHECK; FK `merchant_id -> merchants(id)` | Table SQL, six columns, PK order, CHECK and FK all exact | yes | NO_ACTION |
| 12 | `idx_merchant_line_friendships_status` | Non-unique index `(merchant_id,status,updated_at)` | Exact order, non-unique, non-partial | yes | NO_ACTION |
| 13 | demo backfill | `demo_beef_noodle`; `integration_mode='linked_line_login'`; official Worker webhook URL; update timestamp | Exact values; `updated_at=2026-09-11 11:01:09` | yes | NO_ACTION |

There are no CREATE/INSERT seed statements, triggers, separate UNIQUE indexes, or
other business-data rewrites in 0033. Production has no triggers on either
affected table. The friendships table contains zero rows, and no current LINE
integration row violates the new CHECK domains.

## Classification and drift evidence

Classification: `FULLY_APPLIED_WITHOUT_LEDGER`.

Evidence supports operational category A: the exact full migration effect was
applied directly without the Wrangler runner recording its filename.

- `d1_migrations` contains 46 rows through `0032_merchant_storefront_url_v1.sql`
  but no row for this 0033.
- The complete 13-item effect is present; this is not a partial-column drift.
- The backfill timestamp is `2026-09-11 11:01:09Z`.
- the current Production Worker version was created at `2026-09-11 11:01:24Z`,
  15 seconds later.
- Git first records the exact migration with guarded LINE LIFF commit
  `b7457b9ae6e5090f498f72fa979a966f6c77e5a1` at
  `2026-09-11T19:03:35+08:00`.

The evidence cannot distinguish whether the direct execution came from Wrangler
`d1 execute`, the Cloudflare console, or another equivalent operator path. No
claim is made about an unobserved actor or command.

## Forward-only reconciliation candidate

File: `production_0036_reconcile_0033_schema_ledger.sql`.

Wrangler 4.131.1 exposes only migration `create`, `list`, and `apply`; it has no
supported mark-applied operation. The candidate therefore:

1. checks the complete 0033 schema, constraint, index and data manifest;
2. aborts through a CHECK violation if any item differs;
3. performs no application-schema or business-data rewrite;
4. inserts the missing filename into the runner's own three-column ledger only
   after the guard passes;
5. records `SCHEMA_MIGRATION_RECONCILED` in the existing audit log;
6. is safe when the migration runner later executes 0036 again.

## Isolated clone rehearsal

The Production export was restored into a new Wrangler local D1 store with
foreign keys disabled only during import because the Cloudflare export orders
some child data before its parent table. `PRAGMA foreign_key_check` after restore
returned zero violations.

Before reconciliation:

- tables: 177
- ledger rows: 46
- merchant contract signatures: 32
- merchant contract artifacts: 64
- runner pending: 0033, 0035, production_0036

After direct execution of guarded 0036:

- 0033 ledger row: one
- reconciliation audit row: one
- signatures/artifacts: 32/64
- runner pending: 0035, production_0036

After the local runner:

- 0035: PASS
- production_0036 replay: PASS
- runner result: `No migrations to apply`
- signatures: 32; PDF hash characters: 1376; document hash characters: 1376
- artifacts: 64; artifact hash characters: 2752
- PDF/artifact hash mismatches: 0
- LINE demo backfill and friendships row count remain unchanged
- three new contract versions are created pending review with their expected hashes

No reconciliation SQL has been executed against Production.
