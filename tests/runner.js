import { spawnSync } from 'child_process';

const isBun = Boolean(process.versions && process.versions.bun);
const cmd = isBun ? 'bun' : 'node';
const args = isBun ? ['test'] : ['--experimental-strip-types', '--test', 'tests/cockpit.test.js', 'tests/error_logging.test.js', 'tests/telecom.test.js', 'tests/api_integration.test.js'];

const result = spawnSync(cmd, args, {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'test',
  },
});
if (result.error) {
  console.error('Test execution error:', result.error);
  process.exit(1);
}
process.exit(result.status ?? 0);
