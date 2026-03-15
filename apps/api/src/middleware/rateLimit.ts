import { FastifyRequest, FastifyReply } from 'fastify';
import { 
  checkRateLimit, 
  getRedis, 
  RateLimitKeys, 
  hashApiKey,
  createHash 
} from '@mailguard/core';

/**
 * Rate limiting middleware for API endpoints
 * Different limits for different resources
 */
export async function apiRateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return; // Let auth middleware handle this
  }
  
  const token = authHeader.slice(7);
  const keyHash = hashApiKey(token);
  const redis = getRedis();
  
  // Check API rate limit: 60 requests per minute per key
  const result = await checkRateLimit(
    redis,
    RateLimitKeys.apiPerKey(keyHash),
    60,
    60
  );
  
  // Set rate limit headers
  reply.header('X-RateLimit-Limit', 60);
  reply.header('X-RateLimit-Remaining', result.remaining);
  reply.header('X-RateLimit-Reset', result.resetIn);
  
  if (!result.allowed) {
    reply.code(429).send({
      error: 'rate_limit_exceeded',
      message: 'Too many requests',
      retry_after: result.resetIn
    });
    return;
  }
}

/**
 * Rate limiting for OTP send endpoint
 * Multiple rate limits applied
 */
export async function otpSendRateLimitMiddleware(
  request: FastifyRequest<{ Body: { email: string } }>,
  reply: FastifyReply
): Promise<void> {
  const { email } = request.body || {};
  const project = request.project;
  const ip = request.ip;
  
  if (!email || !project) {
    return; // Let validation handle this
  }
  
  const redis = getRedis();
  
  // Email hash for privacy in Redis keys
  const emailHash = createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 32);
  
  // Check rate limits in parallel
  const [emailLimit, ipLimit, projectLimit] = await Promise.all([
    // 10 OTPs per email per hour
    checkRateLimit(
      redis,
      RateLimitKeys.otpPerEmail(project.id, emailHash),
      10,
      3600
    ),
    // 5 OTPs per IP per minute
    checkRateLimit(
      redis,
      RateLimitKeys.otpPerIp(ip),
      5,
      60
    ),
    // 200 emails per project per hour
    checkRateLimit(
      redis,
      RateLimitKeys.emailPerProject(project.id),
      200,
      3600
    )
  ]);
  
  // Check if any limit is exceeded
  if (!emailLimit.allowed) {
    reply.code(429).send({
      error: 'rate_limit_exceeded',
      message: 'Too many OTP requests for this email address',
      retry_after: emailLimit.resetIn
    });
    return;
  }
  
  if (!ipLimit.allowed) {
    reply.code(429).send({
      error: 'rate_limit_exceeded',
      message: 'Too many requests from your IP address',
      retry_after: ipLimit.resetIn
    });
    return;
  }
  
  if (!projectLimit.allowed) {
    reply.code(429).send({
      error: 'rate_limit_exceeded',
      message: 'Project email quota exceeded',
      retry_after: projectLimit.resetIn
    });
    return;
  }
  
  // Set rate limit headers
  reply.header('X-RateLimit-Email-Remaining', emailLimit.remaining);
  reply.header('X-RateLimit-IP-Remaining', ipLimit.remaining);
  reply.header('X-RateLimit-Project-Remaining', projectLimit.remaining);
}