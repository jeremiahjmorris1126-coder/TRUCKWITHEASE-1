import { execSync } from 'child_process';

async function main() {
  const token = execSync('gcloud auth print-access-token', { encoding: 'utf-8' }).trim();
  const projectId = 'project-f0634118-be01-44f7-b36';
  const databaseId = 'app-builder-38a26d99';
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents`;

  const collections = [
    'loads',
    'freight_loads',
    'driver_profiles',
    'driver_documents',
    'vehicle_profiles',
    'aux_alerts',
    'users',
    'fleet_api_keys',
    'detentionActiveStops',
    'detentionEvents',
    'detentionCursors',
    'partner_cache',
    'routing_cache',
    'system_health_probes'
  ];

  console.log(`Auditing Firestore Database: ${projectId}/${databaseId}`);
  console.log('='.repeat(65));
  console.log(String('Collection').padEnd(25) + String('Total Docs').padEnd(15) + String('Missing fleetId').padEnd(18) + 'Status');
  console.log('-'.repeat(65));

  for (const col of collections) {
    try {
      const res = await fetch(`${baseUrl}/${col}?pageSize=300`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 404) {
          console.log(String(col).padEnd(25) + String(0).padEnd(15) + String(0).padEnd(18) + 'EMPTY / NOT FOUND');
        } else {
          console.log(String(col).padEnd(25) + String(`HTTP ${res.status}`).padEnd(15) + String('-').padEnd(18) + res.statusText);
        }
        continue;
      }
      const data = await res.json();
      const docs = data.documents || [];
      const missing = docs.filter(d => !d.fields || !d.fields.fleetId || !d.fields.fleetId.stringValue).length;
      console.log(String(col).padEnd(25) + String(docs.length).padEnd(15) + String(missing).padEnd(18) + (missing > 0 ? 'NEEDS BACKFILL' : 'CLEAN'));
    } catch (err) {
      console.log(String(col).padEnd(25) + 'ERROR: ' + err.message);
    }
  }
  console.log('='.repeat(65));
}

main().catch(console.error);
