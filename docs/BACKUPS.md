# Muse encrypted backups (operator setup required)

These local Node.js scripts need no new subscription, paid API, package install,
or hosted changes. **Opt-in full backups cover the targeted PostgreSQL database
and ready private Muse media objects under acknowledged paused writes.**
Database-only backups explicitly remain incomplete.
No production connection, credentials, destination, or backup schedule has been
configured. Nothing automatically reads `.env.local` or local application data.

## Coverage and fail-closed defaults

The iVote PostgreSQL project is shared. Never run an unfiltered project/schema
dump. This tool explicitly selects only these `public` tables:

- `shared_stories`, `shared_story_sessions`, `shared_story_generation_limits`
- `shared_story_media`, `shared_story_media_purge`
- `muse_personal_journeys`, `muse_personal_journey_requests`
- `muse_adventure_sessions`, `muse_adventure_requests`, `muse_adventure_budgets`
- Planned optional `muse_operations_counters`, `muse_operations_alerts`

It first introspects table names with `psql` (no row queries). All currently
implemented tables must exist. Absent planned operations tables are explicitly
recorded in the encrypted manifest; existing ones are included. Unrecognized
`muse_*` or `shared_story_*` tables fail closed rather than silently widening
scope or omitting a new feature. No `profiles`, `messages`, unrelated schema,
large objects, or storage catalog dumps are included.

`pg_dump` uses custom format, one explicit selector per table, strict selectors,
no ownership/ACL export, no large objects, and bounded lock/tool timeouts.
It supplies its own transactionally consistent database snapshot. Discovery and
dump are separate steps: missing/renamed tables fail the dump; migrations should
not run concurrently with backups. Table-selection dumps are **not standalone
schema restores**: functions, roles, extensions, external dependencies and
security configuration require the reviewed Muse migrations/configuration.

### Opt-in private media and consistency requirements

Set `MUSE_BACKUP_INCLUDE_MEDIA=yes` to include binary objects referenced by
**only `public.shared_story_media WHERE status = 'ready'`**. The bucket is fixed
to `muse-shared-media`; its storage configuration must report `public: false`.
Service-role authenticated downloads use only that bucket, HTTPS, no redirects,
and bounded request timeouts. No bucket-wide listing, public URL or unrelated
storage inventory is used. IDs and object-key structure, row sizes, response
sizes and MIME are checked; each streamed object's SHA-256 is stored inside the
encrypted manifest and verified offline. There is no preexisting authoritative
checksum in the media table: the recorded hash protects the captured bytes, not
proof of their original upload content. An equal-length preexisting corrupt
object requires separate application validation.

The manifest contains object keys/IDs, sizes, MIME and hashes, **never service
credentials, origin URLs or signed URLs**. Media bytes follow the custom database
dump inside the same authenticated encrypted artifact. Missing objects, download
errors, size/MIME mismatch, public buckets, changed inventory or invalid
checksums fail the whole backup; no partial/full artifact is published.
Inventory is bounded to 100 ready objects and a 64 KiB manifest; exceeding these
limits fails rather than silently truncating coverage.

**Before a full backup, the operator must pause all writers and acknowledge it
with both `MUSE_MAINTENANCE_MODE=true` and
`MUSE_BACKUP_PAUSED_WRITES_ACK=yes`.** These environment flags are an operator
assertion, not remote proof. Ensure the deployed API actually enforces maintenance,
drain in-flight requests, pause cron workers/purge tasks/admin/direct SQL writers,
and prevent ready-object replacement/deletion until backup completes. Outstanding
signed upload capabilities may still write pending objects: pending uploads and
orphan/purge-only objects are intentionally not backed up as recoverable media.
Reconcile them as failed/abandoned uploads on recovery; never activate them.

Storage and PostgreSQL do not share a snapshot. The tool queries the scoped ready
inventory before the dump and after downloads and rejects changed rows, but
cannot detect arbitrary out-of-band writes or equal-length object replacement.
The consistency guarantee depends on the acknowledged write pause.
`fullRecovery: true` means complete configured table + ready-object coverage
under that assertion, **not** a demonstrated application restore, pending-upload
recovery, or standalone infrastructure backup.

Without media opt-in, both backup and verification require
`MUSE_BACKUP_ALLOW_DATABASE_ONLY=yes` and report `fullRecovery: false` with
media integrity unverified. Never treat media rows or signed URLs as media bytes.

## Operator setup

Use Node.js 20+ and locally available PostgreSQL `psql`, `pg_dump`, `pg_restore`
on PATH. Prefer the same PostgreSQL major version as the server; `pg_dump` must
not be older than the server. Use a reviewed **direct/session PostgreSQL
connection**, not a transaction-mode pooler. Tool errors are deliberately
redacted to avoid printing credentials or personal data.

Choose a dedicated private filesystem directory. On POSIX it is set to mode
0700 and files to 0600. On Windows, the scripts apply a protected NTFS DACL
granting only the current Windows identity inheritable FullControl **before
writing**. Existing permissions on that dedicated directory are replaced.
Do not point it at an application directory, shared folder or symlink.
The destination must support these permissions and same-volume atomic rename;
permission errors fail closed. Administrators/root and filesystem operators can
still access files; use device encryption and protect the execution account.

Set secrets via an approved local secret manager or a protected process
environment, not command-line arguments, shell history, committed files, logs,
or CI variables printed by debug tracing:

| Environment variable | Meaning |
| --- | --- |
| `MUSE_BACKUP_DATABASE_URL` | Reviewed Muse PostgreSQL URL, including database name and explicit `sslmode=require`, `verify-ca`, or preferably `verify-full`. Credentials are passed to libpq via `PGDATABASE`, never argv. |
| `MUSE_BACKUP_KEY` | Canonical base64 random 32-byte AES key; not a passphrase. Keep an independently secured recovery copy. |
| `MUSE_BACKUP_DIR` | Absolute dedicated private encrypted output directory. |
| `MUSE_BACKUP_ALLOW_DATABASE_ONLY` | Must be exactly `yes` to acknowledge missing private media. |
| `MUSE_BACKUP_INCLUDE_MEDIA` | Exactly `yes` enables full table + ready-media coverage; otherwise media is excluded. |
| `MUSE_MAINTENANCE_MODE` | Must be exactly `true` for full backup; separately enforce this in production and drain writers. |
| `MUSE_BACKUP_PAUSED_WRITES_ACK` | Exactly `yes` acknowledges that all relevant writers/purge jobs are paused. |
| `MUSE_BACKUP_SUPABASE_URL` | Explicit approved Supabase HTTPS origin, no path/query/userinfo; only needed for media backup. |
| `MUSE_BACKUP_SUPABASE_SERVICE_ROLE_KEY` | Explicit protected storage service-role key, used only for private-bucket checks/downloads; not needed for verification. |
| `MUSE_BACKUP_RETENTION_DAYS` | Optional integer 1–365; default 7. |
| `MUSE_BACKUP_VERIFY_DIR` | Absolute dedicated private workspace for offline verification. |

Generate a key with a local cryptographic RNG, then store it directly in the
approved secret manager. For example the underlying Node expression is
`require('node:crypto').randomBytes(32).toString('base64')`; avoid printing it in
recorded terminals. Rotating a key does not re-encrypt older artifacts: retain
the appropriate old recovery keys until their artifacts are safely retired.

Use a least-privilege PostgreSQL account able to read exactly the selected tables
and all their rows. Do not allow RLS to silently reduce coverage. `pg_dump` uses
its default RLS-off behavior and must fail if the account cannot read the complete
tables; do not add `--enable-row-security`. Do not use an iVote-wide dump service
as a substitute for targeted access.

From the Muse directory, after credentials/destination are explicitly approved:

```powershell
node scripts\muse-backup.cjs
```

The script emits only coverage, the random encrypted artifact filename, and
measured retention results. Exit code 1 indicates failure, not a skipped success.
Artifacts are `muse-<epoch-ms>-<random-id>.musebackup`: authenticated AES-256-GCM,
fresh random nonce, authenticated format header, encrypted JSON manifest and
custom dump and optional concatenated media bytes, then authentication tag.
Version 1 database-only artifacts remain supported; version 2 includes media.
The manifest records the dump SHA-256 and
size. Publication is an atomic rename after dump TOC validation and successful
authentication of the encrypted artifact.

Plaintext is written only within a randomly named private work directory and is
deleted in `finally` after success or error, with bounded removal retries.
Deletion is not secure erasure. Hard process termination, power loss or an OS
denying deletion can leave `.muse-work-*` directories. After confirming no job is
running, inspect and remove only the exact abandoned work directory. Never
glob-delete arbitrary paths. Encrypted publication can already have succeeded
when later cleanup fails; treat a nonzero exit as an incident and inspect it.

## Retention, destination and monitoring

Seven days is a recommendation, **not a compliance guarantee**. Cleanup runs
only after a successful backup, deletes at most 100 strictly named regular
backup files per run, and requires both filename timestamp and filesystem mtime
to be older than the configured window. It ignores symlinks, work directories
and other filenames. Reports contain actual `removed` and `eligibleRemaining`
counts. Renamed/copied files, failed runs, interrupted workspaces, replicas and
old media copies require separate review.

No GitHub workflow is included: a secret key and an authorized encrypted
destination were not supplied. GitHub artifacts or another third-party upload
would not constitute authorized storage. Keep backups off third-party systems
unless separately approved; use an already-owned encrypted volume or approved
offline copy, not the production application's only disk. Never upload decrypted
dumps or work directories. This tooling performs no uploads.

Once approved, run with an existing local scheduler/account (for example Windows
Task Scheduler). Configure nonoverlapping runs, secure environment injection,
failure alerts, last-success age monitoring, destination capacity checks and
periodic rehearsal. Do not mark missing secrets or a missing destination as a
successful scheduled run. Retention of copies must be measured independently.

## Safe offline verification and restore rehearsal

With only the key and private verification workspace (and database-only
acknowledgement for artifacts lacking media) set, run:

```powershell
node scripts\muse-backup-verify.cjs "C:\approved-private-backups\muse-<timestamp>-<id>.musebackup"
```

Verification authenticates before interpreting the manifest, checks dump size
and SHA-256, and runs **only `pg_restore --list`** against the extracted dump.
It checks exact table-data coverage and rejects unrelated tables and unsupported
large-object/sequence data. It never connects to or restores any database.
Version 2 also checks every media slice's exact size and SHA-256 and rejects
missing or trailing payload bytes. It reports `mediaIntegrity: verified` only
after all objects pass; verification makes no storage requests.
All extracted plaintext is removed on success or failure. A wrong key,
altered/truncated artifact, inconsistent manifest, invalid list, or unavailable
tool fails. Without explicit database-only acknowledgement it also fails because
media integrity cannot be verified.

**This is archive verification, not an actual restore rehearsal.** A passing TOC
does not prove that rows can restore or that application behavior is correct.
For a real rehearsal, an authorized operator must separately use a disposable,
network-isolated PostgreSQL database with no production URL, outbound messaging,
AI calls or recipients. Provision compatible roles/extensions and reviewed
migrations. Decrypt/export only through a reviewed, private operator procedure
(this tool intentionally offers no persistent decrypted export or automatic
restore). Restore only the targeted database tables, then reapply and inspect
required functions, triggers, RLS and grants. Compare row counts/relationships
and exercise Muse features with synthetic recipients; destroy the rehearsal
database and plaintext afterward. For media, separately restore only verified ready objects to an isolated private
Muse bucket, reconcile the dump's references and purge/deletion decisions, and
test private-access controls before serving recipients. Archive hashes do not
replace this storage/application rehearsal.

### Recovery privacy requirements

Backups contain personal story content, usage metadata and hashed capabilities.
Treat them as personal data with restricted access, a deletion/retention policy
and incident handling. **Do not resurrect deleted or expired stories.** A backup
is historical state, not current deletion authority: reconcile against a
separately maintained current deletion/consent record, remove expired stories,
apply purge/tombstone decisions, and exclude associated sessions/media before
opening access. Purge queues in an old backup alone cannot prove which stories
were deleted afterward; without current evidence keep recovery quarantined.

Rotate/reissue story owner/play capabilities, upload/download capabilities and
relevant operational credentials after recovery. Invalidate old sessions and
links as appropriate; never reactivate historical recipient access implicitly.
Have a human approve recovery and security/privacy checks before routing traffic.

## Tests (no database/storage network)

```powershell
node --test scripts\muse-backup.test.cjs
```

Tests inject fake PostgreSQL tools and never read `.env.local`, application data,
or production. They exercise exact scope, optional tables, unknown/missing
schema rejection, encryption authentication/tampering, checksum failure,
plaintext cleanup, bounded named-file retention, media fail-closed behavior and,
encrypted private media coverage/checksums, paused-write acknowledgement,
private-bucket enforcement, failed downloads and, on Windows, the actual local
NTFS permission setup.
