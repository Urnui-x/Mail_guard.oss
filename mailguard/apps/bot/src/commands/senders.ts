{
  const supabase = getSupabase();
  
  const { data: senders, error } = await supabase
    .from('sender_emails')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error || !senders || senders.length === 0) {
    await ctx.reply('📭 No sender emails found.\n\nUse /addemail to add one.');
    return;
  }
  
  let message = '📧 <b>Sender Emails</b>\n\n';
  
  for (const sender of senders) {
    const statusIcon = sender.is_active 
      ? (sender.is_verified ? '✅' : '⏳') 
      : '❌';
    const lastUsed = sender.last_used_at 
      ? new Date(sender.last_used_at).toLocaleDateString()
      : 'Never';
    
    message += 
      `${statusIcon} <b>${maskEmail(sender.email_address)}</b>\n` +
      `   🏢 ${getProviderDisplayName(sender.provider)}\n` +
      `   📊 Limit: ${sender.daily_limit}/day\n` +
      `   🕐 Last used: ${lastUsed}\n` +
      `   🆔 <code>${sender.id.slice(0, 8)}...</code>\n\n`;
  }
  
  message += 
    '\n<i>Status: ✅ Active, ⏳ Pending, ❌ Inactive</i>';
  
  await ctx.reply(message, { parse_mode: 'HTML' });
}