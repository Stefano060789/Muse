'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { createReadStream, createWriteStream } = require('node:fs');
const { pipeline } = require('node:stream/promises');

const REQUIRED_TABLES = Object.freeze([
  'shared_stories', 'shared_story_sessions', 'shared_story_generation_limits',
  'shared_story_media', 'shared_story_media_purge',
  'muse_personal_journeys', 'muse_personal_journey_requests',
  'muse_adventure_sessions', 'muse_adventure_requests', 'muse_adventure_budgets',
]);
const OPTIONAL_TABLES = Object.freeze([
  'muse_operations_counters', 'muse_operations_alerts',
  'shared_story_voice', 'shared_story_voice_purge', 'shared_story_replies',
]);
const TABLES = Object.freeze([...REQUIRED_TABLES, ...OPTIONAL_TABLES]);
const MAGIC = Buffer.from('MUSEBK01');
const NAME = /^muse-(\d{13})-([a-f0-9]{32})\.musebackup$/;
const MAX_MANIFEST = 65536;
const MEDIA_BUCKET = 'muse-shared-media';
const MEDIA_KEY = /^stories\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp|mp4|webm|wav)$/;
const MEDIA_SQL = `select coalesce(json_agg(row_to_json(m) order by m.object_key), '[]'::json)::text
from (select id, story_id, object_key, size, mime from public.shared_story_media where status = 'ready') m;`;
const VOICE_SQL = `select coalesce(json_agg(row_to_json(m) order by m.object_key), '[]'::json)::text
from (select id, story_id, object_key, size, mime from public.shared_story_voice where status = 'ready') m;`;
const DISCOVER_SQL = `select coalesce(json_agg(tablename order by tablename), '[]'::json)::text
from pg_catalog.pg_tables where schemaname = 'public'
and (tablename in (${TABLES.map(t => `'${t}'`).join(',')}) or left(tablename, 5) = 'muse_'
or left(tablename, 13) = 'shared_story_');`;

function fail(message) { throw new Error(message); }

function readKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(value)) {
    fail('MUSE_BACKUP_KEY must be a canonical base64-encoded random 32-byte key.');
  }
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32 || key.toString('base64') !== value || new Set(key).size < 16) {
    fail('MUSE_BACKUP_KEY must be a strong random 32-byte key.');
  }
  return key;
}

function localEnvironment(env = process.env) {
  const childEnv = {};
  for (const [name, value] of Object.entries(env)) {
    if (!name.startsWith('PG') && !name.startsWith('MUSE_BACKUP_') &&
        !/SUPABASE|SECRET|TOKEN|KEY|PASSWORD|DATABASE_URL/i.test(name)) childEnv[name] = value;
  }
  return childEnv;
}

function dbEnvironment(env) {
  const url = env.MUSE_BACKUP_DATABASE_URL;
  let parsed;
  try { parsed = new URL(url); } catch { fail('A PostgreSQL backup connection URL is required.'); }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname ||
      !parsed.pathname.slice(1)) fail('Invalid PostgreSQL backup connection URL.');
  if (!['require', 'verify-ca', 'verify-full'].includes(parsed.searchParams.get('sslmode'))) {
    fail('The backup connection must explicitly require TLS (sslmode=require or verify-full).');
  }
  // libpq accepts a URI through PGDATABASE; credentials never enter argv.
  const childEnv = localEnvironment(env);
  return { ...childEnv, PGDATABASE: url, PGCONNECT_TIMEOUT: '15', PGAPPNAME: 'muse-targeted-backup' };
}

function runTool(tool, args, { env = localEnvironment(), capture = false, timeout = 300000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(tool, args, { env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    let chunks = [], size = 0, problem = false;
    const timer = setTimeout(() => { problem = true; child.kill(); }, timeout);
    child.stdout.on('data', data => {
      if (!capture) return;
      size += data.length;
      if (size > 1024 * 1024) { problem = true; child.kill(); } else chunks.push(data);
    });
    child.on('error', () => { problem = true; });
    child.on('close', code => {
      clearTimeout(timer);
      if (problem || code !== 0) reject(new Error('A required local tool failed, timed out, or exceeded its output limit.'));
      else resolve(Buffer.concat(chunks).toString('utf8'));
    });
  });
}

async function secureDirectory(directory, run = runTool, platform = process.platform) {
  // Refuse symlink ancestors, not just a symlink at the destination.
  let cursor = path.resolve(directory);
  while (true) {
    try { if ((await fs.lstat(cursor)).isSymbolicLink()) fail('Backup paths must not contain symlinks.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail('A private backup directory is required.');
  if (platform === 'win32') {
    // Windows chmod does not restrict NTFS access. Replace the directory DACL
    // with the current user's inheritable FullControl rule before writing.
    const script = `$ErrorActionPreference='Stop'; $p=$env:MUSE_PRIVATE_DIRECTORY;
$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User;
$acl=New-Object System.Security.AccessControl.DirectorySecurity;
$acl.SetOwner($sid); $acl.SetAccessRuleProtection($true,$false);
$rule=New-Object System.Security.AccessControl.FileSystemAccessRule($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow');
$acl.AddAccessRule($rule); [System.IO.Directory]::SetAccessControl($p,$acl)`;
    await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      env: { ...localEnvironment(), MUSE_PRIVATE_DIRECTORY: directory }, timeout: 30000,
    });
  } else {
    await fs.chmod(directory, 0o700);
    if (((await fs.stat(directory)).mode & 0o077) !== 0) fail('Cannot enforce private backup permissions.');
  }
}

async function privateWork(directory, run, platform, secure = secureDirectory) {
  const work = path.join(directory, `.muse-work-${crypto.randomBytes(16).toString('hex')}`);
  await fs.mkdir(work, { mode: 0o700 });
  try { await secure(work, run, platform); return work; }
  catch (error) { await fs.rm(work, { recursive: true, force: true }); throw error; }
}

async function digest(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

function validateList(list, tables) {
  const dataTables = [];
  for (const line of list.split(/\r?\n/)) {
    if (!line || line.startsWith(';')) continue;
    const data = line.match(/^\d+;\s+\d+\s+\d+\s+TABLE DATA\s+(\S+)\s+(\S+)\s+/);
    if (data) {
      if (data[1] !== 'public' || !tables.includes(data[2])) fail('Archive contains out-of-scope table data.');
      dataTables.push(data[2]);
    } else if (/\b(?:SEQUENCE SET|FOREIGN TABLE|MATERIALIZED VIEW DATA|BLOBS?|LARGE OBJECT)\b/.test(line)) {
      fail('Archive contains unsupported data outside the Muse table scope.');
    }
    const relation = line.match(/^\d+;\s+\d+\s+\d+\s+TABLE\s+(?!DATA\s)(\S+)\s+(\S+)\s+/);
    if (relation && (relation[1] !== 'public' || !tables.includes(relation[2]))) {
      fail('Archive contains out-of-scope table definitions.');
    }
  }
  if (new Set(dataTables).size !== tables.length || dataTables.length !== tables.length ||
      !tables.every(t => dataTables.includes(t))) fail('Archive table coverage does not match the manifest.');
}

async function seal(dump, manifest, output, key, mediaFiles = []) {
  const iv = crypto.randomBytes(12);
  const header = Buffer.concat([MAGIC, iv]);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(header);
  const json = Buffer.from(JSON.stringify(manifest));
  if (json.length > MAX_MANIFEST) fail('Manifest limit exceeded; reduce media inventory or review format limits.');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(json.length);
  await fs.writeFile(output, header, { flag: 'wx', mode: 0o600 });
  async function* source() {
    yield length;
    yield json;
    yield* createReadStream(dump);
    for (const file of mediaFiles) yield* createReadStream(file);
  }
  await pipeline(source(), cipher, createWriteStream(output, { flags: 'r+', start: header.length }));
  const handle = await fs.open(output, 'a');
  try { await handle.writeFile(cipher.getAuthTag()); await handle.sync(); }
  finally { await handle.close(); }
}

async function mediaInventory(run, childEnv, tables = []) {
  const raw = await run('psql', ['-X', '--no-password', '--set=ON_ERROR_STOP=1',
    '--tuples-only', '--no-align', '--command', MEDIA_SQL], { env: childEnv, capture: true });
  let rows;
  try { rows = JSON.parse(raw.trim()); } catch { fail('Invalid ready-media inventory.'); }
  if (!Array.isArray(rows)) fail('Invalid ready-media inventory.');
  if (tables.includes('shared_story_voice')) {
    const voiceRaw = await run('psql', ['-X', '--no-password', '--set=ON_ERROR_STOP=1',
      '--tuples-only', '--no-align', '--command', VOICE_SQL], { env: childEnv, capture: true });
    let voiceRows;
    try { voiceRows = JSON.parse(voiceRaw.trim()); } catch { fail('Invalid ready-voice inventory.'); }
    if (!Array.isArray(voiceRows)) fail('Invalid ready-voice inventory.');
    rows = rows.concat(voiceRows);
  }
  if (rows.length > 100 ||
      rows.some(row => !MEDIA_KEY.test(row.object_key) ||
        row.object_key.split('/')[1] !== row.story_id ||
        row.object_key.split('/')[2].split('.')[0] !== row.id ||
        !Number.isSafeInteger(row.size) || row.size < 1 ||
        row.size > (row.mime === 'audio/wav' ? 5242880 : 20971520) ||
        !['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'audio/wav'].includes(row.mime) ||
        (row.mime === 'audio/wav') !== row.object_key.endsWith('.wav')) ||
      new Set(rows.map(row => row.object_key)).size !== rows.length) fail('Unsafe or oversized ready-media inventory.');
  return rows;
}

function mediaConfig(env) {
  let url;
  try { url = new URL(env.MUSE_BACKUP_SUPABASE_URL); } catch { fail('Explicit Supabase media URL required.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      url.pathname !== '/' || !env.MUSE_BACKUP_SUPABASE_SERVICE_ROLE_KEY) fail('Invalid private media configuration.');
  return { origin: url.origin, headers: {
    apikey: env.MUSE_BACKUP_SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.MUSE_BACKUP_SUPABASE_SERVICE_ROLE_KEY}`,
  } };
}

async function downloadMedia(rows, config, work, fetcher) {
  async function request(route) {
    const response = await fetcher(`${config.origin}/storage/v1/${route}`, {
      headers: config.headers, redirect: 'error', signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) fail('Private media request failed.');
    return response;
  }
  const bucket = await (await request(`bucket/${MEDIA_BUCKET}`)).json();
  if (bucket.id !== MEDIA_BUCKET || bucket.public !== false) fail('Muse storage bucket must be private.');
  const entries = [], files = [];
  for (const [index, row] of rows.entries()) {
    const response = await request(`object/authenticated/${MEDIA_BUCKET}/${row.object_key.split('/').map(encodeURIComponent).join('/')}`);
    if (response.headers.get('content-type')?.split(';')[0] !== row.mime ||
        (response.headers.has('content-length') && Number(response.headers.get('content-length')) !== row.size)) {
      fail('Private media size or MIME mismatch.');
    }
    const file = path.join(work, `media-${index}.object`);
    const handle = await fs.open(file, 'wx', 0o600);
    const hash = crypto.createHash('sha256');
    let bytes = 0;
    try {
      if (!response.body) fail('Missing private media bytes.');
      for await (const chunk of response.body) {
        bytes += chunk.length;
        if (bytes > row.size) fail('Private media exceeds expected size.');
        hash.update(chunk);
        await handle.writeFile(chunk);
      }
    } finally { await handle.close(); }
    if (bytes !== row.size) fail('Truncated private media.');
    entries.push({ ...row, bytes, sha256: hash.digest('hex') });
    files.push(file);
  }
  return { entries, files };
}

async function unseal(input, output, key) {
  const handle = await fs.open(input, 'r');
  try {
    const size = (await handle.stat()).size;
    if (size < 40) fail('Invalid encrypted backup.');
    const header = Buffer.alloc(20), tag = Buffer.alloc(16);
    await handle.read(header, 0, 20, 0);
    await handle.read(tag, 0, 16, size - 16);
    if (!header.subarray(0, 8).equals(MAGIC)) fail('Unsupported encrypted backup format.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, header.subarray(8));
    decipher.setAAD(header);
    decipher.setAuthTag(tag);
    await pipeline(createReadStream(input, { start: 20, end: size - 17 }), decipher,
      createWriteStream(output, { flags: 'wx', mode: 0o600 }));
  } catch {
    await fs.rm(output, { force: true });
    fail('Backup authentication/decryption failed.');
  } finally { await handle.close(); }
}

async function cleanup(directory, { now = Date.now(), days = 7, limit = 100 } = {}) {
  if (!Number.isInteger(days) || days < 1 || days > 365 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    fail('Retention must be 1–365 days; cleanup is bounded to 100 files.');
  }
  const cutoff = now - days * 86400000;
  let removed = 0, eligibleRemaining = 0;
  const dir = await fs.opendir(directory);
  for await (const entry of dir) {
    const match = NAME.exec(entry.name);
    if (!match || !entry.isFile() || Number(match[1]) >= cutoff) continue;
    const file = path.join(directory, entry.name);
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.mtimeMs >= cutoff) continue;
    if (removed >= limit) { eligibleRemaining++; continue; }
    await fs.unlink(file);
    removed++;
  }
  return { days, removed, eligibleRemaining };
}

async function backup(env = process.env, dependencies = {}) {
  const run = dependencies.run || runTool;
  const platform = dependencies.platform || process.platform;
  const secure = dependencies.secureDirectory || secureDirectory;
  const key = readKey(env.MUSE_BACKUP_KEY);
  const childEnv = dbEnvironment(env);
  const includeMedia = env.MUSE_BACKUP_INCLUDE_MEDIA === 'yes';
  if (includeMedia && (env.MUSE_MAINTENANCE_MODE !== 'true' || env.MUSE_BACKUP_PAUSED_WRITES_ACK !== 'yes')) {
    fail('Full backup requires maintenance mode and explicit paused-writes acknowledgement.');
  }
  const storageConfig = includeMedia ? mediaConfig(env) : null;
  if (!includeMedia && env.MUSE_BACKUP_ALLOW_DATABASE_ONLY !== 'yes') {
    fail('Private media objects are not covered. Explicitly set MUSE_BACKUP_ALLOW_DATABASE_ONLY=yes for a database-only backup.');
  }
  if (!env.MUSE_BACKUP_DIR) fail('MUSE_BACKUP_DIR must identify a dedicated private backup directory.');
  const days = env.MUSE_BACKUP_RETENTION_DAYS === undefined ? 7 : Number(env.MUSE_BACKUP_RETENTION_DAYS);
  if (!Number.isInteger(days) || days < 1 || days > 365) fail('Retention must be 1–365 days.');
  const directory = path.resolve(env.MUSE_BACKUP_DIR);
  await secure(directory, run, platform);
  const work = await privateWork(directory, run, platform, secure);
  try {
    const raw = await run('psql', ['-X', '--no-password', '--set=ON_ERROR_STOP=1', '--tuples-only',
      '--no-align', '--command', DISCOVER_SQL], { env: childEnv, capture: true });
    let discovered;
    try { discovered = JSON.parse(raw.trim()); } catch { fail('Schema introspection returned invalid data.'); }
    if (!Array.isArray(discovered) || !discovered.every(t => typeof t === 'string') ||
        discovered.some(t => !TABLES.includes(t))) fail('Unrecognized Muse tables: review and extend the explicit allowlist before backing up.');
    if (REQUIRED_TABLES.some(t => !discovered.includes(t))) fail('Required Muse tables are missing; apply migrations or confirm the connection target.');
    const tables = TABLES.filter(t => discovered.includes(t));
    const missingOptionalTables = OPTIONAL_TABLES.filter(t => !discovered.includes(t));
    const beforeMedia = includeMedia ? await mediaInventory(run, childEnv, tables) : [];
    const dump = path.join(work, 'database.dump');
    await run('pg_dump', ['--no-password', '--format=custom', '--no-owner', '--no-privileges',
      '--strict-names', '--no-blobs', '--lock-wait-timeout=30s', '--file', dump,
      ...tables.flatMap(t => ['--table', `public.${t}`])], { env: childEnv });
    await fs.chmod(dump, 0o600);
    const stat = await fs.lstat(dump);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 5) fail('The database dump is missing or invalid.');
    const list = await run('pg_restore', ['--list', dump], { capture: true });
    validateList(list, tables);
    const media = includeMedia
      ? await downloadMedia(beforeMedia, storageConfig, work, dependencies.fetch || globalThis.fetch)
      : { entries: [], files: [] };
    if (includeMedia && JSON.stringify(beforeMedia) !== JSON.stringify(await mediaInventory(run, childEnv, tables))) {
      fail('Media inventory changed during maintenance backup.');
    }
    const manifest = {
      version: includeMedia ? 2 : 1, createdAt: new Date().toISOString(), databaseFormat: 'postgres-custom',
      tables, missingOptionalTables, database: { bytes: stat.size, sha256: await digest(dump) },
      media: includeMedia ? { status: 'included', bucket: MEDIA_BUCKET, objects: media.entries.length,
        integrity: 'sha256', entries: media.entries, coverage: 'ready-objects-only', pausedWritesAcknowledged: true }
        : { status: 'excluded', objects: 0, integrity: 'not-verified',
          reason: 'Private storage objects require a separately authorized encrypted backup.' },
      fullRecovery: includeMedia,
    };
    const staging = path.join(work, 'artifact.encrypted');
    await seal(dump, manifest, staging, key, media.files);
    // Authenticate the finished artifact before publishing, not just the dump.
    const checked = path.join(work, 'authentication-check');
    await unseal(staging, checked, key);
    await fs.rm(checked);
    const name = `muse-${Date.now()}-${crypto.randomBytes(16).toString('hex')}.musebackup`;
    await fs.rename(staging, path.join(directory, name));
    return { artifact: name, tables: tables.length, missingOptionalTables,
      media: { status: manifest.media.status, objects: manifest.media.objects, integrity: manifest.media.integrity },
      fullRecovery: includeMedia, retention: await cleanup(directory, { days }) };
  } finally {
    key.fill(0);
    await fs.rm(work, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

async function verify(input, env = process.env, dependencies = {}) {
  const run = dependencies.run || runTool;
  const platform = dependencies.platform || process.platform;
  const secure = dependencies.secureDirectory || secureDirectory;
  const key = readKey(env.MUSE_BACKUP_KEY);
  if (!env.MUSE_BACKUP_VERIFY_DIR) fail('MUSE_BACKUP_VERIFY_DIR must be a private rehearsal workspace.');
  const directory = path.resolve(env.MUSE_BACKUP_VERIFY_DIR);
  await secure(directory, run, platform);
  const work = await privateWork(directory, run, platform, secure);
  try {
    const payload = path.join(work, 'authenticated.payload');
    await unseal(path.resolve(input), payload, key);
    const handle = await fs.open(payload, 'r');
    let manifest, offset;
    try {
      const length = Buffer.alloc(4);
      if ((await handle.read(length, 0, 4, 0)).bytesRead !== 4) fail('Invalid manifest.');
      const size = length.readUInt32BE();
      if (size < 2 || size > MAX_MANIFEST) fail('Invalid manifest length.');
      const json = Buffer.alloc(size);
      if ((await handle.read(json, 0, size, 4)).bytesRead !== size) fail('Truncated manifest.');
      manifest = JSON.parse(json.toString('utf8'));
      offset = 4 + size;
    } finally { await handle.close(); }
    const hasMedia = manifest.version === 2;
    if (![1, 2].includes(manifest.version) || manifest.databaseFormat !== 'postgres-custom' ||
        !Array.isArray(manifest.tables) || manifest.tables.some(t => !TABLES.includes(t)) ||
        REQUIRED_TABLES.some(t => !manifest.tables.includes(t)) ||
        new Set(manifest.tables).size !== manifest.tables.length ||
        !Array.isArray(manifest.missingOptionalTables) ||
        JSON.stringify(manifest.missingOptionalTables) !== JSON.stringify(OPTIONAL_TABLES.filter(t => !manifest.tables.includes(t))) ||
        manifest.fullRecovery !== hasMedia ||
        (!hasMedia && (manifest.media?.status !== 'excluded' ||
          manifest.media?.integrity !== 'not-verified' || manifest.media?.objects !== 0)) ||
        (hasMedia && (manifest.media?.status !== 'included' || manifest.media.bucket !== MEDIA_BUCKET ||
          manifest.media.integrity !== 'sha256' || manifest.media.coverage !== 'ready-objects-only' ||
          manifest.media.pausedWritesAcknowledged !== true || !Array.isArray(manifest.media.entries) ||
          manifest.media.entries.length > 100 || manifest.media.objects !== manifest.media.entries.length)) ||
        !Number.isSafeInteger(manifest.database?.bytes) || manifest.database.bytes < 5 ||
        !/^[a-f0-9]{64}$/.test(manifest.database?.sha256)) fail('Unsupported or inconsistent backup manifest.');
    const dump = path.join(work, 'database.dump');
    await pipeline(createReadStream(payload, { start: offset, end: offset + manifest.database.bytes - 1 }),
      createWriteStream(dump, { flags: 'wx', mode: 0o600 }));
    if ((await fs.stat(dump)).size !== manifest.database.bytes ||
        await digest(dump) !== manifest.database.sha256) fail('Database dump integrity check failed.');
    validateList(await run('pg_restore', ['--list', dump], { capture: true }), manifest.tables);
    offset += manifest.database.bytes;
    const seen = new Set();
    if (hasMedia) for (const entry of manifest.media.entries) {
      if (!MEDIA_KEY.test(entry.object_key) || seen.has(entry.object_key) ||
          entry.object_key.split('/')[1] !== entry.story_id ||
          entry.object_key.split('/')[2].split('.')[0] !== entry.id ||
          !Number.isSafeInteger(entry.bytes) || entry.bytes < 1 || entry.bytes > 20971520 ||
          entry.bytes !== entry.size ||
          entry.bytes > (entry.mime === 'audio/wav' ? 5242880 : 20971520) ||
          !['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'audio/wav'].includes(entry.mime) ||
          (entry.mime === 'audio/wav') !== entry.object_key.endsWith('.wav') ||
          !/^[a-f0-9]{64}$/.test(entry.sha256)) fail('Invalid media manifest.');
      seen.add(entry.object_key);
      const hash = crypto.createHash('sha256');
      let bytes = 0;
      for await (const chunk of createReadStream(payload, { start: offset, end: offset + entry.bytes - 1 })) {
        hash.update(chunk); bytes += chunk.length;
      }
      if (bytes !== entry.bytes || hash.digest('hex') !== entry.sha256) fail('Media integrity check failed.');
      offset += bytes;
    }
    if ((await fs.stat(payload)).size !== offset) fail('Unexpected or missing backup payload bytes.');
    if (!hasMedia && env.MUSE_BACKUP_ALLOW_DATABASE_ONLY !== 'yes') {
      fail('Database integrity passed, but media integrity is NOT verified. This is not a full recovery backup.');
    }
    return { authenticated: true, databaseIntegrity: true, archiveListValidated: true,
      mediaIntegrity: hasMedia ? 'verified' : 'not-verified', fullRecovery: hasMedia, restoreExecuted: false,
      missingOptionalTables: manifest.missingOptionalTables };
  } finally {
    key.fill(0);
    await fs.rm(work, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

async function main() {
  try { console.log(JSON.stringify(await backup(), null, 2)); }
  catch { console.error('Muse backup FAILED. Check private directory permissions, key, TLS connection, table migrations and local PostgreSQL tools. No full recovery coverage is claimed.'); process.exitCode = 1; }
}

module.exports = { backup, verify, cleanup, readKey, validateList, runTool, seal, unseal,
  REQUIRED_TABLES, OPTIONAL_TABLES, TABLES, DISCOVER_SQL };
if (require.main === module) main();
