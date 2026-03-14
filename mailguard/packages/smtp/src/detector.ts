export interface ProviderConfig {
  provider: string;
  smtpHost: string;
  smtpPort: number;
  dailyLimit: number;
}

/**
 * Known email provider configurations
 * SMTP settings are auto-resolved based on email domain
 * Developer never needs to enter host/port manually
 */
const PROVIDERS: Record<string, ProviderConfig> = {
  'gmail.com': {
    provider: 'gmail',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    dailyLimit: 500
  },
  'googlemail.com': {
    provider: 'gmail',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    dailyLimit: 500
  },
  'outlook.com': {
    provider: 'outlook',
    smtpHost: 'smtp-mail.outlook.com',
    smtpPort: 587,
    dailyLimit: 300
  },
  'hotmail.com': {
    provider: 'outlook',
    smtpHost: 'smtp-mail.outlook.com',
    smtpPort: 587,
    dailyLimit: 300
  },
  'live.com': {
    provider: 'outlook',
    smtpHost: 'smtp-mail.outlook.com',
    smtpPort: 587,
    dailyLimit: 300
  },
  'msn.com': {
    provider: 'outlook',
    smtpHost: 'smtp-mail.outlook.com',
    smtpPort: 587,
    dailyLimit: 300
  },
  'zoho.com': {
    provider: 'zoho',
    smtpHost: 'smtp.zoho.com',
    smtpPort: 587,
    dailyLimit: 200
  },
  'zohomail.com': {
    provider: 'zoho',
    smtpHost: 'smtp.zoho.com',
    smtpPort: 587,
    dailyLimit: 200
  },
  'yahoo.com': {
    provider: 'yahoo',
    smtpHost: 'smtp.mail.yahoo.com',
    smtpPort: 587,
    dailyLimit: 500
  },
  'ymail.com': {
    provider: 'yahoo',
    smtpHost: 'smtp.mail.yahoo.com',
    smtpPort: 587,
    dailyLimit: 500
  },
  'rocketmail.com': {
    provider: 'yahoo',
    smtpHost: 'smtp.mail.yahoo.com',
    smtpPort: 587,
    dailyLimit: 500
  },
  'aol.com': {
    provider: 'aol',
    smtpHost: 'smtp.aol.com',
    smtpPort: 587,
    dailyLimit: 500
  },
  'icloud.com': {
    provider: 'icloud',
    smtpHost: 'smtp.mail.me.com',
    smtpPort: 587,
    dailyLimit: 1000
  },
  'me.com': {
    provider: 'icloud',
    smtpHost: 'smtp.mail.me.com',
    smtpPort: 587,
    dailyLimit: 1000
  },
  'protonmail.com': {
    provider: 'protonmail',
    smtpHost: 'smtp.protonmail.ch',
    smtpPort: 587,
    dailyLimit: 150
  },
  'proton.me': {
    provider: 'protonmail',
    smtpHost: 'smtp.protonmail.ch',
    smtpPort: 587,
    dailyLimit: 150
  },
  'fastmail.com': {
    provider: 'fastmail',
    smtpHost: 'smtp.fastmail.com',
    smtpPort: 587,
    dailyLimit: 2000
  }
};

/**
 * Detects email provider from email address
 * Returns null for unknown domains (can attempt port probe)
 */
export function detectProvider(email: string): ProviderConfig | null {
  if (!email || !email.includes('@')) {
    return null;
  }
  
  const domain = email.split('@')[1]?.toLowerCase();
  
  if (!domain) {
    return null;
  }
  
  return PROVIDERS[domain] ?? null;
}

/**
 * Gets the domain from an email address
 */
export function extractDomain(email: string): string | null {
  if (!email || !email.includes('@')) {
    return null;
  }
  
  return email.split('@')[1]?.toLowerCase() ?? null;
}

/**
 * Checks if a provider is known
 */
export function isKnownProvider(email: string): boolean {
  return detectProvider(email) !== null;
}

/**
 * Gets provider name from email
 */
export function getProviderName(email: string): string | null {
  const config = detectProvider(email);
  return config?.provider ?? null;
}

/**
 * Default configuration for unknown providers
 * Uses standard SMTP submission port
 */
export function getDefaultProviderConfig(domain: string): ProviderConfig {
  return {
    provider: 'other',
    smtpHost: `smtp.${domain}`,
    smtpPort: 587,
    dailyLimit: 100
  };
}

/**
 * Validates an email address format
 */
export function isValidEmailFormat(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Gets display name for provider
 */
export function getProviderDisplayName(provider: string): string {
  const displayNames: Record<string, string> = {
    gmail: 'Gmail',
    outlook: 'Outlook',
    zoho: 'Zoho Mail',
    yahoo: 'Yahoo Mail',
    aol: 'AOL Mail',
    icloud: 'iCloud',
    protonmail: 'ProtonMail',
    fastmail: 'Fastmail',
    other: 'Custom SMTP'
  };
  
  return displayNames[provider] ?? provider;
}