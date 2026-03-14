import { FastifyInstance } from 'fastify';
import { otpRoutes } from './otp.js';
import { healthRoutes } from './health.js';

/**
 * Register all API routes
 */
export async function routes(fastify: FastifyInstance): Promise<void> {
  // Health check - no auth required
  await fastify.register(healthRoutes);
  
  // API v1 routes
  await fastify.register(async (fastify) => {
    await fastify.register(otpRoutes, { prefix: '/api/v1/otp' });
  });
}