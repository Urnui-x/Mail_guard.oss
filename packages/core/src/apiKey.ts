import { randomBytes, createHash } from 'crypto';

const LIVE_PREFIX = 'mg_live_';
const TEST_PREFIX = 'mg_test_';

/**
 * Generates a new API key with prefix, hash, and display prefix
 * Returns: { fullKey: shown once to user, hash: stored in DB, prefix: for display }
 */
export function generateApiKey(sandbox = false): { fullKey: string; hash: string; prefix: string } {
  const raw = randomBytes(32).toString('hex');
  const prefix = sandbox ? TEST_PREFIX : LIVE_PREFIX;
  const fullKey = prefix + raw;
  const hash = createHash('sha256').update(fullKey).digest('hex');
  
  return {
    fullKey,
    hash,
    prefix: fullKey.slice(0, 12)
  };
}

/**
 * Hashes an API key for lookup
 * Used when authenticating incoming API requests
 */
export function hashApiKey(fullKey: string): string {
  return createHash('sha256').update(fullKey).digest('hex');
}

/**
 * Validates API key format
 */
export function isValidApiKeyFormat(key: string): boolean {
  if (!key) return false;
  return key.startsWith(LIVE_PREFIX) || key.startsWith(TEST_PREFIX);
}

/**
 * Checks if an API key is a test/sandbox key
 */
export function isTestKey(key: string): boolean {
  return key.startsWith(TEST_PREFIX);
}

/**
 * Extracts the prefix for display purposes
 */
export function getKeyPrefix(key: string): string {
  return key.slice(0, 12);
}

/**
 * Masks an email address for display
 * Example: noreply@gmail.com -> nor***@gmail.com
 */
export function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!domain) return email;
  
  const maskedLocal = localPart.length > 3
    ? localPart.slice(0, 3) + '***'
    : localPart.slice(0, 1) + '***';
  
  return `${maskedLocal}@${domain}`;
}