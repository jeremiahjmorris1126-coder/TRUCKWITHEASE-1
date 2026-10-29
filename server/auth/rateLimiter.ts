import { Request, Response, NextFunction } from 'express';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const userBuckets = new Map<string, RateLimitBucket>();
const ipBuckets = new Map<string, RateLimitBucket>();

// Periodically clean up expired buckets to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of userBuckets.entries()) {
    if (bucket.resetAt <= now) {
      userBuckets.delete(key);
    }
  }
  for (const [key, bucket] of ipBuckets.entries()) {
    if (bucket.resetAt <= now) {
      ipBuckets.delete(key);
    }
  }
}, 60000).unref();

export interface DualRateLimitOptions {
  windowMs?: number;        // Window duration in ms (default: 60,000ms = 1 min)
  maxUserRequests?: number; // Max requests per user/token per window (default: 120)
  maxIpRequests?: number;   // Max requests per IP per window (default: 240)
  maxRequests?: number;     // Legacy alias for maxUserRequests
}

/**
 * Resolves the verified client IP address for rate limiting.
 *
 * Vulnerability Remediation (Gate G-2):
 * Previously, the code directly read `req.headers['cf-connecting-ip']` or split
 * `req.headers['x-forwarded-for']` and took `[0]`. This allowed any client to spoof
 * arbitrary IP addresses by injecting headers, resetting their rate-limit bucket
 * on every request and completely bypassing rate limits.
 *
 * Resolution:
 * 1. Rely strictly on Express's sanitized `req.ip` (populated via trusted proxy hops).
 * 2. Fall back to `req.socket?.remoteAddress` or '127.0.0.1'.
 * 3. Normalize IPv6-mapped IPv4 addresses (::ffff:x.x.x.x -> x.x.x.x).
 * 4. Never trust raw unverified client-supplied headers (CF-Connecting-IP or leftmost X-Forwarded-For).
 */
export function resolveClientIp(req: Request): string {
  let ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
  if (typeof ip === 'string' && ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  return typeof ip === 'string' ? ip.trim() : '127.0.0.1';
}

/**
 * Creates an Express middleware for per-user and per-IP rate limiting.
 */
export function createDualRateLimiter(options: DualRateLimitOptions = {}) {
  const windowMs = options.windowMs || 60000;
  const maxUserRequests = options.maxUserRequests || options.maxRequests || 120;
  const maxIpRequests = options.maxIpRequests || (options.maxRequests ? options.maxRequests * 2 : 240);

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();

    // 1. Per-IP Limiter (Using sanitized client IP derived from trusted proxy hop)
    const ip = resolveClientIp(req);
    let ipBucket = ipBuckets.get(ip);
    if (!ipBucket || ipBucket.resetAt <= now) {
      ipBucket = { count: 1, resetAt: now + windowMs };
      ipBuckets.set(ip, ipBucket);
    } else {
      ipBucket.count++;
    }

    if (ipBucket.count > maxIpRequests) {
      const resetSeconds = Math.ceil((ipBucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', resetSeconds);
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `IP rate limit of ${maxIpRequests} requests per minute exceeded.`,
        retryAfterSeconds: resetSeconds,
      });
    }

    // 2. Per-User Limiter:
    // Limit by verified user UID (if authenticated) or API key.
    // Fall back strictly to sanitized client IP so attackers rotating unverified
    // Bearer tokens cannot evade rate limits on unauthenticated endpoints.
    const userIdentifier =
      (req as any).user?.uid ||
      (req.headers['x-api-key'] as string) ||
      ip;

    let userBucket = userBuckets.get(userIdentifier);
    if (!userBucket || userBucket.resetAt <= now) {
      userBucket = { count: 1, resetAt: now + windowMs };
      userBuckets.set(userIdentifier, userBucket);
    } else {
      userBucket.count++;
    }

    const remaining = Math.max(0, maxUserRequests - userBucket.count);
    const resetSeconds = Math.ceil((userBucket.resetAt - now) / 1000);

    res.setHeader('X-RateLimit-Limit', maxUserRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetSeconds);

    if (userBucket.count > maxUserRequests) {
      res.setHeader('Retry-After', resetSeconds);
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `User rate limit of ${maxUserRequests} requests per minute exceeded.`,
        retryAfterSeconds: resetSeconds,
      });
    }

    next();
  };
}

/**
 * Backward compatibility alias
 */
export const createPerKeyRateLimiter = createDualRateLimiter;

/**
 * Reset all rate limit buckets (for testing)
 */
export function resetRateLimitsForTesting(): void {
  userBuckets.clear();
  ipBuckets.clear();
}
