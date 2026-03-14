import { Context, Conversation, ConversationFlavor, InlineKeyboard } from 'grammy';
import { getSupabase } from '@mailguard/core';
import { getProviderDisplayName, maskEmail } from '@mailguard/smtp';

type MyContext = Context & ConversationFlavor;
type MyConversation = Conversation<MyContext>;

/**
 * New project wizard - guides through creating a project
 */
export async function newProjectWizard(
  conversation: MyConversation,
  ctx: MyContext
): Promise<void> {
  const supabase = getSupabase();
  
  // Step 1: Project name
  await ctx.reply('📁 Enter project name:');
  const nameCtx = await conversation.waitFor('message:text');
  const name = nameCtx.message.text.trim();
  
  if (name.length > 100) {
    await ctx.reply('❌ Project name too long (max 100 characters).');
    return;
  }
  
  // Step 2: Project slug
  await ctx.reply(
    '🔗 Enter project slug (URL-friendly identifier):\n' +
    '<i>Example: my-app, user_portal, api_v2</i>',
    { parse_mode: 'HTML' }
  );
  
  const slugCtx = await conversation.waitFor('message:text');
  const slug = slugCtx.message.text.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  
  if (slug.length > 100 || slug.length < 2) {
    await ctx.reply('❌ Slug must be 2-100 characters.');
    return;
  }
  
  // Check if slug exists
  const { data: existingProject } = await supabase
    .from('projects')
    .select('id')
    .eq('slug', slug)
    .single();
  
  if (existingProject) {
    await ctx.reply('❌ This slug is already taken. Please choose another.');
    return;
  }
  
  // Step 3: OTP length
  const otpLengthKeyboard = new InlineKeyboard()
    .text('4 digits', 'otp_4')
    .text('6 digits', 'otp_6')
    .text('8 digits', 'otp_8');
  
  await ctx.reply(
    '🔢 Select OTP length:',
    { reply_markup: otpLengthKeyboard }
  );
  
  const otpLengthCtx = await conversation.waitForCallbackQuery(/otp_\d/);
  const otpLength = parseInt(otpLengthCtx.callbackQuery.data.split('_')[1]);
  await otpLengthCtx.answerCallbackQuery();
  
  // Step 4: OTP expiry
  await ctx.reply(
    '⏱️ Enter OTP expiry time in seconds:\n' +
    '<i>Default: 600 (10 minutes)</i>',
    { parse_mode: 'HTML' }
  );
  
  const expiryCtx = await conversation.waitFor('message:text');
  const otpExpiry = parseInt(expiryCtx.message.text.trim()) || 600;
  
  if (otpExpiry < 60 || otpExpiry > 3600) {
    await ctx.reply('❌ OTP expiry must be between 60 and 3600 seconds.');
    return;
  }
  
  // Step 5: Max attempts
  await ctx.reply(
    '🔒 Enter max verification attempts:\n' +
    '<i>Default: 5</i>',
    { parse_mode: 'HTML' }
  );
  
  const attemptsCtx = await conversation.waitFor('message:text');
  const maxAttempts = parseInt(attemptsCtx.message.text.trim()) || 5;
  
  if (maxAttempts < 1 || maxAttempts > 10) {
    await ctx.reply('❌ Max attempts must be between 1 and 10.');
    return;
  }
  
  // Step 6: Select sender
  const { data: senders } = await supabase
    .from('sender_emails')
    .select('*')
    .eq('is_active', true)
    .eq('is_verified', true);
  
  if (!senders || senders.length === 0) {
    await ctx.reply('❌ No verified sender emails found. Add one first with /addemail.');
    return;
  }
  
  // Create inline keyboard for senders
  const senderKeyboard = new InlineKeyboard();
  senders.forEach((sender, index) => {
    senderKeyboard.text(
      `${getProviderDisplayName(sender.provider)}: ${maskEmail(sender.email_address)}`,
      `sender_${sender.id}`
    );
    if (index % 2 === 1) senderKeyboard.row();
  });
  
  await ctx.reply(
    '📧 Select sender email for this project:',
    { reply_markup: senderKeyboard }
  );
  
  const senderCtx = await conversation.waitForCallbackQuery(/sender_.+/);
  const senderId = senderCtx.callbackQuery.data.replace('sender_', '');
  await senderCtx.answerCallbackQuery();
  
  // Create project
  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      name,
      slug,
      sender_email_id: senderId,
      otp_length: otpLength,
      otp_expiry_seconds: otpExpiry,
      otp_max_attempts: maxAttempts,
      is_active: true
    })
    .select()
    .single();
  
  if (error) {
    await ctx.reply('❌ Failed to create project. Please try again.');
    return;
  }
  
  // Success message
  await ctx.reply(
    `✅ <b>Project created successfully!</b>\n\n` +
    `📁 <b>Name:</b> ${name}\n` +
    `🔗 <b>Slug:</b> <code>${slug}</code>\n` +
    `🔢 <b>OTP Length:</b> ${otpLength}\n` +
    `⏱️ <b>OTP Expiry:</b> ${otpExpiry}s\n` +
    `🔒 <b>Max Attempts:</b> ${maxAttempts}\n\n` +
    `🆔 <b>Project ID:</b> <code>${project.id}</code>\n\n` +
    `<i>Use /setotp ${slug} to customize OTP templates</i>\n` +
    `<i>Use /genkey ${slug} to create API keys</i>`,
    { parse_mode: 'HTML' }
  );
}