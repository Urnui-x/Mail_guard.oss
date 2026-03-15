{
  const supabase = getSupabase();
  
  const { data: projects, error } = await supabase
    .from('projects')
    .select(`
      *,
      sender_emails (email_address, provider),
      api_keys (id)
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  
  if (error || !projects || projects.length === 0) {
    await ctx.reply('📁 No projects found.\n\nUse /newproject to create one.');
    return;
  }
  
  let message = '📁 <b>Projects</b>\n\n';
  
  for (const project of projects) {
    const sender = project.sender_emails as { email_address: string; provider: string } | null;
    const keysCount = project.api_keys?.length || 0;
    
    message += 
      `📁 <b>${project.name}</b>\n` +
      `   🔗 <code>${project.slug}</code>\n` +
      `   📧 ${sender ? maskEmail(sender.email_address) : 'No sender'}\n` +
      `   🔢 OTP: ${project.otp_length} digits, ${Math.floor(project.otp_expiry_seconds / 60)}min\n` +
      `   🔑 ${keysCount} active key${keysCount !== 1 ? 's' : ''}\n` +
      `   🆔 <code>${project.id.slice(0, 8)}...</code>\n\n`;
  }
  
  await ctx.reply(message, { parse_mode: 'HTML' });
}