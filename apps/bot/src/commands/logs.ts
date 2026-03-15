{
  const text = ctx.message?.text || '';
  const args = text.split(' ').slice(1);
  
  const showFailed = args.includes('--failed');
  const showToday = args.includes('--today');
  
  await showLogs(ctx, 0, showFailed, showToday);
}

async function showLogs(
  ctx: Context, 
  page: number, 
  failedOnly: boolean,
  todayOnly: boolean
): Promise<void> {
  const supabase = getSupabase();
  
  let query = supabase
    .from('email_logs')
    .select('*, projects (name, slug)', { count: 'exact' })
    .order('created_at', { ascending: false });
  
  if (failedOnly) {
    query = query.eq('status', 'failed');
  }
  
  if (todayOnly) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    query = query.gte('created_at', today.toISOString());
  }
  
  const { data: logs, count, error } = await query
    .range(page * LOGS_PER_PAGE, (page + 1) * LOGS_PER_PAGE - 1);
  
  if (error || !logs || logs.length === 0) {
    await ctx.reply('📜 No logs found.');
    return;
  }
  
  const statusEmoji: Record<string, string> = {
    queued: '⏳',
    sent: '✅',
    delivered: '📬',
    bounced: '↩️',
    failed: '❌'
  };
  
  let message = '📜 <b>Email Logs</b>\n';
  if (failedOnly) message += '(Failed only)\n';
  if (todayOnly) message += '(Today)\n';
  message += '\n';
  
  for (const log of logs) {
    const project = log.projects as { name: string } | null;
    const time = new Date(log.created_at).toLocaleString();
    const emoji = statusEmoji[log.status] || '❓';
    
    message += 
      `${emoji} <b>${maskEmail(log.recipient_email)}</b>\n` +
      `   📁 ${project?.name || 'Unknown'}\n` +
      `   📧 ${log.subject?.substring(0, 30) || 'No subject'}...\n` +
      `   🕐 ${time}\n`;
    
    if (log.error_message) {
      message += `   ❌ ${log.error_message.substring(0, 50)}\n`;
    }
    
    message += '\n';
  }
  
  // Pagination
  const totalPages = Math.ceil((count || 0) / LOGS_PER_PAGE);
  
  if (totalPages > 1) {
    message += `\n📄 Page ${page + 1} of ${totalPages}`;
  }
  
  // Create keyboard for pagination
  const keyboard = new InlineKeyboard();
  
  if (page > 0) {
    keyboard.text('⬅️ Previous', `logs_${page - 1}_${failedOnly ? 1 : 0}_${todayOnly ? 1 : 0}`);
  }
  
  if (page < totalPages - 1) {
    keyboard.text('➡️ Next', `logs_${page + 1}_${failedOnly ? 1 : 0}_${todayOnly ? 1 : 0}`);
  }
  
  await ctx.reply(message, { 
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}