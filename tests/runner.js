import { spawnSync } from 'child_process';

const isBun = Boolean(process.versions && process.versions.bun);
const cmd = isBun ? 'bun' : 'node';
const args = isBun ? ['test'] : ['--test', 'tests/cockpit.test.js'];

const result = spawnSync(cmd, args, { stdio: 'inherit' });
if (result.error) {
  console.error('Test execution error:', result.error);
  process.exit(1);
}
process.exit(result.status ?? 0);
