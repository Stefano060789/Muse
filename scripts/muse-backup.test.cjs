'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { backup, verify, cleanup, readKey, validateList, runTool, seal, unseal,
  REQUIRED_TABLES, OPTIONAL_TABLES, TABLES } = require('./muse-backup.cjs');

const fakeDump = Buffer.from('PGDMP\x01private story data; capability hashes; no network');
function archiveList(tables) {
  return tables.map((table, index) => `${index + 1}; 0 100 TABLE DATA public ${table} owner`).join('\n');
}

async function fixture(t, options = {}) {
  const root = path.join(__dirname, `.muse-backup-test-${crypto.randomBytes(12).toString('hex')}`);
  await fs.mkdir(root, { mode: 0o700 });
  t.after(() => fs.rm(root, { recursive: true, force: true, maxRetries: 3 }));
  const env = {
    MUSE_BACKUP_DIR: path.join(root, 'backups'),
    MUSE_BACKUP_VERIFY_DIR: path.join(root, 'rehearsal'),
    MUSE_BACKUP_KEY: crypto.randomBytes(32).toString('base64'),
    MUSE_BACKUP_DATABASE_URL: 'postgresql://operator:SECRET_PASSWORD@example.invalid/muse?sslmode=require',
    MUSE_BACKUP_ALLOW_DATABASE_ONLY: 'yes',
  };
  const calls = [];
  const tables = options.tables || REQUIRED_TABLES;
  const run = async (tool, args, config = {}) => {
    calls.push({ tool, args, config });
    if (tool === 'powershell.exe') return runTool(tool, args, config);
    if (options.failTool === tool) throw new Error('SECRET_PASSWORD sensitive tool error');
    if (tool === 'psql') return options.discovery || JSON.stringify(tables);
    if (tool === 'pg_dump') {
      await fs.writeFile(args[args.indexOf('--file') + 1], fakeDump);
      if (options.dumpFailure) throw new Error('failure after plaintext write');
      return '';
    }
    if (tool === 'pg_restore') return options.list || archiveList(tables);
    throw new Error(`Unexpected tool: ${tool}`);
  };
  const dependencies = { run };
  if (!options.platform) dependencies.secureDirectory = directory => fs.mkdir(directory, { recursive: true, mode: 0o700 });
  return { root, env, calls, dependencies };
}

async function assertNoPlaintext(directory) {
  const names = await fs.readdir(directory);
  assert.ok(names.every(name => /^muse-\d{13}-[a-f0-9]{32}\.musebackup$/.test(name)), names.join(','));
}

test('targeted backup authenticates, verifies offline, and records incomplete media coverage', async t => {
  const { env, calls, dependencies } = await fixture(t);
  const result = await backup(env, dependencies);
  assert.equal(result.fullRecovery, false);
  assert.equal(result.media.status, 'excluded');
  assert.deepEqual(result.missingOptionalTables, OPTIONAL_TABLES);
  const dumpCall = calls.find(call => call.tool === 'pg_dump');
  const selected = dumpCall.args.flatMap((arg, i) => arg === '--table' ? [dumpCall.args[i + 1]] : []);
  assert.deepEqual(selected, REQUIRED_TABLES.map(table => `public.${table}`));
  assert.ok(dumpCall.args.includes('--no-blobs'));
  assert.ok(dumpCall.args.includes('--strict-names'));
  for (const call of calls) {
    assert.ok(!JSON.stringify(call.args).includes('SECRET_PASSWORD'));
    assert.ok(!JSON.stringify(call.args).includes(env.MUSE_BACKUP_KEY));
    assert.ok(!call.config.env?.MUSE_BACKUP_KEY);
  }
  assert.equal(dumpCall.config.env.PGDATABASE, env.MUSE_BACKUP_DATABASE_URL);
  const artifact = path.join(env.MUSE_BACKUP_DIR, result.artifact);
  const encrypted = await fs.readFile(artifact);
  assert.ok(!encrypted.includes(fakeDump));
  const verified = await verify(artifact, env, dependencies);
  assert.equal(verified.authenticated, true);
  assert.equal(verified.mediaIntegrity, 'not-verified');
  assert.equal(verified.restoreExecuted, false);
  await assertNoPlaintext(env.MUSE_BACKUP_DIR);
  assert.deepEqual(await fs.readdir(env.MUSE_BACKUP_VERIFY_DIR), []);
  assert.ok(calls.filter(call => call.tool === 'pg_restore').every(call => call.args[0] === '--list'));
});

test('optional operational tables are explicitly discovered and included when present', async t => {
  const { env, calls, dependencies } = await fixture(t, { tables: TABLES });
  const result = await backup(env, dependencies);
  assert.deepEqual(result.missingOptionalTables, []);
  const args = calls.find(call => call.tool === 'pg_dump').args;
  for (const table of OPTIONAL_TABLES) assert.ok(args.includes(`public.${table}`));
});

test('no acknowledgement, weak key, missing output and non-TLS URL fail before tools', async t => {
  const { env, calls, dependencies } = await fixture(t);
  await assert.rejects(backup({ ...env, MUSE_BACKUP_ALLOW_DATABASE_ONLY: '' }, dependencies), /Private media/);
  await assert.rejects(backup({ ...env, MUSE_BACKUP_KEY: Buffer.alloc(32).toString('base64') }, dependencies), /strong/);
  await assert.rejects(backup({ ...env, MUSE_BACKUP_DIR: '' }, dependencies), /directory/);
  await assert.rejects(backup({ ...env, MUSE_BACKUP_DATABASE_URL: 'postgresql://user:pass@example.invalid/db' }, dependencies), /TLS/);
  assert.equal(calls.length, 0);
  assert.throws(() => readKey('not-a-key'), /base64/);
});

test('unknown Muse tables, missing required tables and invalid discovery fail closed', async t => {
  for (const options of [
    { tables: [...REQUIRED_TABLES, 'muse_new_feature'] },
    { tables: REQUIRED_TABLES.slice(1) },
    { discovery: 'not JSON' },
    { discovery: '{}' },
  ]) {
    const { env, calls, dependencies } = await fixture(t, options);
    await assert.rejects(backup(env, dependencies));
    assert.ok(!calls.some(call => call.tool === 'pg_dump'));
    await assertNoPlaintext(env.MUSE_BACKUP_DIR);
  }
});

test('failed dump and list validation remove plaintext and never publish an artifact', async t => {
  for (const options of [
    { dumpFailure: true },
    { failTool: 'pg_restore' },
    { list: archiveList([...REQUIRED_TABLES, 'ivote_ballots']) },
    { list: archiveList(REQUIRED_TABLES.slice(1)) },
  ]) {
    const { env, dependencies } = await fixture(t, options);
    await assert.rejects(backup(env, dependencies));
    assert.deepEqual(await fs.readdir(env.MUSE_BACKUP_DIR), []);
  }
});

test('GCM rejects wrong keys, ciphertext/header/tag changes, and truncation with cleanup', async t => {
  const { env, dependencies } = await fixture(t);
  const result = await backup(env, dependencies);
  const original = await fs.readFile(path.join(env.MUSE_BACKUP_DIR, result.artifact));
  const mutated = path.join(env.MUSE_BACKUP_DIR, 'test-mutated.encrypted');
  await assert.rejects(verify(path.join(env.MUSE_BACKUP_DIR, result.artifact),
    { ...env, MUSE_BACKUP_KEY: crypto.randomBytes(32).toString('base64') }, dependencies), /authentication/);
  for (const index of [0, 10, 30, original.length - 1]) {
    const data = Buffer.from(original);
    data[index] ^= 1;
    await fs.writeFile(mutated, data);
    await assert.rejects(verify(mutated, env, dependencies), /authentication/);
    assert.deepEqual(await fs.readdir(env.MUSE_BACKUP_VERIFY_DIR), []);
  }
  await fs.writeFile(mutated, original.subarray(0, 30));
  await assert.rejects(verify(mutated, env, dependencies), /authentication/);
});

test('verification does not disguise excluded media as successful full recovery', async t => {
  const { env, dependencies } = await fixture(t);
  const result = await backup(env, dependencies);
  await assert.rejects(verify(path.join(env.MUSE_BACKUP_DIR, result.artifact),
    { ...env, MUSE_BACKUP_ALLOW_DATABASE_ONLY: '' }, dependencies), /media integrity is NOT verified/);
  assert.deepEqual(await fs.readdir(env.MUSE_BACKUP_VERIFY_DIR), []);
});

test('authenticated but inconsistent payload cannot pass database integrity', async t => {
  const { root, env, dependencies } = await fixture(t);
  const dump = path.join(root, 'fixture.dump');
  await fs.writeFile(dump, fakeDump);
  const input = path.join(root, 'inconsistent.encrypted');
  await seal(dump, {
    version: 1, databaseFormat: 'postgres-custom', tables: REQUIRED_TABLES,
    missingOptionalTables: OPTIONAL_TABLES, fullRecovery: false,
    media: { status: 'excluded', integrity: 'not-verified', objects: 0 },
    database: { bytes: fakeDump.length, sha256: '0'.repeat(64) },
  }, input, readKey(env.MUSE_BACKUP_KEY));
  await assert.rejects(verify(input, env, dependencies), /integrity check/);
  assert.deepEqual(await fs.readdir(env.MUSE_BACKUP_VERIFY_DIR), []);
});

test('TOC validation rejects other schemas and unsupported blob/sequence data', () => {
  for (const extra of [
    '99; 0 100 TABLE DATA public profiles owner',
    '99; 0 100 TABLE DATA private shared_stories owner',
    '99; 0 100 TABLE public ivote_votes owner',
    '99; 0 100 BLOBS - BLOBS owner',
    '99; 0 100 SEQUENCE SET public vote_id_seq owner',
  ]) assert.throws(() => validateList(`${archiveList(REQUIRED_TABLES)}\n${extra}`, REQUIRED_TABLES));
});

test('retention is bounded and only removes old, named, regular backup files', async t => {
  const { root } = await fixture(t);
  const now = Date.now();
  const names = [
    `muse-${now - 9 * 86400000}-${'1'.repeat(32)}.musebackup`,
    `muse-${now - 9 * 86400000}-${'2'.repeat(32)}.musebackup`,
    `muse-${now}-${'3'.repeat(32)}.musebackup`,
    `muse-${now - 9 * 86400000}-${'4'.repeat(32)}.musebackup`,
    'unrelated.dump', '.muse-work-do-not-delete', 'muse-not-a-backup.musebackup',
  ];
  for (const name of names) await fs.writeFile(path.join(root, name), 'fixture');
  for (const name of names.slice(0, 2)) await fs.utimes(path.join(root, name), new Date(0), new Date(0));
  const result = await cleanup(root, { now, days: 7, limit: 1 });
  assert.equal(result.removed, 1);
  assert.equal(result.eligibleRemaining, 1);
  const remaining = await fs.readdir(root);
  for (const name of names.slice(2)) assert.ok(remaining.includes(name));
  await assert.rejects(cleanup(root, { days: 0 }));
});

test('local tool runner sanitizes failures and has a timeout', async () => {
  await assert.rejects(runTool(process.execPath, ['-e', 'console.error("SECRET");process.exit(2)']), error =>
    !error.message.includes('SECRET'));
  await assert.rejects(runTool(process.execPath, ['-e', 'setTimeout(()=>{},10000)'], { timeout: 40 }), /failed/);
});

test('permission failure is fail-closed before PostgreSQL tools are called', async t => {
  const { env, dependencies, calls } = await fixture(t);
  dependencies.secureDirectory = async () => { throw new Error('Permission setup failed'); };
  await assert.rejects(backup(env, dependencies), /Permission setup failed/);
  assert.deepEqual(calls, []);
});

async function mediaFixture(t, options = {}) {
  const context = await fixture(t);
  const bytes = Buffer.from('private-photo-bytes-never-public');
  const row = {
    id: '22222222-2222-2222-2222-222222222222',
    story_id: '11111111-1111-1111-1111-111111111111',
    object_key: 'stories/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.jpg',
    size: bytes.length, mime: 'image/jpeg',
  };
  Object.assign(context.env, {
    MUSE_BACKUP_INCLUDE_MEDIA: 'yes', MUSE_MAINTENANCE_MODE: 'true',
    MUSE_BACKUP_PAUSED_WRITES_ACK: 'yes', MUSE_BACKUP_SUPABASE_URL: 'https://muse.example.invalid',
    MUSE_BACKUP_SUPABASE_SERVICE_ROLE_KEY: 'fake-service-role-never-network',
    MUSE_BACKUP_ALLOW_DATABASE_ONLY: '',
  });
  const dbRun = context.dependencies.run;
  let inventories = 0;
  context.dependencies.run = (tool, args, config) => {
    if (tool === 'psql' && args.some(arg => arg.includes("where status = 'ready'"))) {
      inventories++;
      return Promise.resolve(JSON.stringify(options.changedInventory && inventories > 1 ? [] : [row]));
    }
    return dbRun(tool, args, config);
  };
  const requests = [];
  context.dependencies.fetch = async (url, config) => {
    requests.push({ url, config });
    assert.equal(new URL(url).origin, 'https://muse.example.invalid');
    assert.ok(url.includes('/muse-shared-media'));
    assert.equal(config.redirect, 'error');
    if (url.includes('/bucket/')) return Response.json({ id: 'muse-shared-media', public: !!options.publicBucket });
    if (options.missing) return new Response(null, { status: 404 });
    const data = options.truncated ? bytes.subarray(0, bytes.length - 1) : bytes;
    return new Response(data, { headers: { 'content-type': 'image/jpeg',
      'content-length': String(options.badSize ? bytes.length + 1 : data.length) } });
  };
  return { ...context, bytes, row, requests };
}

test('full scoped private-media backup encrypts object bytes and verifies them offline', async t => {
  const { env, dependencies, bytes, requests } = await mediaFixture(t);
  const result = await backup(env, dependencies);
  assert.equal(result.fullRecovery, true);
  assert.equal(result.media.objects, 1);
  const artifact = path.join(env.MUSE_BACKUP_DIR, result.artifact);
  const data = await fs.readFile(artifact);
  assert.ok(!data.includes(bytes));
  assert.ok(!data.includes(Buffer.from(env.MUSE_BACKUP_SUPABASE_SERVICE_ROLE_KEY)));
  assert.ok(!data.includes(Buffer.from(env.MUSE_BACKUP_SUPABASE_URL)));
  const payload = path.join(env.MUSE_BACKUP_DIR, 'test-decrypted-payload');
  await unseal(artifact, payload, readKey(env.MUSE_BACKUP_KEY));
  const plaintext = await fs.readFile(payload);
  const manifest = JSON.parse(plaintext.subarray(4, 4 + plaintext.readUInt32BE()).toString());
  assert.ok(plaintext.includes(bytes));
  assert.ok(!JSON.stringify(manifest).includes('https://'));
  assert.ok(!JSON.stringify(manifest).includes(env.MUSE_BACKUP_SUPABASE_SERVICE_ROLE_KEY));
  assert.equal(manifest.media.entries[0].sha256, crypto.createHash('sha256').update(bytes).digest('hex'));
  await fs.rm(payload);
  const verified = await verify(artifact, env, dependencies);
  assert.equal(verified.mediaIntegrity, 'verified');
  assert.equal(verified.fullRecovery, true);
  assert.equal(requests.length, 2);
  assert.ok(requests[1].url.includes('/object/authenticated/muse-shared-media/stories/'));
  const changed = Buffer.from(data); changed[changed.length - 20] ^= 1;
  const tampered = path.join(env.MUSE_BACKUP_DIR, 'tampered-media.encrypted');
  await fs.writeFile(tampered, changed);
  await assert.rejects(verify(tampered, env, dependencies), /authentication/);
  assert.deepEqual(await fs.readdir(env.MUSE_BACKUP_VERIFY_DIR), []);
});

test('missing, corrupt, public-bucket or changing media fails the entire backup and cleans plaintext', async t => {
  for (const options of [{ missing: true }, { truncated: true }, { badSize: true },
    { publicBucket: true }, { changedInventory: true }]) {
    const { env, dependencies } = await mediaFixture(t, options);
    await assert.rejects(backup(env, dependencies));
    assert.deepEqual(await fs.readdir(env.MUSE_BACKUP_DIR), []);
  }
});

test('full media backup requires both maintenance and explicit paused-write acknowledgement', async t => {
  const { env, dependencies, calls, requests } = await mediaFixture(t);
  await assert.rejects(backup({ ...env, MUSE_MAINTENANCE_MODE: 'false' }, dependencies), /maintenance/);
  await assert.rejects(backup({ ...env, MUSE_BACKUP_PAUSED_WRITES_ACK: '' }, dependencies), /maintenance/);
  assert.deepEqual(calls, []);
  assert.deepEqual(requests, []);
});

test('authenticated media payload with wrong stored checksum is rejected', async t => {
  const { root, env, dependencies, row, bytes } = await mediaFixture(t);
  const dump = path.join(root, 'mock.dump'), media = path.join(root, 'mock.object');
  await fs.writeFile(dump, fakeDump); await fs.writeFile(media, bytes);
  const artifact = path.join(root, 'bad-media.encrypted');
  await seal(dump, {
    version: 2, databaseFormat: 'postgres-custom', tables: REQUIRED_TABLES,
    missingOptionalTables: OPTIONAL_TABLES, fullRecovery: true,
    database: { bytes: fakeDump.length, sha256: crypto.createHash('sha256').update(fakeDump).digest('hex') },
    media: { status: 'included', bucket: 'muse-shared-media', integrity: 'sha256', objects: 1,
      coverage: 'ready-objects-only', pausedWritesAcknowledged: true,
      entries: [{ ...row, bytes: bytes.length, sha256: '0'.repeat(64) }] },
  }, artifact, readKey(env.MUSE_BACKUP_KEY), [media]);
  await assert.rejects(verify(artifact, env, dependencies), /Media integrity/);
  assert.deepEqual(await fs.readdir(env.MUSE_BACKUP_VERIFY_DIR), []);
});

test('Windows directories receive a real restricted DACL before mock database writes', {
  skip: process.platform !== 'win32',
}, async t => {
  const { env, dependencies, calls } = await fixture(t, { platform: 'win32' });
  const result = await backup(env, dependencies);
  assert.equal(result.fullRecovery, false);
  assert.equal(calls[0].tool, 'powershell.exe');
  assert.ok(calls[0].args.join(' ').includes('SetAccessRuleProtection'));
  const acl = JSON.parse(await runTool('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    "$a=[System.IO.Directory]::GetAccessControl($env:MUSE_PRIVATE_DIRECTORY); " +
    "[pscustomobject]@{Protected=$a.AreAccessRulesProtected;Count=@($a.Access).Count; " +
    "OnlyCurrentUser=($a.Access[0].IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value " +
    "-eq [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value)} | ConvertTo-Json -Compress"],
  { env: { ...process.env, MUSE_PRIVATE_DIRECTORY: env.MUSE_BACKUP_DIR }, capture: true }));
  assert.equal(acl.Protected, true);
  assert.equal(acl.Count, 1);
  assert.equal(acl.OnlyCurrentUser, true);
  await verify(path.join(env.MUSE_BACKUP_DIR, result.artifact), env, dependencies);
});
