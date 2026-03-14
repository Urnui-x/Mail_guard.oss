import { FastifyInstance } from 'fastify';
import { getSupabase, checkRedisHealth, getRedis } from '@mailguard/core';
import { Queue } from 'bullmq';

/**
 * Health check route
 * Returns status of all dependencies
 */
export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/health', async (request, reply) => {
    const startTime = Date.now();
    
    // Check database
    let dbStatus = 'healthy';
    let dbLatency = 0;
    try {
      const dbStart = Date.now();
      const supabase = getSupabase();
      const { error } = await supabase.from('projects').select('id').limit(1);
      dbLatency = Date.now() - dbStart;
      if (error) {
        dbStatus = 'unhealthy';
      }
    } catch {
      dbStatus = 'unhealthy';
    }
    
    // Check Redis
    const redisResult = await checkRedisHealth();
    
    // Check queue depth
    let queueStatus = 'healthy';
    let queueDepth = 0;
    try {
      const redisUrl = process.env.REDIS_URL!;
      const url = new URL(redisUrl);
      const queue = new Queue('email-jobs', {
        connection: {
          host: url.hostname,
          port: parseInt(url.port || '6379'),
          password: url.password || undefined
        }
      });
      queueDepth = await queue.count();
      await queue.close();
    } catch {
      queueStatus = 'unhealthy';
    }
    
    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (dbStatus === 'unhealthy' || redisResult.status === 'unhealthy') {
      overallStatus = 'unhealthy';
    } else if (queueStatus === 'unhealthy' || queueDepth > 100) {
      overallStatus = 'degraded';
    }
    
    // Get active senders
    let senders: Array<{ id: string; email: string; provider: string; status: string }> = [];
    try {
      const supabase = getSupabase();
      const { data } = await supabase
        .from('sender_emails')
        .select('id, email_address, provider, is_active, is_verified')
        .eq('is_active', true);
      
      if (data) {
        senders = data.map(s => ({
          id: s.id,
          email: s.email_address,
          provider: s.provider,
          status: s.is_verified ? 'active' : 'unverified'
        }));
      }
    } catch {
      // Ignore errors for senders list
    }
    
    return reply.send({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: dbStatus,
          latency_ms: dbLatency
        },
        redis: {
          status: redisResult.status,
          latency_ms: redisResult.latency_ms
        },
        queue: {
          status: queueStatus,
          depth: queueDepth
        }
      },
      senders
    });
  });
}