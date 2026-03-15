import Redis from 'ioredis';

let redisInstance: Redis | null = null;

/**
 * Gets the Redis client singleton
 * Uses ioredis for Redis operations
 */
export function getRedis(): Redis {
  if (!redisInstance) {
    const url = process.env.REDIS_URL;
    
    if (!url) {
      throw new Error('REDIS_URL must be set');
    }
    
    redisInstance = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      lazyConnect: false
    });
    
    redisInstance.on('error', (err) => {
      console.error('Redis connection error:', err);
    });
    
    redisInstance.on('connect', () => {
      console.log('Redis connected');
    });
  }
  
  return redisInstance;
}

/**
 * Closes the Redis connection gracefully
 */
export async function closeRedis(): Promise<void> {
  if (redisInstance) {
    await redisInstance.quit();
    redisInstance = null;
  }
}

/**
 * Health check for Redis connection
 */
export async function checkRedisHealth(): Promise<{ status: string; latency_ms: number }> {
  const start = Date.now();
  
  try {
    const redis = getRedis();
    await redis.ping();
    const latency = Date.now() - start;
    
    return {
      status: 'healthy',
      latency_ms: latency
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latency_ms: Date.now() - start
    };
  }
}

// Cache helpers for API key lookups
const API_KEY_CACHE_TTL = 60; // 60 seconds

/**
 * Caches an API key lookup result
 */
export async function cacheApiKey(keyHash: string, data: Record<string, unknown>): Promise<void> {
  const redis = getRedis();
  await redis.setex(
    `apikey:${keyHash}`,
    API_KEY_CACHE_TTL,
    JSON.stringify(data)
  );
}

/**
 * Gets cached API key data
 */
export async function getCachedApiKey(keyHash: string): Promise<Record<string, unknown> | null> {
  const redis = getRedis();
  const cached = await redis.get(`apikey:${keyHash}`);
  
  if (!cached) return null;
  
  try {
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

/**
 * Invalidates cached API key data
 */
export async function invalidateCachedApiKey(keyHash: string): Promise<void> {
  const redis = getRedis();
  await redis.del(`apikey:${keyHash}`);
}