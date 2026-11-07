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
const cmd = 'bun';
const args = ['test', ...testFiles];

const result = spawnSync(cmd, args, { stdio: 'inherit' });
if (result.error) {
  console.error('Test execution error:', result.error);
  process.exit(1);
}
process.exit(result.status ?? 0);
