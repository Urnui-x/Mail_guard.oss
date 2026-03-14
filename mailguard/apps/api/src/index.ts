import Fastify from 'fastify';
import cors from '@fastify/cors';
import { validateApiEnv, createLogger, closeRedis } from '@mailguard/core';
import { routes } from './routes/index.js';

// Create logger
const logger = createLogger({ name: 'api' });

// Validate environment
const env = validateApiEnv();
const PORT = env.PORT || 3000;

// Create Fastify instance
const fastify = Fastify({
  logger: false, // We use pino directly
  requestIdHeader: 'x-request-id',
  requestIdLogLabel: 'reqId'
});

// Register CORS
fastify.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

// Error handler
fastify.setErrorHandler((error, request, reply) => {
  logger.error({ error, requestId: request.id }, 'Request error');
  
  if (error.validation) {
    return reply.code(400).send({
      error: 'validation_error',
      message: error.message
    });
  }
  
  if (error.statusCode) {
    return reply.code(error.statusCode).send({
      error: 'request_error',
      message: error.message
    });
  }
  
  return reply.code(500).send({
    error: 'internal_error',
    message: 'Internal server error'
  });
});

// Register routes
fastify.register(routes);

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down...');
  
  try {
    await fastify.close();
    await closeRedis();
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Shutdown error');
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
async function start() {
  try {
    const address = await fastify.listen({ port: PORT, host: '0.0.0.0' });
    logger.info({ port: PORT, address }, 'API server started');
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

start();