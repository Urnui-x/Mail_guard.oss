import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { hashApiKey, getCachedApiKey, cacheApiKey, getSupabase, type ApiKey, type Project } from '@mailguard/core';

declare module 'fastify' {
  interface FastifyRequest {
    project?: Project;
    apiKey?: ApiKey;
  }
}

/**
 * Authentication middleware for API routes
 * Validates Bearer token and attaches project context to request
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.code(401).send({
      error: 'unauthorized',
      message: 'Missing or invalid Authorization header'
    });
    return;
  }
  
  const token = authHeader.slice(7); // Remove 'Bearer ' prefix
  
  // Hash the token for lookup
  const keyHash = hashApiKey(token);
  
  try {
    // Check cache first
    const cached = await getCachedApiKey(keyHash);
    
    if (cached) {
      request.project = cached.project as Project;
      request.apiKey = cached.apiKey as ApiKey;
      return;
    }
    
    // Query database
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('api_keys')
      .select(`
        *,
        projects (
          *,
          sender_emails (*)
        )
      `)
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single();
    
    if (error || !data) {
      reply.code(401).send({
        error: 'invalid_api_key',
        message: 'Invalid or expired API key'
      });
      return;
    }
    
    // Check if key has expired
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      reply.code(401).send({
        error: 'invalid_api_key',
        message: 'API key has expired'
      });
      return;
    }
    
    const apiKey = data as ApiKey;
    const project = data.projects as Project;
    
    // Cache the result
    await cacheApiKey(keyHash, {
      project,
      apiKey
    });
    
    // Attach to request
    request.project = project;
    request.apiKey = apiKey;
    
    // Update last_used_at asynchronously (don't await)
    supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', apiKey.id)
      .then(() => {})
      .catch(() => {});
      
  } catch (error) {
    request.log.error({ error }, 'Authentication error');
    reply.code(500).send({
      error: 'internal_error',
      message: 'Authentication failed'
    });
  }
}

/**
 * Optional authentication - doesn't fail if no token provided
 */
export async function optionalAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return; // No auth, continue without attaching project
  }
  
  return authMiddleware(request, reply);
}