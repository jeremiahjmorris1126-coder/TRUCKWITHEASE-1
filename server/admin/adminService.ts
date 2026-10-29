import { checkFirestoreHealth } from '../firestore';
import { telematicsManager } from '../telematics/telematicsManager';
import { getTelephonyStatus } from '../telephony/telephonyService';
import { listUsers } from '../auth/rolesService';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  subsystem: string;
  message: string;
  actor: string;
}

const auditLogs: AuditLogEntry[] = [
  {
    id: 'log-01',
    timestamp: new Date().toISOString(),
    level: 'INFO',
    subsystem: 'BOOTSTRAP',
    message: 'TruckWithEase Cockpit Backend initialized with unified adapter matrix',
    actor: 'SYSTEM',
  },
];

export function logAuditEvent(level: AuditLogEntry['level'], subsystem: string, message: string, actor = 'SYSTEM'): void {
  auditLogs.unshift({
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    level,
    subsystem,
    message,
    actor,
  });
  if (auditLogs.length > 500) auditLogs.pop();
}

export function getAuditLogs(limitCount = 100): AuditLogEntry[] {
  return auditLogs.slice(0, limitCount);
}

export async function getIntegrationSummary(): Promise<Record<string, any>> {
  const firestoreHealth = await checkFirestoreHealth();
  const telematicsHealth = telematicsManager.getAdapterStatus();
  const telephonyHealth = getTelephonyStatus();

  return {
    timestamp: new Date().toISOString(),
    firestore: firestoreHealth,
    telematics: telematicsHealth,
    telephony: telephonyHealth,
    geminiAi: {
      configured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
      status: process.env.GEMINI_API_KEY ? 'GROUNDING_ACTIVE' : 'FALLBACK_SIMULATION',
    },
    twilioSms: {
      configured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
    },
    usersCount: (await listUsers({ role: 'owner', fleetId: null, uid: 'system-admin' })).length,
  };
}
