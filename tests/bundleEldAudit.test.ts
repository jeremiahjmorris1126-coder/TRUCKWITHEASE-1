import { describe, expect, it } from 'bun:test';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { FEATURE_FLAGS, ENABLE_TELEMETRY_SCREEN } from '../src/config/featureFlags';

const FORBIDDEN_TERMS = [
  'checkr',
  'prepass',
  'drivewyze',
  'watsonx',
  'ibm sterling',
  'quantum',
  'anneal',
  'merkle',
  'nasa',
  'J1939',
  'CAN-bus',
  'canbus',
  '10hz',
  'weigh station: open',
  'fmcsa certified',
  'jeremiah',
  'verified: true',
  'simulatedDwell',
  'erods',
  'fmcsa_portal_sync',
  'dataconnect',
];

const SOURCE_TARGETS = [
  'src',
  'server',
  'detention-proof',
  'public',
  'server.ts',
  'index.html',
];

const BUNDLE_TARGETS = ['dist'];

function collectFiles(targetPath: string, fileList: string[] = []): string[] {
  if (!existsSync(targetPath)) return fileList;
  const stat = statSync(targetPath);
  if (stat.isFile()) {
    if (/\.(ts|tsx|js|cjs|mjs|json|html|css)$/i.test(targetPath)) {
      fileList.push(targetPath);
    }
    return fileList;
  }
  for (const entry of readdirSync(targetPath, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const fullPath = join(targetPath, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, fileList);
    } else if (/\.(ts|tsx|js|cjs|mjs|json|html|css)$/i.test(entry.name)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function countOccurrencesCaseInsensitive(textLower: string, termLower: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = textLower.indexOf(termLower, pos)) !== -1) {
    count++;
    pos += termLower.length;
  }
  return count;
}

describe('ELD REGULATORY COMPLIANCE AUDIT: ZERO SELF-MADE HOS LOGS OR UNREQUESTED MODULES', () => {
  it('searches source folders AND the built bundle (case-insensitive) for all 15 forbidden terms and fails if any match is found', () => {
    const rootDir = process.cwd();
    const distDir = join(rootDir, 'dist');
    expect(existsSync(distDir)).toBe(true);

    const allFiles: string[] = [];
    for (const target of [...SOURCE_TARGETS, ...BUNDLE_TARGETS]) {
      collectFiles(join(rootDir, target), allFiles);
    }

    expect(allFiles.length).toBeGreaterThan(0);

    const termTotals: Record<string, number> = {};
    for (const term of FORBIDDEN_TERMS) {
      termTotals[term] = 0;
    }

    const matchedFilesReport: Array<{ file: string; termCounts: Record<string, number>; total: number }> = [];
    const scannedFilesSummary: Array<{ file: string; matches: number }> = [];

    for (const filePath of allFiles) {
      const relPath = relative(rootDir, filePath).replace(/\\/g, '/');
      const contentLower = readFileSync(filePath, 'utf8').toLowerCase();
      let fileMatchTotal = 0;
      const fileTermCounts: Record<string, number> = {};

      for (const term of FORBIDDEN_TERMS) {
        const count = countOccurrencesCaseInsensitive(contentLower, term.toLowerCase());
        if (count > 0) {
          fileTermCounts[term] = count;
          fileMatchTotal += count;
          termTotals[term] += count;
        }
      }

      scannedFilesSummary.push({ file: relPath, matches: fileMatchTotal });
      if (fileMatchTotal > 0) {
        matchedFilesReport.push({
          file: relPath,
          termCounts: fileTermCounts,
          total: fileMatchTotal,
        });
      }
    }

    console.log('=== CASE-INSENSITIVE FORBIDDEN TERM SCAN OUTPUT ===');
    console.log(`Total files scanned (source + dist): ${allFiles.length}`);
    for (const term of FORBIDDEN_TERMS) {
      console.log(`Term "${term}": ${termTotals[term]} matches`);
    }
    if (matchedFilesReport.length === 0) {
      console.log('Files with matches: 0');
    } else {
      for (const item of matchedFilesReport) {
        console.log(`MATCH FOUND in ${item.file}: ${JSON.stringify(item.termCounts)} (total=${item.total})`);
      }
    }

    expect(matchedFilesReport).toEqual([]);
    for (const term of FORBIDDEN_TERMS) {
      expect(termTotals[term]).toBe(0);
    }
  });

  it('strictly verifies zero unrequested features, outside company names, or self-made HOS code in production bundles', () => {
    const distDir = join(process.cwd(), 'dist');
    const assetsDir = join(distDir, 'assets');

    expect(existsSync(distDir)).toBe(true);

    // Read all built client js files
    let clientBundleContent = '';
    if (existsSync(assetsDir)) {
      const assetFiles = readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
      for (const file of assetFiles) {
        clientBundleContent += readFileSync(join(assetsDir, file), 'utf8') + '\n';
      }
    }

    // Read built server cjs file
    const serverBundlePath = join(distDir, 'server.cjs');
    let serverBundleContent = '';
    if (existsSync(serverBundlePath)) {
      serverBundleContent = readFileSync(serverBundlePath, 'utf8');
    }

    // FORBIDDEN SYMBOLS & CALCULATIONS: Must NOT exist in client bundle
    const forbiddenInClient = [
      'HosDailyLogPdfModal',
      'BluetoothEldModal',
      'bluetoothEldService',
      'NasaGoogleCloseUpOrbitalSpotter',
      'nasaOrbitalSpotterService',
      'calculateLiveClocks',
      'evaluateSplitSleeperBerth',
      'calculateNasaVerification',
      'AUTO_DRIVE_SPEED_MPH',
      'fmcsaAutoDutyTrigger',
      'CheckrBackgroundCheckModal',
      'checkrClientService',
      'bypassClientService',
      'HardwareStoreScreen',
      'hardwareClientService',
      'fleetFederalVaultService',
      'signLegalAttestation',
      'QuantumIndexScreen',
      'QuantumAlertnessReportCard',
      'quantumPredictiveService',
      'processQuantumPredictiveAnalytics',
      'HSM SEAL VERIFIED',
      'drv-jeremiah-904',
    ];

    for (const pattern of forbiddenInClient) {
      const foundInClient = clientBundleContent.includes(pattern);
      expect(foundInClient).toBe(false);
    }

    // FORBIDDEN ROUTES & MODULES: Must NOT exist in server bundle
    const forbiddenInServer = [
      '/api/quantum/hos-optimizer',
      '/v1/eld/live-state',
      '/v1/eld/split-sleeper/evaluate',
      '/v1/checkr',
      '/v1/bypass',
      '/v1/prepass',
      '/api/ibm',
      '/v1/hardware',
      '/api/predictive',
      '/api/quantum',
      '/api/driver/duty-status',
      '/v1/driver/duty-status',
    ];

    for (const pattern of forbiddenInServer) {
      const foundInServer = serverBundleContent.includes(pattern);
      expect(foundInServer).toBe(false);
    }

    // MANDATORY COMPLIANCE STRING:
    // Must display "Hours of service come from your ELD. Connect your ELD to view them here."
    const requiredNotice = 'Hours of service come from your ELD. Connect your ELD to view them here.';
    expect(clientBundleContent.includes(requiredNotice)).toBe(true);

    // UNREQUESTED PARTNER FLAGS & TELEMETRY SCREEN STAY OFF
    expect(FEATURE_FLAGS.ENABLE_THIRD_PARTY_PARTNERS).toBe(false);
    expect(FEATURE_FLAGS.ENABLE_TWILIO_TELEPHONY).toBe(false);
    expect(ENABLE_TELEMETRY_SCREEN).toBe(false);
  });

  it('verifies source code contains zero self-made HOS calculators or unrequested feature modules', () => {
    const deletedSourceFiles = [
      'src/components/HosDailyLogPdfModal.tsx',
      'src/components/BluetoothEldModal.tsx',
      'src/services/bluetoothEldService.ts',
      'src/components/NasaGoogleCloseUpOrbitalSpotter.tsx',
      'src/services/nasaOrbitalSpotterService.ts',
      'src/services/nasaEldTimeService.ts',
      'src/services/eldCalculations.ts',
      'server/eld/eldTimeService.ts',
      'server/eld/types.ts',
      'server/checkr/checkrService.ts',
      'server/checkr/types.ts',
      'src/services/checkrClientService.ts',
      'src/components/CheckrBackgroundCheckModal.tsx',
      'tests/checkrBackgroundCheck.test.ts',
      'server/bypass/bypassService.ts',
      'src/services/bypassClientService.ts',
      'tests/prepassHardwareIbm.test.ts',
      'server/ibm/ibmSterlingService.ts',
      'server/hardware/hardwareOrderService.ts',
      'src/services/hardwareClientService.ts',
      'src/components/screens/HardwareStoreScreen.tsx',
      'src/services/fleetFederalVaultService.ts',
      'src/services/quantumPredictiveService.ts',
      'src/components/screens/QuantumIndexScreen.tsx',
      'src/components/QuantumAlertnessReportCard.tsx',
    ];

    for (const relativePath of deletedSourceFiles) {
      const fullPath = join(process.cwd(), relativePath);
      expect(existsSync(fullPath)).toBe(false);
    }
  });
});
