import { createSign, createVerify } from 'crypto';

/**
 * Creates a JWT token for verified OTP
 * Used to provide proof of verification to the calling application
 */
export function signJwt(payload: Record<string, unknown>, expiresInSeconds: number): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };
  
  const now = Math.floor(Date.now() / 1000);
  const finalPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds
  };
  
  const headerB64 = Buffer.from(JSON.stringify(header))
    .toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(finalPayload))
    .toString('base64url');
  
  const signatureInput = `${headerB64}.${payloadB64}`;
  const signature = createSign('sha256')
    .update(signatureInput)
    .sign(Buffer.from(process.env.JWT_SECRET!, 'utf-8'));
  
  const signatureB64 = signature.toString('base64url');
  
  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

/**
 * Verifies and decodes a JWT token
 * Returns null if invalid or expired
 */
export function verifyJwt(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [headerB64, payloadB64, signatureB64] = parts;
    const signatureInput = `${headerB64}.${payloadB64}`;
    
    const isValid = createVerify('sha256')
      .update(signatureInput)
      .verify(
        Buffer.from(process.env.JWT_SECRET!, 'utf-8'),
        Buffer.from(signatureB64, 'base64url')
      );
    
    if (!isValid) return null;
    
    const payload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf-8')
    );
    
    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    
    return payload;
  } catch {
    return null;
  }
}

/**
 * Decodes a JWT without verifying signature
 * Useful for debugging or reading claims
 */
export function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    return JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    );
  } catch {
    return null;
  }
}