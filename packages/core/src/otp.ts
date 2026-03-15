import { randomInt } from 'crypto';
import bcrypt from 'bcrypt';

/**
 * Generates a numeric OTP of specified length
 * Uses crypto.randomInt for cryptographically secure randomness
 * NEVER use Math.random() for OTP generation
 */
export function generateOtp(length: number): string {
  const max = 10 ** length;
  const otp = randomInt(0, max);
  return otp.toString().padStart(length, '0');
}

/**
 * Hashes an OTP using bcrypt before storing
 * NEVER log or store plaintext OTP
 */
export async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, 10);
}

/**
 * Verifies an OTP against its bcrypt hash
 * Uses constant-time comparison to prevent timing attacks
 */
export async function verifyOtp(submitted: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(submitted, hash);
  } catch {
    return false;
  }
}

/**
 * Validates OTP format (numeric only)
 */
export function isValidOtpFormat(otp: string, length: number): boolean {
  if (!otp || otp.length !== length) {
    return false;
  }
  return /^\d+$/.test(otp);
}