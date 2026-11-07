import { spawnSync } from 'child_process';

const testFiles = [
  'tests/cockpit.test.js',
  'tests/backend.test.js',
  'tests/crossTenantIsolation.test.js',
  'tests/phase2UnifyCore.test.js',
  'tests/phase3EndToEnd.test.js',
  'tests/phase3NewRoutes.test.ts',
  'tests/phase4OfflineSync.test.ts',
  'tests/bundleEldAudit.test.ts',
];

// Each file runs in its own bun process. The backend keeps seed data in a
// process-global in-memory store (fleetStore), and some suites (e.g.
// crossTenantIsolation) clear it for isolation. Running every file in one
// process lets those resets leak into unrelated suites and produce false
// failures depending on execution order.
const failed = [];
for (const file of testFiles) {
  console.log(`\n=== ${file} ===`);
  const result = spawnSync('bun', ['test', file], { stdio: 'inherit' });
  if (result.error) {
    console.error('Test execution error:', result.error);
    process.exit(1);
  }
  if (result.status !== 0) failed.push(file);
}

if (failed.length) {
  console.error(`\n${failed.length}/${testFiles.length} test file(s) failed:\n  ${failed.join('\n  ')}`);
  process.exit(1);
}
console.log(`\nAll ${testFiles.length} test files passed.`);
