'use strict';

const { verify } = require('./muse-backup.cjs');

async function main() {
  try {
    if (process.argv.length !== 3) throw new Error('Exactly one encrypted artifact path is required.');
    console.log(JSON.stringify(await verify(process.argv[2]), null, 2));
  } catch {
    console.error('Muse backup verification FAILED. Check the key, artifact, private rehearsal directory and pg_restore. Database-only artifacts require explicit acknowledgement. No restore was performed.');
    process.exitCode = 1;
  }
}
if (require.main === module) main();
