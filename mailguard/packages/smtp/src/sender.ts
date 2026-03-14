import nodemailer, { Transporter, SendMailOptions } from 'nodemailer';
import { decrypt } from '@mailguard/core';
import { detectProvider, isValidEmailFormat } from './detector.js';

export interface SendEmailOptions {
  from: {
    email: string;
    displayName?: string;
  };
  to: string;
  subject: string;
  body: string;
  format: 'text' | 'html';
  smtp: {
    host: string;
    port: number;
    encryptedPassword: string;
  };
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SmtpTestResult {
  success: boolean;
  error?: string;
  provider?: string;
}

/**
 * Creates a nodemailer transporter for sending emails
 * Password is decrypted and used immediately, then cleared from memory
 */
export async function createTransporter(
  smtpHost: string,
  smtpPort: number,
  userEmail: string,
  encryptedPassword: string
): Promise<Transporter> {
  // Decrypt password - use immediately and clear
  const password = decrypt(encryptedPassword);
  
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: false, // STARTTLS
    auth: {
      user: userEmail,
      pass: password
    },
    tls: {
      ciphers: 'SSLv3',
      rejectUnauthorized: true
    }
  });
  
  // Verify connection
  await transporter.verify();
  
  return transporter;
}

/**
 * Tests SMTP connection with provided credentials
 * Used during email setup in Telegram bot
 */
export async function testSmtpConnection(
  email: string,
  encryptedPassword: string,
  smtpHost?: string,
  smtpPort?: number
): Promise<SmtpTestResult> {
  try {
    if (!isValidEmailFormat(email)) {
      return {
        success: false,
        error: 'Invalid email format'
      };
    }
    
    // Auto-detect provider if not specified
    const provider = detectProvider(email);
    
    if (!provider && (!smtpHost || !smtpPort)) {
      return {
        success: false,
        error: 'Unknown email provider. Please specify SMTP settings manually.'
      };
    }
    
    const host = smtpHost ?? provider!.smtpHost;
    const port = smtpPort ?? provider!.smtpPort;
    
    const transporter = await createTransporter(
      host,
      port,
      email,
      encryptedPassword
    );
    
    // Close the transporter after test
    transporter.close();
    
    return {
      success: true,
      provider: provider?.provider
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Provide user-friendly error messages
    if (errorMessage.includes('Invalid login')) {
      return {
        success: false,
        error: 'Invalid credentials. Please check your email and app password.'
      };
    }
    
    if (errorMessage.includes('ECONNREFUSED')) {
      return {
        success: false,
        error: 'Could not connect to SMTP server. Please try again later.'
      };
    }
    
    if (errorMessage.includes('ETIMEDOUT')) {
      return {
        success: false,
        error: 'Connection timed out. Please check your network.'
      };
    }
    
    return {
      success: false,
      error: `SMTP test failed: ${errorMessage}`
    };
  }
}

/**
 * Sends an email using the provided configuration
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  let transporter: Transporter | null = null;
  
  try {
    transporter = await createTransporter(
      options.smtp.host,
      options.smtp.port,
      options.from.email,
      options.smtp.encryptedPassword
    );
    
    const mailOptions: SendMailOptions = {
      from: options.from.displayName
        ? `"${options.from.displayName}" <${options.from.email}>`
        : options.from.email,
      to: options.to,
      subject: options.subject,
      [options.format === 'html' ? 'html' : 'text']: options.body
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      success: false,
      error: errorMessage
    };
  } finally {
    if (transporter) {
      transporter.close();
    }
  }
}

/**
 * Sends a test email to verify the setup
 */
export async function sendTestEmail(
  email: string,
  displayName: string | null,
  encryptedPassword: string,
  testRecipient: string
): Promise<SendEmailResult> {
  const provider = detectProvider(email);
  
  if (!provider) {
    return {
      success: false,
      error: 'Unknown email provider'
    };
  }
  
  return sendEmail({
    from: {
      email,
      displayName: displayName ?? undefined
    },
    to: testRecipient,
    subject: 'MailGuard SMTP Test - Success!',
    body: 'Congratulations! Your SMTP configuration is working correctly.\n\nThis is a test email from MailGuard OSS.',
    format: 'text',
    smtp: {
      host: provider.smtpHost,
      port: provider.smtpPort,
      encryptedPassword
    }
  });
}