// SPDX-License-Identifier: MIT
// Run napplet-conformance against every committed build in dist/; fail if any build fails.
import { readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

let failed = 0;
for (const name of readdirSync('dist').sort()) {
  console.log(`\n== ${name}`);
  try { execSync(`napplet-conformance dist/${name}`, { stdio: 'inherit' }); } catch { failed++; }
}
if (failed) { console.error(`\n${failed} build(s) not conformant.`); process.exit(1); }
