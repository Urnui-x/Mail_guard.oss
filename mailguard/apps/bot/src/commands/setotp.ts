import { Context, InlineKeyboard } from 'grammy';
import { getSupabase } from '@mailguard/core';
import { createPreview, DEFAULT_OTP_SUBJECT, getDefaultOtpBody } from '@mailguard/smtp';

/**
 * /setotp command - Configure OTP email templates
 */
export async function setOtpCommand(ctx: Context): Promise<void> {
  const text = ctx.message?.text || '';
  const args = text.split(' ').slice(1);
  
  if (args.length === 0) {
    await ctx.reply(
      '❌ Please provide a project slug.\n\n' +
      'Usage: <code>/setotp project-slug</code>',
      { parse_mode: 'HTML' }
    );
    return;
  }
  
  const slug = args[0];
  const supabase = getSupabase();
  
  // Get project
  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('slug', slug)
    .single();
  
  if (error || !project) {
    await ctx.reply(
      `❌ Project not found: <code>${slug}</code>`,
      { parse_mode: 'HTML' }
    );
    return;
  }
  
  // Store project in session for wizard
  ctx.session = { ...ctx.session, editingProjectSlug: slug };
  
  // Ask for subject
  await ctx.reply(
    `📁 <b>Configuring OTP for: ${project.name}</b>\n\n` +
    `📧 Enter email subject:\n` +
    `<i>Use {{otp_code}}, {{app_name}}, {{expiry_minutes}}, {{recipient_email}}</i>\n\n` +
    `Current: <code>${project.otp_subject_tmpl || DEFAULT_OTP_SUBJECT}</code>`,
    { parse_mode: 'HTML' }
  );
}

/**
 * Handle OTP template configuration conversation
 */
export async function handleSetOtpConversation(
  ctx: Context, 
  step: string, 
  data: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabase();
  const slug = data.editingProjectSlug as string;
  
  if (step === 'subject') {
    const subject = ctx.message?.text || '';
    
    if (subject.length > 500) {
      await ctx.reply('❌ Subject too long (max 500 characters).');
      return;
    }
    
    // Store subject and ask for body
    ctx.session = { 
      ...ctx.session, 
      otpSubject: subject,
      step: 'body'
    };
    
    await ctx.reply(
      '📝 Enter email body:\n' +
      '<i>Use {{otp_code}}, {{app_name}}, {{expiry_minutes}}, {{recipient_email}}</i>\n\n' +
      'Send "-" to use default template.',
      { parse_mode: 'HTML' }
    );
    return;
  }
  
  if (step === 'body') {
    const body = ctx.message?.text || '';
    
    if (body === '-') {
      ctx.session = { ...ctx.session, otpBody: null };
    } else {
      ctx.session = { ...ctx.session, otpBody: body };
    }
    
    // Ask for format
    const formatKeyboard = new InlineKeyboard()
      .text('Plain Text', 'format_text')
      .text('HTML', 'format_html');
    
    await ctx.reply(
      '📄 Select email format:',
      { reply_markup: formatKeyboard }
    );
    return;
  }
  
  if (step === 'format') {
    const format = (data.format as string) === 'format_html' ? 'html' : 'text';
    
    // Get current session data
    const session = ctx.session || {};
    const subject = session.otpSubject as string || DEFAULT_OTP_SUBJECT;
    const body = session.otpBody as string || getDefaultOtpBody(format);
    
    // Show preview
    const preview = createPreview(body, format);
    
    const confirmKeyboard = new InlineKeyboard()
      .text('✅ Save', 'otp_save')
      .text('✏️ Edit', 'otp_edit')
      .text('❌ Cancel', 'otp_cancel');
    
    await ctx.reply(
      `📋 <b>Preview:</b>\n\n` +
      `<b>Subject:</b> ${createPreview(subject, 'text')}\n\n` +
      `<b>Body:</b>\n${preview.substring(0, 500)}${preview.length > 500 ? '...' : ''}`,
      { 
        parse_mode: 'HTML',
        reply_markup: confirmKeyboard
      }
    );
    
    ctx.session = { 
      ...ctx.session, 
      otpFormat: format,
      step: 'confirm'
    };
    return;
  }
  
  if (step === 'confirm') {
    const action = data.action as string;
    
    if (action === 'otp_save') {
      const session = ctx.session || {};
      const subject = session.otpSubject as string;
      const body = session.otpBody as string;
      const format = session.otpFormat as 'text' | 'html';
      
      const { error } = await supabase
        .from('projects')
        .update({
          otp_subject_tmpl: subject,
          otp_body_tmpl: body,
          otp_format: format
        })
        .eq('slug', slug);
      
      if (error) {
        await ctx.reply('❌ Failed to save OTP template.');
        return;
      }
      
      await ctx.reply('✅ OTP template saved successfully!');
    } else if (action === 'otp_cancel') {
      await ctx.reply('❌ OTP configuration cancelled.');
    }
    
    ctx.session = {};
    return;
  }
}