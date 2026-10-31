import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AppError,
  DomainValidationError,
  ClearanceViolationError,
  HosComplianceError,
  KingpinJackknifeError,
  StoragePersistenceError,
  sanitizeMetadata,
  generateCorrelationId,
  toAppError,
} from '../src/utils/errors.ts';

import { logger } from '../src/utils/logger.ts';
import { safeStorage } from '../src/utils/safeStorage.ts';

test('AppError structure and taxonomy categorization', () => {
  const err = new AppError({
    code: 'E_CLEARANCE_CRITICAL_OVERPASS',
    category: 'DOMAIN',
    severity: 'CRITICAL',
    userMessage: 'CRITICAL LOW BRIDGE: 13\' 6" structure ahead on I-20.',
    details: {
      corridor: 'I-20 Westbound',
      bufferDeltaInches: 0,
      fmcsaPin: '1234', // Must be scrubbed
    },
  });

  assert.equal(err.code, 'E_CLEARANCE_CRITICAL_OVERPASS');
  assert.equal(err.category, 'DOMAIN');
  assert.equal(err.severity, 'CRITICAL');
  assert.match(err.correlationId, /^req-/);
  assert.equal(err.details.corridor, 'I-20 Westbound');
  assert.equal(err.details.bufferDeltaInches, 0);
  assert.equal(err.details.fmcsaPin, '[REDACTED]', 'PIN must be redacted');
});

test('ClearanceViolationError critical vs advisory thresholds', () => {
  const crit = new ClearanceViolationError(0, 'I-20 Eastbound', '13\' 6"');
  assert.equal(crit.code, 'E_CLEARANCE_CRITICAL_OVERPASS');
  assert.equal(crit.severity, 'CRITICAL');
  assert.match(crit.userMessage, /EXECUTE BYPASS DIVERTER/);

  const adv = new ClearanceViolationError(4, 'I-44 Westbound', '13\' 10"');
  assert.equal(adv.code, 'E_CLEARANCE_ADVISORY');
  assert.equal(adv.severity, 'WARNING');
  assert.match(adv.userMessage, /ADVISORY/);
});

test('Sensitive data redaction: PINs, Passwords, Tokens, and CDL masking', () => {
  const rawMetadata = {
    driverId: 'drv-jeremiah-904',
    fmcsaPin: '8821',
    password: 'superSecretPassword',
    bearerToken: 'tok_abc123xyz789',
    apiKey: 'AIzaSyA8fakeKey',
    cdlNumber: 'IL-CDL-98104820',
    phone: '(555) 234-5678',
    vehicleUnit: 'TRK-904',
    grossWeightLbs: 76200,
    nested: {
      secretToken: 'shhh-1234',
      mileMarker: 184.2,
    },
  };

  const sanitized = sanitizeMetadata(rawMetadata);

  assert.equal(sanitized.fmcsaPin, '[REDACTED]');
  assert.equal(sanitized.password, '[REDACTED]');
  assert.equal(sanitized.bearerToken, '[REDACTED]');
  assert.equal(sanitized.apiKey, '[REDACTED]');
  assert.equal(sanitized.nested.secretToken, '[REDACTED]');

  // CDL masked: digits in the middle masked, prefix and suffix retained
  assert.equal(sanitized.cdlNumber, 'IL****20');
  // Phone masked: trailing 4 digits retained
  assert.equal(sanitized.phone, '***-***-5678');

  // Operational telemetry left intact
  assert.equal(sanitized.driverId, 'drv-jeremiah-904');
  assert.equal(sanitized.vehicleUnit, 'TRK-904');
  assert.equal(sanitized.grossWeightLbs, 76200);
  assert.equal(sanitized.nested.mileMarker, 184.2);
});

test('Structured logger ring buffer and subscriber delivery', () => {
  logger.clearBuffer();

  const captured = [];
  const unsubscribe = logger.subscribe((entry) => {
    captured.push(entry);
  });

  logger.info('TEST_SUBSYSTEM', 'Driver initialized pre-trip inspection', {
    unit: 'TRK-904',
    fmcsaPin: '9988', // Must be scrubbed
  });

  logger.warn('RADAR_54B', 'Approaching tight clearance structure', {
    corridor: 'I-35 Northbound',
    bufferInches: 4,
  });

  assert.equal(captured.length, 2);
  assert.equal(captured[0].level, 'info');
  assert.equal(captured[0].subsystem, 'TEST_SUBSYSTEM');
  assert.equal(captured[0].metadata?.unit, 'TRK-904');
  assert.equal(captured[0].metadata?.fmcsaPin, '[REDACTED]');

  assert.equal(captured[1].level, 'warn');
  assert.equal(captured[1].subsystem, 'RADAR_54B');

  const recent = logger.getRecentLogs(10);
  assert.ok(recent.length >= 2);

  unsubscribe();
});

test('SafeStorage handles in-memory fallback without throwing', () => {
  const result = safeStorage.setItem('test_driver_pref', { theme: 'night-obsidian', hudBypass: true });
  assert.equal(result.success, true);
  assert.equal(result.data.theme, 'night-obsidian');

  const readBack = safeStorage.getItem('test_driver_pref', { theme: 'default' });
  assert.equal(readBack.success, true);
  assert.equal(readBack.data.theme, 'night-obsidian');
});

test('End-to-End: Error Raised -> Logged -> Surfaced to User', () => {
  // Scenario: Driver enters incorrect FMCSA Roadside PIN during sign-in
  const credentialAttempt = {
    identifier: 'IL-CDL-98104820',
    enteredPin: '0000', // incorrect PIN
    actualPin: '8821',
  };

  logger.clearBuffer();
  let caughtError = null;
  let userSurfaceNotification = null;

  // 1. Error Raised in Domain/Service Layer
  try {
    if (credentialAttempt.enteredPin !== credentialAttempt.actualPin) {
      throw new DomainValidationError(
        'Authentication rejected: Invalid FMCSA Roadside PIN credentials.',
        {
          identifier: credentialAttempt.identifier,
          pin: credentialAttempt.enteredPin, // To verify logger redacts it
        },
        'E_AUTH_PIN_MISMATCH'
      );
    }
  } catch (err) {
    caughtError = err;

    // 2. Error Logged in Structured Telemetry Sink
    logger.warn(
      'AUTH_SERVICE',
      `Driver sign-in credential rejection: ${caughtError.userMessage}`,
      caughtError.details,
      caughtError
    );

    // 3. Error Surfaced to UI Layer (Cockpit Toast / Modal)
    userSurfaceNotification = {
      message: caughtError.userMessage,
      variant: 'error',
      icon: 'lock_reset',
    };
  }

  // Assert Step 1: Raised Error
  assert.ok(caughtError !== null);
  assert.equal(caughtError.code, 'E_AUTH_PIN_MISMATCH');
  assert.equal(caughtError.category, 'DOMAIN');

  // Assert Step 2: Structured Log Entry
  const logs = logger.getRecentLogs(5);
  const authLog = logs.find((l) => l.subsystem === 'AUTH_SERVICE');
  assert.ok(authLog, 'Structured log entry must exist for AUTH_SERVICE');
  assert.equal(authLog.level, 'warn');
  assert.equal(authLog.code, 'E_AUTH_PIN_MISMATCH');
  assert.equal(authLog.metadata?.pin, '[REDACTED]', 'PIN must never leak into log');
  assert.equal(authLog.metadata?.identifier, 'IL****20', 'CDL in identifier must be masked');

  // Assert Step 3: User Surface Notification
  assert.ok(userSurfaceNotification !== null);
  assert.equal(userSurfaceNotification.variant, 'error');
  assert.equal(userSurfaceNotification.message, 'Authentication rejected: Invalid FMCSA Roadside PIN credentials.');
});
