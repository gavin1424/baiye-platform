# Finance ledger operations

## Backup

Export the D1 schema and data before a major migration:

```powershell
npx wrangler d1 export baiye-finance --remote --output baiye-finance-backup.sql
```

Keep the export in an access-controlled backup location. Do not commit exports containing financial records.

## Recovery

1. Review the failed migration and create a new corrective migration. Do not edit an already-applied migration.
2. If recovery requires a restore, create a replacement D1 database and import the approved backup with Wrangler.
3. Update the `FINANCE_DB` binding in `wrangler.jsonc`, redeploy the Worker, and verify `/api/finance/summary` with an authenticated session.

## CSV export

Administrators can export the currently loaded payment ledger from `/admin/finance`. CSV data is an operational export, not a database backup.

## Provider onboarding

Add a provider adapter only after a formal merchant contract and its official signature/checksum verification scheme are available. Set its Worker Secret with `wrangler secret put`; never put provider credentials in source control or browser code.
