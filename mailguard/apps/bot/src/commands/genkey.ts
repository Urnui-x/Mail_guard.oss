{
  const text = ctx.message?.text || '';
  const args = text.split(' ').slice(1);
  
  // Parse arguments
  let slug = '';
  let label = '';
  let isTest = false;
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--test') {
      isTest = true;
    } else if (!slug) {
      slug = arg;
    } else {
      label = args.slice(i).join(' ');
      break;
    }
  }
  
  if (!slug) {
    await ctx.reply(
      '❌ Please provide a project slug.\n\n' +
      'Usage: <code>/genkey project-slug [label] [--test]</code>',
      { parse_mode: 'HTML' }
    );
    return;
  }
  
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
  
  // Generate API key
  const { fullKey, hash, prefix } = generateApiKey(isTest);
  
  // Save to database
  const { error: insertError } = await supabase
    .from('api_keys')
    .insert({
      project_id: project.id,
      key_hash: hash,
      key_prefix: prefix,
      label: label || null,
      is_sandbox: isTest,
      is_active: true
    });
  
  if (insertError) {
    await ctx.reply('❌ Failed to generate API key. Please try again.');
    return;
  }
  
  // Show the key (ONLY ONCE)
  const message = 
    `🔑 <b>API Key Generated!</b>\n\n` +
    `📁 <b>Project:</b> ${project.name}\n` +
    `🏷️ <b>Label:</b> ${label || 'None'}\n` +
    `🧪 <b>Type:</b> ${isTest ? 'Test' : 'Live'}\n` +
    `📛 <b>Prefix:</b> <code>${prefix}</code>\n\n` +
    `<b>⚠️ COPY THIS KEY NOW - IT WILL NOT BE SHOWN AGAIN!</b>\n\n` +
    `<code>${fullKey}</code>\n\n` +
    `<i>Delete this message after copying!</i>`;
  
  const sent = await ctx.reply(message, { parse_mode: 'HTML' });
  
  // Add delete button
  const deleteKeyboard = new InlineKeyboard()
    .text('🗑️ Delete Message', `delete_${sent.message_id}`);
  
  await ctx.api.editMessageReplyMarkup(
    ctx.chat!.id,
    sent.message_id,
    { reply_markup: deleteKeyboard }
  );
}