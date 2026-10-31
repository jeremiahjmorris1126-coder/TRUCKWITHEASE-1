/**
 * TruckWithEase // Structured Logging Engine
 *
 * Provides structured, JSON-ready diagnostic logging across frontend and backend.
 * Guarantees zero leakage of sensitive credentials (FMCSA PIN, CDL, API keys)
 * while maintaining clear audit trails for DOT/FMCSA compliance and Master Mechanic diagnostics.
 */

import { AppError, sanitizeMetadata, generateCorrelationId } from './errors.ts';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  subsystem: string;
  message: string;
  code?: string;
  correlationId: string;
  metadata?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    code?: string;
    category?: string;
    severity?: string;
    stack?: string;
  };
}

export type LogListener = (entry: StructuredLogEntry) => void;

const LOG_LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class StructuredLogger {
  private minLevel: LogLevel = 'debug';
  private ringBuffer: StructuredLogEntry[] = [];
  private readonly maxBufferSize = 250;
  private listeners: Set<LogListener> = new Set();
  private defaultContext: Record<string, unknown> = {};

  constructor() {
    // Default level: info in production, debug in development
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
      this.minLevel = 'info';
    }
  }

  public setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  public setDefaultContext(context: Record<string, unknown>): void {
    this.defaultContext = sanitizeMetadata(context);
  }

  /**
   * High-Frequency Debug (10Hz telemetry sampling, CAN-Bus polling, cache hits)
   */
  public debug(subsystem: string, message: string, metadata?: Record<string, unknown>): void {
    this.log('debug', subsystem, message, undefined, metadata);
  }

  /**
   * Operational Milestones (Driver sign-in, dispatch executed, PDF log generated)
   */
  public info(subsystem: string, message: string, metadata?: Record<string, unknown>): void {
    this.log('info', subsystem, message, undefined, metadata);
  }

  /**
   * Recoverable Hazards & Fallbacks (Bridge clearance < 6", offline cache served)
   */
  public warn(
    subsystem: string,
    message: string,
    metadata?: Record<string, unknown>,
    error?: unknown
  ): void {
    this.log('warn', subsystem, message, error, metadata);
  }

  /**
   * Critical Failures (CAN-Bus disconnect, 0" clearance alert, disk write loss)
   */
  public error(
    subsystem: string,
    message: string,
    error?: unknown,
    metadata?: Record<string, unknown>
  ): void {
    this.log('error', subsystem, message, error, metadata);
  }

  /**
   * Core structured logging dispatcher
   */
  private log(
    level: LogLevel,
    subsystem: string,
    message: string,
    error?: unknown,
    metadata?: Record<string, unknown>
  ): void {
    if (LOG_LEVEL_SEVERITY[level] < LOG_LEVEL_SEVERITY[this.minLevel]) {
      return;
    }

    const correlationId =
      (metadata?.correlationId as string) ||
      (this.defaultContext.correlationId as string) ||
      (error instanceof AppError ? error.correlationId : generateCorrelationId());

    const combinedMetadata = sanitizeMetadata({
      ...this.defaultContext,
      ...(metadata || {}),
      ...(error instanceof AppError ? error.details : {}),
    });
    delete combinedMetadata.correlationId;

    let errorObj: StructuredLogEntry['error'] | undefined;
    let code = error instanceof AppError ? error.code : (metadata?.code as string | undefined);

    if (error instanceof AppError) {
      errorObj = {
        name: error.name,
        message: error.userMessage,
        code: error.code,
        category: error.category,
        severity: error.severity,
        stack: error.stack,
      };
    } else if (error instanceof Error) {
      errorObj = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    } else if (error) {
      errorObj = {
        name: 'NonErrorObject',
        message: String(error),
      };
    }

    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      subsystem,
      message,
      code,
      correlationId,
      metadata: Object.keys(combinedMetadata).length > 0 ? combinedMetadata : undefined,
      error: errorObj,
    };

    // Store in-memory ring buffer for HUD export & diagnostic screens
    this.ringBuffer.push(entry);
    if (this.ringBuffer.length > this.maxBufferSize) {
      this.ringBuffer.shift();
    }

    // Emit to live subscribers (e.g. HUD Cockpit event listeners)
    this.listeners.forEach((listener) => {
      try {
        listener(entry);
      } catch (e) {
        // Suppress listener failure to avoid recursive logging crashes
      }
    });

    // Console output formatted with structured tags
    this.writeConsole(entry);
  }

  private writeConsole(entry: StructuredLogEntry): void {
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.subsystem}] [${entry.correlationId}]`;
    const formatted = `${prefix} ${entry.message}${entry.code ? ` (${entry.code})` : ''}`;

    const dataToPrint = entry.metadata || entry.error ? { metadata: entry.metadata, error: entry.error } : undefined;

    switch (entry.level) {
      case 'debug':
        if (dataToPrint) console.debug(formatted, dataToPrint);
        else console.debug(formatted);
        break;
      case 'info':
        if (dataToPrint) console.info(formatted, dataToPrint);
        else console.info(formatted);
        break;
      case 'warn':
        if (dataToPrint) console.warn(formatted, dataToPrint);
        else console.warn(formatted);
        break;
      case 'error':
        if (dataToPrint) console.error(formatted, dataToPrint);
        else console.error(formatted);
        break;
    }
  }

  /**
   * Retrieve in-memory log buffer for DOT compliance exports or cockpit diagnostics
   */
  public getRecentLogs(limit = 100): StructuredLogEntry[] {
    return this.ringBuffer.slice(-limit);
  }

  public clearBuffer(): void {
    this.ringBuffer = [];
  }

  /**
   * Subscribe to live log events (for HUD notifications or Master Mechanic radar)
   */
  public subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Returns a scoped child logger with preset correlation context
   */
  public child(subsystem: string, context?: Record<string, unknown>) {
    return {
      debug: (msg: string, meta?: Record<string, unknown>) =>
        this.debug(subsystem, msg, { ...context, ...meta }),
      info: (msg: string, meta?: Record<string, unknown>) =>
        this.info(subsystem, msg, { ...context, ...meta }),
      warn: (msg: string, meta?: Record<string, unknown>, err?: unknown) =>
        this.warn(subsystem, msg, { ...context, ...meta }, err),
      error: (msg: string, err?: unknown, meta?: Record<string, unknown>) =>
        this.error(subsystem, msg, err, { ...context, ...meta }),
    };
  }
}

export const logger = new StructuredLogger();
