import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Determine if we should use actual Redis or mock it
const hasUpstash = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

// Create Redis instance only if env vars are present
const redis = hasUpstash ? new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
}) : {} as any;

// Fallback mock ratelimiter that always succeeds if env vars are not set
const createMockRatelimiter = () => {
    return {
        limit: async () => {
            return { success: true, limit: 100, remaining: 99, reset: 0 };
        },
    };
};

export const getRateLimiter = (options: { limit: number, window: `${number} s` | `${number} m` | `${number} h` | `${number} d` }) => {
    if (!hasUpstash) {
        console.warn('[RateLimit] Upstash Redis credentials not found, using mock rate limiter.');
        return createMockRatelimiter() as unknown as Ratelimit;
    }
    
    return new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(options.limit, options.window),
        analytics: true,
        prefix: 'gatecode_ratelimit',
    });
};

// Pre-configured rate limiters
export const examStartLimiter = getRateLimiter({ limit: 5, window: '10 s' }); // 5 requests per 10 seconds
export const examSubmitLimiter = getRateLimiter({ limit: 10, window: '1 m' }); // 10 submissions per minute
export const adminLimiter = getRateLimiter({ limit: 20, window: '1 m' }); // 20 admin actions per minute
export const authLimiter = getRateLimiter({ limit: 5, window: '1 m' }); // 5 auth actions (e.g. delete) per minute
