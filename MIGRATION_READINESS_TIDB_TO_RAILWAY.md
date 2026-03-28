# TiDB to Railway Migration Readiness Runbook

Last updated: 2026-03-28
Owner: Library Coffee project team
Scope: Prepare and execute safe migration from current TiDB Cloud database back to Railway MySQL

## 1) Why this file exists
This is the single handoff document for migration status and next actions.
Use this file in any future chat so context is preserved.

## 2) Current readiness status
Migration has NOT been executed yet.
Preparation is complete and we are ready to migrate when approved.

### Prepared artifacts (already created locally)
- TiDB export downloaded successfully via TiDB Cloud CLI.
- 45 export chunks downloaded (all succeeded).
- Combined SQL dump built and sanitized for Railway compatibility.

### Ready-to-import file
- C:\tools\ticloud\export_work\full_railway_ready_nodb.sql

### Build output summary (already verified)
- Source gzip files: 45
- Unzipped SQL files: 45
- Required objects found in prepared SQL:
  - CREATE TABLE shifts
  - CREATE TABLE audit_logs
  - unit_label
  - action_type
  - refund_amount
- is_force_closed not found as a physical column (expected in this codebase):
  - It is computed as a query alias in backend shift history logic.

## 3) Local tools confirmed
- TiDB Cloud CLI installed at: C:\tools\ticloud\ticloud.exe
- MySQL client available at:
  - E:\SHAYK\BSIT 3 - C\SYSTEM\library-coffee\mariadb\bin\mysql.exe

## 4) Preconditions before cutover
Complete all before running import:
1. Railway billing and DB access are active.
2. Create a fresh empty Railway MySQL database target.
3. Collect Railway connection values:
   - host
   - port
   - username
   - password
   - database name
4. Freeze writes during final cutover window (avoid new data drift while importing).

## 5) Migration execution procedure (when approved)

### Step A: Import prepared SQL into Railway
Run in PowerShell:

& 'E:\SHAYK\BSIT 3 - C\SYSTEM\library-coffee\mariadb\bin\mysql.exe' -h <RAILWAY_HOST> -P <RAILWAY_PORT> -u <RAILWAY_USER> -p <RAILWAY_DB> -e "source C:/tools/ticloud/export_work/full_railway_ready_nodb.sql"

### Step B: Verify key tables exist

& 'E:\SHAYK\BSIT 3 - C\SYSTEM\library-coffee\mariadb\bin\mysql.exe' -h <RAILWAY_HOST> -P <RAILWAY_PORT> -u <RAILWAY_USER> -p <RAILWAY_DB> -e "SHOW TABLES LIKE 'shifts'; SHOW TABLES LIKE 'audit_logs';"

### Step C: Start backend once
- Start backend server normally.
- Allow startup migrations to run and patch any remaining schema deltas.

### Step D: Application smoke checks
Run these in app UI/API after import:
1. Add category
2. Add discount
3. Add user
4. Add item
5. Create POS transaction
6. End shift and check Reports/Audit

## 6) Post-migration data integrity checklist
Use these checks to catch the same class of issues seen previously in TiDB migration:

1. ID behavior check
- Newly inserted category/user/discount IDs should increase normally (no unexpected jumps such as 8000+ unless prior max ID is already high).

2. Duplicate insert check
- Creating one item should create exactly one row.

3. POS workflow check
- Pending -> preparing -> ready -> complete transitions succeed.

4. Audit and shifts check
- shift records writable and queryable.
- audit_logs records are inserted when expected.

## 7) Rollback plan
If critical issues appear after cutover:
1. Stop write traffic to Railway target.
2. Point backend env back to TiDB Cloud immediately.
3. Restart backend.
4. Re-open traffic.
5. Investigate issue and retry migration later.

## 8) Notes for future chat/session
Share this file first:
- MIGRATION_READINESS_TIDB_TO_RAILWAY.md

Also share these local artifact paths:
- C:\tools\ticloud\export_work\full_railway_ready_nodb.sql
- C:\tools\ticloud\export_work\full_railway_ready.sql
- C:\tools\ticloud\export_work\full_tidb_export.sql

## 9) Security follow-up (recommended)
Some helper scripts in backend/config contain hardcoded TiDB credentials from prior emergency work.
Before production finalization:
1. Rotate affected DB credentials.
2. Move all DB secrets to environment variables only.
3. Remove plaintext credentials from repository files.
