import Redis from 'ioredis';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
}

/**
 * Redis-based sliding window rate limiter
 * Uses atomic operations for accurate limiting
 */
export async function checkRateLimit(
  redis: Redis,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - (windowSeconds * 1000);
  
  const results = await redis
    .pipeline()
    .zremrangebyscore(key, '-inf', windowStart)
    .zcard(key)
    .zadd(key, now, `${now}-${Math.random().toString(36).slice(2)}`)
    .expire(key, windowSeconds)
    .exec();
  
  if (!results) {
    return { allowed: true, remaining: limit - 1, resetIn: windowSeconds };
  }
  
  const count = results[1]?.[1] as number ?? 0;
  const currentCount = count + 1;
  
  if (currentCount > limit) {
    // Remove the entry we just added since limit exceeded
    await redis.zremrangebyrank(key, -1, -1);
    
    // Calculate reset time
    const oldestMember = await redis.zrange(key, 0, 0, 'WITHSCORES');
    const oldestScore = oldestMember[1] ? parseInt(oldestMember[1], 10) : now;
    const resetIn = Math.ceil((oldestScore + (windowSeconds * 1000) - now) / 1000);
    
    return {
      allowed: false,
      remaining: 0,
      resetIn: Math.max(1, resetIn)
    };
  }
  
  return {
    allowed: true,
    remaining: Math.max(0, limit - currentCount),
    resetIn: windowSeconds
  };
}

/**
 * Fixed window rate limiter (simpler, but allows burst at window boundaries)
 */
export async function checkRateLimitFixed(
  redis: Redis,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const current = await redis.incr(key);
  
  if (current === 1) {
    await redis.expire(key, windowSeconds);
  }
  
  const ttl = await redis.ttl(key);
  
  if (current > limit) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: ttl > 0 ? ttl : windowSeconds
    };
  }
  
  return {
    allowed: true,
    remaining: limit - current,
    resetIn: ttl > 0 ? ttl : windowSeconds
  };
}

/**
 * Resets rate limit for a key
 */
export async function resetRateLimit(redis: Redis, key: string): Promise<void> {
  await redis.del(key);
}

/**
 * Gets current rate limit status without incrementing
 */
export async function getRateLimitStatus(
  redis: Redis,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ count: number; remaining: number; resetIn: number }> {
  const now = Date.now();
  const windowStart = now - (windowSeconds * 1000);
  
  // Clean old entries and get count
  await redis.zremrangebyscore(key, '-inf', windowStart);
  const count = await redis.zcard(key);
  
  const ttl = await redis.ttl(key);
  
  return {
    count,
    remaining: Math.max(0, limit - count),
    resetIn: ttl > 0 ? ttl : windowSeconds
  };
}

/**
 * Rate limit key generators
 */
export const RateLimitKeys = {
  otpPerEmail: (projectId: string, emailHash: string) =>
    `rl:otp:email:${projectId}:${emailHash}`,
  
  otpPerIp: (ip: string) =>
    `rl:otp:ip:${ip}`,
  
  apiPerKey: (keyHash: string) =>
    `rl:api:${keyHash}`,
  
  emailPerProject: (projectId: string) =>
    `rl:email:project:${projectId}`,
  
  senderDailyLimit: (senderId: string) =>
    `rl:sender:daily:${senderId}:${getDateString()}`,
};

function getDateString(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}