import 'dotenv/config';
import { createFleetApiKey } from '../server/auth/apiKeyService';

async function main() {
  const args = process.argv.slice(2);
  const fleetId = args[0] || 'FLEET-ENTERPRISE-01';
  const name = args[1] || 'Production Commercial Carrier Key';

  console.log('================================================================');
  console.log(' TRUCKWITHEASE // SECURE FLEET API KEY GENERATOR');
  console.log('================================================================');
  console.log(`Generating API Key for Fleet ID: [${fleetId}]`);
  console.log(`Key Description:               [${name}]`);

  try {
    const { rawKey, record } = await createFleetApiKey(fleetId, name);

    console.log('\n[SUCCESS] New Fleet API Key generated and registered in Firestore!');
    console.log('----------------------------------------------------------------');
    console.log(`Fleet ID:     ${record.fleetId}`);
    console.log(`Key Name:     ${record.name}`);
    console.log(`Created At:   ${record.createdAt}`);
    console.log(`Key Prefix:   ${record.keyPrefix}`);
    console.log('----------------------------------------------------------------');
    console.log('\n>>> RAW API KEY (PRINTED ONCE - SAVE SECURELY NOW):');
    console.log(rawKey);
    console.log('----------------------------------------------------------------');
    console.log('NOTE: The raw key is NEVER stored or logged again. Only its SHA-256');
    console.log('cryptographic hash is retained in Firestore.\n');
  } catch (err) {
    console.error('\n[ERROR] Failed to generate fleet key:', (err as Error).message);
    process.exit(1);
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
