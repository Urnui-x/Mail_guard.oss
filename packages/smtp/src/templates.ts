/**
 * Default OTP email templates
 * Projects can customize these via Telegram bot
 */

export interface EmailTemplateData {
  otp_code: string;
  app_name: string;
  expiry_minutes: number;
  recipient_email: string;
}

/**
 * Default subject template for OTP emails
 */
export const DEFAULT_OTP_SUBJECT = 'Your verification code for {{app_name}}';

/**
 * Default body template for OTP emails (plain text)
 */
export const DEFAULT_OTP_BODY_TEXT = `Hello,

Your verification code is: {{otp_code}}

This code will expire in {{expiry_minutes}} minutes.

If you did not request this code, please ignore this email.

Best regards,
{{app_name}}`;

/**
 * Default body template for OTP emails (HTML)
 */
export const DEFAULT_OTP_BODY_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f9fafb; border-radius: 8px; padding: 30px; margin: 20px 0;">
    <h2 style="color: #111; margin-top: 0;">Verification Code</h2>
    <p style="font-size: 16px; color: #4b5563;">Hello,</p>
    <p style="font-size: 16px; color: #4b5563;">Your verification code is:</p>
    <div style="background: #fff; border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
      <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #111;">{{otp_code}}</span>
    </div>
    <p style="font-size: 14px; color: #6b7280;">This code will expire in <strong>{{expiry_minutes}} minutes</strong>.</p>
    <p style="font-size: 14px; color: #9ca3af; margin-top: 30px;">If you did not request this code, please ignore this email.</p>
  </div>
  <p style="font-size: 14px; color: #9ca3af; text-align: center;">Best regards,<br>{{app_name}}</p>
</body>
</html>`;

/**
 * Renders a template by replacing placeholders with data
 * Placeholders are in format: {{placeholder_name}}
 */
export function renderTemplate(template: string, data: EmailTemplateData): string {
  let rendered = template;
  
  rendered = rendered.replace(/\{\{otp_code\}\}/g, data.otp_code);
  rendered = rendered.replace(/\{\{app_name\}\}/g, data.app_name);
  rendered = rendered.replace(/\{\{expiry_minutes\}\}/g, data.expiry_minutes.toString());
  rendered = rendered.replace(/\{\{recipient_email\}\}/g, data.recipient_email);
  
  return rendered;
}

/**
 * Validates a template for required placeholders
 */
export function validateTemplate(template: string, requiredPlaceholders: string[] = ['otp_code']): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  for (const placeholder of requiredPlaceholders) {
    if (!template.includes(`{{${placeholder}}}`)) {
      missing.push(placeholder);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Creates a preview of the template with fake values
 */
export function createPreview(template: string, format: 'text' | 'html' = 'text'): string {
  const fakeData: EmailTemplateData = {
    otp_code: '123456',
    app_name: 'YourApp',
    expiry_minutes: 10,
    recipient_email: 'user@example.com'
  };
  
  return renderTemplate(template, fakeData);
}

/**
 * Gets the appropriate default body template
 */
export function getDefaultOtpBody(format: 'text' | 'html'): string {
  return format === 'html' ? DEFAULT_OTP_BODY_HTML : DEFAULT_OTP_BODY_TEXT;
}