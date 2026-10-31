/**
 * TruckWithEase // Core Error Types & Domain Taxonomy
 *
 * Implements a 3-tier error handling hierarchy:
 * 1. DOMAIN: Safety rules, compliance (49 CFR § 395/396, FHWA 54B), driver verification.
 * 2. INFRASTRUCTURE: Network, CAN-Bus, Web Bluetooth, LocalStorage persistence, external APIs.
 * 3. PRESENTATION: React rendering, HUD overlays, route switches, driver form validations.
 */

export type ErrorCategory = 'DOMAIN' | 'INFRASTRUCTURE' | 'PRESENTATION';

export type ErrorSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

/**
 * Standard Error Code Taxonomy
 */
export type AppErrorCode =
  // Authentication & Fleet Drivers
  | 'E_AUTH_INVALID_CREDENTIALS'
  | 'E_AUTH_PIN_MISMATCH'
  | 'E_AUTH_CDL_REQUIRED'
  | 'E_AUTH_CDL_EXPIRED'
  | 'E_AUTH_UNAUTHORIZED'
  | 'E_AUTH_DRIVER_NOT_FOUND'
  | 'E_AUTH_VALIDATION_FAILED'
  // Navigation & FHWA Item 54B Low-Bridge Clearance
  | 'E_CLEARANCE_CRITICAL_OVERPASS'
  | 'E_CLEARANCE_ADVISORY'
  | 'E_CLEARANCE_DATA_UNAVAILABLE'
  | 'E_ROUTE_STEEP_GRADE'
  | 'E_ROUTE_HAZMAT_RESTRICTION'
  // J1939 CAN-Bus & Telematics / Master Mechanic
  | 'E_CANBUS_TIMEOUT'
  | 'E_CANBUS_DISCONNECTED'
  | 'E_CANBUS_FRAME_CORRUPT'
  | 'E_CANBUS_BAUD_MISMATCH'
  | 'E_JACKKNIFE_THRESHOLD_EXCEEDED'
  | 'E_DTC_FAULT_ACTIVE'
  // FMCSA HOS Compliance (49 CFR § 395)
  | 'E_HOS_DRIVE_LIMIT_EXCEEDED'
  | 'E_HOS_DUTY_LIMIT_EXCEEDED'
  | 'E_HOS_REST_BREAK_REQUIRED'
  | 'E_HOS_LOG_INTEGRITY_COMPROMISED'
  // Storage & Persistence
  | 'E_STORAGE_QUOTA_EXCEEDED'
  | 'E_STORAGE_READ_FAILED'
  | 'E_STORAGE_WRITE_FAILED'
  | 'E_STORAGE_CORRUPT_RECORD'
  // Network & External Services
  | 'E_NET_OFFLINE'
  | 'E_NET_TIMEOUT'
  | 'E_NET_UPSTREAM_FAILURE'
  | 'E_TWILIO_CONFIG_MISSING'
  | 'E_TWILIO_DELIVERY_FAILED'
  | 'E_WEATHER_API_UNAVAILABLE'
  // System & Presentation
  | 'E_SYS_UNHANDLED_EXCEPTION'
  | 'E_SYS_RENDER_CRASH'
  | 'E_SYS_INITIALIZATION_FAILED';

export interface AppErrorOptions {
  code: AppErrorCode;
  category: ErrorCategory;
  severity?: ErrorSeverity;
  userMessage: string;
  details?: Record<string, unknown>;
  originalError?: unknown;
  correlationId?: string;
}

/**
 * Base Application Error Class
 * Guarantees consistent error metadata across backend and frontend.
 */
export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly userMessage: string;
  public readonly details: Record<string, unknown>;
  public readonly correlationId: string;
  public readonly timestamp: string;
  public readonly originalError?: unknown;

  constructor(options: AppErrorOptions) {
    super(options.userMessage);
    this.name = this.constructor.name;
    this.code = options.code;
    this.category = options.category;
    this.severity = options.severity ?? 'WARNING';
    this.userMessage = options.userMessage;
    this.details = sanitizeMetadata(options.details ?? {});
    this.correlationId = options.correlationId ?? generateCorrelationId();
    this.timestamp = new Date().toISOString();
    this.originalError = options.originalError;

    // Preserve clean stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  public toJSON() {
    return {
      name: this.name,
      code: this.code,
      category: this.category,
      severity: this.severity,
      userMessage: this.userMessage,
      details: this.details,
      correlationId: this.correlationId,
      timestamp: this.timestamp,
    };
  }
}

// ==========================================
// 1. DOMAIN ERRORS
// Safety invariants, regulatory rules, business logic
// ==========================================

export class DomainValidationError extends AppError {
  constructor(userMessage: string, details?: Record<string, unknown>, code: AppErrorCode = 'E_AUTH_VALIDATION_FAILED') {
    super({
      code,
      category: 'DOMAIN',
      severity: 'WARNING',
      userMessage,
      details,
    });
  }
}

export class ClearanceViolationError extends AppError {
  constructor(bufferDeltaInches: number, corridor: string, clearanceDisplay: string) {
    const isCritical = bufferDeltaInches <= 0;
    super({
      code: isCritical ? 'E_CLEARANCE_CRITICAL_OVERPASS' : 'E_CLEARANCE_ADVISORY',
      category: 'DOMAIN',
      severity: isCritical ? 'CRITICAL' : 'WARNING',
      userMessage: isCritical
        ? `CRITICAL CLEARANCE COLLISION RISK: ${clearanceDisplay} structure ahead on ${corridor} (${bufferDeltaInches}" buffer). EXECUTE BYPASS DIVERTER.`
        : `ADVISORY: Tight vertical clearance ${clearanceDisplay} on ${corridor} (${bufferDeltaInches}" buffer). Proceed with caution.`,
      details: {
        bufferDeltaInches,
        corridor,
        clearanceDisplay,
      },
    });
  }
}

export class HosComplianceError extends AppError {
  constructor(ruleName: string, remainingMinutes: number) {
    super({
      code: 'E_HOS_DUTY_LIMIT_EXCEEDED',
      category: 'DOMAIN',
      severity: remainingMinutes <= 0 ? 'CRITICAL' : 'WARNING',
      userMessage: remainingMinutes <= 0
        ? `FMCSA § 395 VIOLATION: Legal duty limit exceeded for ${ruleName}. Safe parking mandatory.`
        : `FMCSA § 395 ADVISORY: Only ${remainingMinutes}m remaining on ${ruleName} clock.`,
      details: { ruleName, remainingMinutes },
    });
  }
}

export class KingpinJackknifeError extends AppError {
  constructor(articulationAngleDeg: number) {
    super({
      code: 'E_JACKKNIFE_THRESHOLD_EXCEEDED',
      category: 'DOMAIN',
      severity: 'CRITICAL',
      userMessage: `JACKKNIFE HAZARD: Kingpin articulation at ${articulationAngleDeg}°. Counter-steer immediately.`,
      details: { articulationAngleDeg, thresholdDeg: 48 },
    });
  }
}

// ==========================================
// 2. INFRASTRUCTURE ERRORS
// Network, I/O, Storage, CAN-Bus, Third-Party
// ==========================================

export class NetworkError extends AppError {
  constructor(userMessage: string, originalError?: unknown, details?: Record<string, unknown>) {
    super({
      code: 'E_NET_UPSTREAM_FAILURE',
      category: 'INFRASTRUCTURE',
      severity: 'WARNING',
      userMessage,
      details,
      originalError,
    });
  }
}

export class StoragePersistenceError extends AppError {
  constructor(key: string, operation: 'READ' | 'WRITE', originalError?: unknown) {
    super({
      code: 'E_STORAGE_WRITE_FAILED',
      category: 'INFRASTRUCTURE',
      severity: 'WARNING',
      userMessage: `Local telemetry storage write failed for "${key}". Offline memory cache active.`,
      details: { key, operation },
      originalError,
    });
  }
}

export class CanBusCommunicationError extends AppError {
  constructor(userMessage: string, details?: Record<string, unknown>) {
    super({
      code: 'E_CANBUS_TIMEOUT',
      category: 'INFRASTRUCTURE',
      severity: 'CRITICAL',
      userMessage,
      details,
    });
  }
}

// ==========================================
// 3. PRESENTATION ERRORS
// React renders, HUD crashes
// ==========================================

export class CockpitRenderError extends AppError {
  constructor(componentName: string, originalError?: unknown) {
    super({
      code: 'E_SYS_RENDER_CRASH',
      category: 'PRESENTATION',
      severity: 'CRITICAL',
      userMessage: `Cockpit interface module "${componentName}" encountered a display fault. Tactical recovery ready.`,
      details: { componentName },
      originalError,
    });
  }
}

// ==========================================
// HELPERS & SENSITIVE DATA REDACTION
// ==========================================

/**
 * Universal error converter: safely maps any thrown value to an AppError
 */
export function toAppError(
  err: unknown,
  fallbackCode: AppErrorCode = 'E_SYS_UNHANDLED_EXCEPTION',
  defaultUserMessage = 'An unexpected cockpit error occurred. Tactical telemetry remains operational.'
): AppError {
  if (err instanceof AppError) {
    return err;
  }

  if (err instanceof Error) {
    return new AppError({
      code: fallbackCode,
      category: 'INFRASTRUCTURE',
      severity: 'WARNING',
      userMessage: defaultUserMessage,
      details: { originalName: err.name, message: err.message },
      originalError: err,
    });
  }

  return new AppError({
    code: fallbackCode,
    category: 'INFRASTRUCTURE',
    severity: 'WARNING',
    userMessage: defaultUserMessage,
    details: { rawValue: String(err) },
    originalError: err,
  });
}

/**
 * Generates an 8-character random correlation trace ID
 */
export function generateCorrelationId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 6);
  return `req-${ts}-${rand}`;
}

/**
 * Deeply redacts sensitive PII and security credentials from objects before logging
 * Protects: FMCSA PINs, CDLs, Passwords, Bearer Tokens, API Secrets, Phone numbers, SSNs
 */
const SENSITIVE_KEY_REGEX = /(pin|fmcsaPin|password|secret|token|authorization|apikey|api_key|creditcard|ssn)/i;

export function sanitizeMetadata(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (
      typeof value === 'string' &&
      (key.toLowerCase().includes('cdl') ||
        (key.toLowerCase().includes('identifier') && /cdl/i.test(value)) ||
        /^[A-Z]{2}-CDL-[A-Z0-9]+$/i.test(value))
    ) {
      // Partial mask of CDL: keep first 2 and last 2 characters
      sanitized[key] = maskCdl(value);
    } else if (key.toLowerCase().includes('phone') && typeof value === 'string') {
      // Partial mask of phone: e.g. +1 (***) ***-1234
      sanitized[key] = maskPhone(value);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function maskCdl(cdl: string): string {
  if (cdl.length <= 4) return '***';
  return `${cdl.slice(0, 2)}****${cdl.slice(-2)}`;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***-***-****';
  return `***-***-${digits.slice(-4)}`;
}
