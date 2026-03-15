import { Context, Conversation, ConversationFlavor } from 'grammy';
import { getSupabase, encrypt, maskEmail } from '@mailguard/core';
import { detectProvider, testSmtpConnection, getProviderDisplayName } from '@mailguard/smtp';

type MyContext = Context & ConversationFlavor;
type MyConversation = Conversation<MyContext>;

/**
 * Add email wizard - guides through adding a sender email
 */
export async function addEmailWizard(
  conversation: MyConversation,
  ctx: MyContext
): Promise<void> {
  // Step 1: Ask for email
  await ctx.reply('📧 Enter your email address:');
  
  const emailCtx = await conversation.waitFor('message:text');
  const email = emailCtx.message.text.trim().toLowerCase();
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    await ctx.reply('❌ Invalid email format. Please try again with /addemail.');
    return;
  }
  
  // Detect provider
  const provider = detectProvider(email);
  if (!provider) {
    await ctx.reply(
      '⚠️ Unknown email provider.\n\n' +
      'MailGuard supports Gmail, Outlook, Yahoo, Zoho, iCloud, ProtonMail, and Fastmail.\n\n' +
      'For custom SMTP, please contact support.',
      { parse_mode: 'HTML' }
    );
    return;
  }
  
  await ctx.reply(
    `✅ <b>${getProviderDisplayName(provider.provider)}</b> detected!\n\n` +
    `Daily limit: ${provider.dailyLimit} emails`,
    { parse_mode: 'HTML' }
  );
  
  // Step 2: Ask for app password
  await ctx.reply(
    '🔐 Enter your App Password:\n\n' +
    '<i>For Gmail: Go to Account → Security → 2FA → App passwords\n' +
    'For Outlook: Go to Account → Security → Advanced security → App passwords</i>',
    { parse_mode: 'HTML' }
  );
  
  const passwordCtx = await conversation.waitFor('message:text');
  const appPassword = passwordCtx.message.text.trim().replace(/\s+/g, '');
  
  // Validate app password format
  if (appPassword.length < 16) {
    await ctx.reply('❌ App password seems too short. Please check and try again.');
    return;
  }
  
  // Show checking message
  const checkingMsg = await ctx.reply('🔄 Testing SMTP connection...');
  
  // Encrypt password and test connection
  const encryptedPassword = encrypt(appPassword);
  
  const testResult = await testSmtpConnection(
    email,
    encryptedPassword,
    provider.smtpHost,
    provider.smtpPort
  );
  
  // Delete checking message
  await checkingMsg.delete();
  
  if (!testResult.success) {
    await ctx.reply(
      `❌ SMTP test failed!\n\n` +
      `<b>Error:</b> ${testResult.error}\n\n` +
      'Please check your app password and try again with /addemail.',
      { parse_mode: 'HTML' }
    );
    return;
  }
  
  // Ask for display name (optional)
  await ctx.reply(
    '📝 Enter a display name for this sender (optional):\n' +
    '<i>This will appear as the sender name in emails</i>\n\n' +
    'Send "-" to skip.',
    { parse_mode: 'HTML' }
  );
  
  const nameCtx = await conversation.waitFor('message:text');
  const displayName = nameCtx.message.text.trim();
  
  // Save to database
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('sender_emails')
    .insert({
      email_address: email,
      display_name: displayName === '-' ? null : displayName,
      provider: provider.provider,
      smtp_host: provider.smtpHost,
      smtp_port: provider.smtpPort,
      app_password_enc: encryptedPassword,
      daily_limit: provider.dailyLimit,
      is_verified: true,
      is_active: true
    })
    .select()
    .single();
  
  if (error) {
    if (error.code === '23505') {
      await ctx.reply('❌ This email is already registered.');
      return;
    }
    await ctx.reply('❌ Failed to save email. Please try again.');
    return;
  }
  
  // Success message
  await ctx.reply(
    `✅ <b>Email added successfully!</b>\n\n` +
    `📧 <b>Email:</b> ${maskEmail(email)}\n` +
    `👤 <b>Display Name:</b> ${displayName === '-' ? 'Not set' : displayName}\n` +
    `🏢 <b>Provider:</b> ${getProviderDisplayName(provider.provider)}\n` +
    `📊 <b>Daily Limit:</b> ${provider.dailyLimit}\n\n` +
    `🆔 <b>Sender ID:</b> <code>${data.id}</code>`,
    { parse_mode: 'HTML' }
  );
}