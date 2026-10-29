import { NextFunction, Request, Response } from 'express';
import { getDb } from '../firestore';

interface DailyQuotaRecord {
  fleetId: string;
  dateStr: string;
  count: number;
}

const inMemoryDailyQuotas = new Map<string, DailyQuotaRecord>();
const inMemoryRoutingRateLimits = new Map<string, { count: number; resetAt: number }>();

const DEFAULT_DAILY_FLEET_QUOTA = 500; // 500 calls/day per fleet
const ROUTING_PER_USER_LIMIT = 30;     // 30 calls/minute per user
const ROUTING_WINDOW_MS = 60000;       // 1 minute

export function getTodayDateStr(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Express middleware that enforces:
 * 1. Tighter per-user sliding window rate limit (30 requests/minute) for commercial routing.
 * 2. Strict daily quota per fleet (500 requests/day) to prevent cost overruns.
 */
export function routingQuotaMiddleware(
  options: { maxUserRpm?: number; dailyFleetQuota?: number } = {}
) {
  const maxUserRpm = options.maxUserRpm || ROUTING_PER_USER_LIMIT;
  const dailyFleetQuota = options.dailyFleetQuota || DEFAULT_DAILY_FLEET_QUOTA;

  return async (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const today = getTodayDateStr();

    // 1. Resolve User ID and Fleet ID
    const user = (req as any).user;
    const fleet = (req as any).fleet;
    const tenant = (req as any).tenant;

    const userId = user?.uid || (req.headers['authorization'] ? 'user_auth' : 'anonymous_routing');
    const fleetId = user?.fleetId || fleet?.fleetId || tenant?.tenantId || 'FLEET_DEFAULT';

    // 2. Enforce Tighter Per-User Rate Limit (30 RPM)
    let userBucket = inMemoryRoutingRateLimits.get(userId);
    if (!userBucket || userBucket.resetAt <= now) {
      userBucket = { count: 1, resetAt: now + ROUTING_WINDOW_MS };
      inMemoryRoutingRateLimits.set(userId, userBucket);
    } else {
      userBucket.count++;
    }

    if (userBucket.count > maxUserRpm) {
      const retryAfterSec = Math.ceil((userBucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec.toString());
      return res.status(429).json({
        error: 'TooManyRequests',
        message: `Routing rate limit exceeded (${maxUserRpm} req/min). Commercial routing calls are rate-limited. Retry in ${retryAfterSec}s.`,
        retryAfterSeconds: retryAfterSec,
      });
    }

    // 3. Enforce Daily Per-Fleet Quota
    const quotaKey = `${fleetId}_${today}`;
    let quotaRecord = inMemoryDailyQuotas.get(quotaKey);
    if (!quotaRecord) {
      quotaRecord = { fleetId, dateStr: today, count: 1 };
      inMemoryDailyQuotas.set(quotaKey, quotaRecord);
    } else {
      quotaRecord.count++;
    }

    if (quotaRecord.count > dailyFleetQuota) {
      return res.status(429).json({
        error: 'QuotaExceeded',
        message: `Daily commercial routing quota exceeded for fleet [${fleetId}]. Limit: ${dailyFleetQuota} requests/day. Contact fleet admin or support to increase tier.`,
        currentCount: quotaRecord.count,
        dailyLimit: dailyFleetQuota,
      });
    }

    // Attach quota info to response headers
    res.setHeader('X-Routing-Quota-Remaining', Math.max(0, dailyFleetQuota - quotaRecord.count).toString());
    res.setHeader('X-Routing-Quota-Limit', dailyFleetQuota.toString());

    return next();
  };
}

export function resetQuotasForTesting(): void {
  inMemoryDailyQuotas.clear();
  inMemoryRoutingRateLimits.clear();
}
