export {
  detectProvider,
  extractDomain,
  isKnownProvider,
  getProviderName,
  getDefaultProviderConfig,
  isValidEmailFormat,
  getProviderDisplayName,
  type ProviderConfig
} from './detector.js';

export {
  createTransporter,
  testSmtpConnection,
  sendEmail,
  sendTestEmail,
  type SendEmailOptions,
  type SendEmailResult,
  type SmtpTestResult
} from './sender.js';

export {
  DEFAULT_OTP_SUBJECT,
  DEFAULT_OTP_BODY_TEXT,
  DEFAULT_OTP_BODY_HTML,
  renderTemplate,
  validateTemplate,
  createPreview,
  getDefaultOtpBody,
  type EmailTemplateData
} from './templates.js';