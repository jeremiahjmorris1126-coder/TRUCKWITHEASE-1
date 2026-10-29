import http from 'http';
import { spawn } from 'child_process';

async function main() {
  const proc = spawn('node', ['dist/server.cjs'], {
    env: { ...process.env, PORT: '3044', SERVE_STATIC: 'true' },
    stdio: 'inherit'
  });

  await new Promise(r => setTimeout(r, 2000));

  console.log('Sending request to /api/nonexistent-endpoint...');
  const res = await fetch('http://127.0.0.1:3044/api/nonexistent-endpoint');
  console.log('STATUS:', res.status);
  console.log('DATA:', await res.json());

  proc.kill();
  process.exit(0);
}

main().catch(console.error);
