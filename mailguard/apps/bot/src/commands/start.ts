import { Context, InlineKeyboard } from 'grammy';
import { getSupabase, checkRedisHealth, maskEmail } from '@mailguard/core';

/**
 * /start command - Shows status dashboard
 */
export async function startCommand(ctx: Context): Promise<void> {
  // Check database connection
  let dbStatus = '✅';
  let sendersCount = 0;
  let projectsCount = 0;
  let keysCount = 0;
  
  try {
    const supabase = getSupabase();
    
    const [senders, projects, keys] = await Promise.all([
      supabase.from('sender_emails').select('id', { count: 'exact' }).eq('is_active', true),
      supabase.from('projects').select('id', { count: 'exact' }).eq('is_active', true),
      supabase.from('api_keys').select('id', { count: 'exact' }).eq('is_active', true)
    ]);
    
    sendersCount = senders.count || 0;
    projectsCount = projects.count || 0;
    keysCount = keys.count || 0;
  } catch {
    dbStatus = '❌';
  }
  
  // Check Redis
  let redisStatus = '✅';
  try {
    const result = await checkRedisHealth();
    if (result.status !== 'healthy') {
      redisStatus = '⚠️';
    }
  } catch {
    redisStatus = '❌';
  }
  
  // Build status message
  const message = `🛡️ <b>MailGuard OSS</b>

<b>System Status</b>
${dbStatus} Database
${redisStatus} Redis Cache

<b>Statistics</b>
📧 Senders: ${sendersCount}
📁 Projects: ${projectsCount}
🔑 Active Keys: ${keysCount}

<i>Ready to send OTPs!</i>`;

  // Create inline keyboard
  const keyboard = new InlineKeyboard()
    .text('📧 Add Email', 'addemail')
    .text('📁 New Project', 'newproject')
    .row()
    .text('📋 Senders', 'senders')
    .text('📋 Projects', 'projects')
    .row()
    .text('🔑 Gen Key', 'genkey')
    .text('📜 Logs', 'logs');
  
  await ctx.reply(message, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}