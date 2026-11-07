import { describe, expect, it } from 'bun:test';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { FEATURE_FLAGS } from '../src/config/featureFlags';

describe('ELD REGULATORY COMPLIANCE AUDIT: ZERO SELF-MADE HOS LOGS OR UNREQUESTED MODULES', () => {
  // 1. Bundle verification
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

    // UNREQUESTED PARTNER FLAGS STAY OFF
    expect(FEATURE_FLAGS.ENABLE_THIRD_PARTY_PARTNERS).toBe(false);
    expect(FEATURE_FLAGS.ENABLE_TWILIO_TELEPHONY).toBe(false);
  });

  // 2. Source Tree Audit: Ensure deleted modules are not in the repository
  it('verifies source code contains zero self-made HOS calculators or unrequested feature modules', () => {
    const deletedSourceFiles = [
      'src/components/HosDailyLogPdfModal.tsx',
      'src/components/BluetoothEldModal.tsx',
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
