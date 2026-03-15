import { Bot, session, Context, SessionFlavor } from 'grammy';
import { conversations, createConversation } from '@grammyjs/conversations';
import { RedisAdapter } from '@grammyjs/storage-redis';
import Redis from 'ioredis';
import { 
  validateBotEnv, 
  createLogger, 
  closeRedis, 
  getSupabase,
  type BotSessionData 
} from '@mailguard/core';
import { 
  startCommand, 
  setOtpCommand, 
  genKeyCommand, 
  sendersCommand, 
  projectsCommand, 
  logsCommand 
} from './commands/index.js';
import { addEmailWizard, newProjectWizard } from './wizards/index.js';
import { sendDailySummary, sendSmtpFailureNotification } from './notify/index.js';

// Create logger
const logger = createLogger({ name: 'bot' });

// Validate environment
const env = validateBotEnv();

// Session data type
interface SessionData {
  editingProjectSlug?: string;
  otpSubject?: string;
  otpBody?: string;
  otpFormat?: 'text' | 'html';
  step?: string;
}

type MyContext = Context & SessionFlavor<SessionData>;

// Initial session value
function initialSessionValue(): SessionData {
  return {};
}

// Create bot
const bot = new Bot<MyContext>(env.TELEGRAM_BOT_TOKEN);

// Setup Redis for session storage
const redis = new Redis(env.REDIS_URL);

// Setup session middleware
bot.use(session({
  initial: initialSessionValue,
  storage: new RedisAdapter({ instance: redis }),
}));

// Setup conversations
bot.use(conversations());

// Register conversations
bot.use(createConversation(addEmailWizard, 'addEmail'));
bot.use(createConversation(newProjectWizard, 'newProject'));

// Admin middleware - only allow configured admin
bot.use(async (ctx, next) => {
  const adminUid = parseInt(env.TELEGRAM_ADMIN_UID);
  
  if (ctx.from?.id !== adminUid) {
    // Silent ignore - non-admin gets no response
    logger.warn({ userId: ctx.from?.id }, 'Non-admin access attempt');
    return;
  }
  
  return next();
});

// Register commands
bot.command('start', startCommand);
bot.command('addemail', async (ctx) => {
  await ctx.conversation.enter('addEmail');
});
bot.command('newproject', async (ctx) => {
  await ctx.conversation.enter('newProject');
});
bot.command('setotp', setOtpCommand);
bot.command('genkey', genKeyCommand);
bot.command('senders', sendersCommand);
bot.command('projects', projectsCommand);
bot.command('logs', logsCommand);

// Handle callback queries
bot.callbackQuery(/addemail/, async (ctx) => {
  await ctx.conversation.enter('addEmail');
});

bot.callbackQuery(/newproject/, async (ctx) => {
  await ctx.conversation.enter('newProject');
});

bot.callbackQuery(/senders/, async (ctx) => {
  await sendersCommand(ctx);
});

bot.callbackQuery(/projects/, async (ctx) => {
  await projectsCommand(ctx);
});

bot.callbackQuery(/genkey/, async (ctx) => {
  await ctx.reply('Use /genkey <slug> [label] [--test] to generate a key.');
});

bot.callbackQuery(/logs/, async (ctx) => {
  await logsCommand(ctx);
});

bot.callbackQuery(/delete_\d+/, async (ctx) => {
  const messageId = parseInt(ctx.callbackQuery.data.split('_')[1]);
  try {
    await ctx.deleteMessage();
  } catch {
    // Message might already be deleted
  }
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/logs_\d+_\d+_\d+/, async (ctx) => {
  const [_, pageStr, failedStr, todayStr] = ctx.callbackQuery.data.split('_');
  const page = parseInt(pageStr);
  const failedOnly = failedStr === '1';
  const todayOnly = todayStr === '1';
  
  // Show logs with pagination
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/format_(text|html)/, async (ctx) => {
  const format = ctx.callbackQuery.data.split('_')[1] as 'text' | 'html';
  // This would be handled in the conversation
  await ctx.answerCallbackQuery(`Selected: ${format}`);
});

bot.callbackQuery(/otp_(save|edit|cancel)/, async (ctx) => {
  const action = ctx.callbackQuery.data.split('_')[1];
  // This would be handled in the conversation
  await ctx.answerCallbackQuery(`Action: ${action}`);
});

// Error handler
bot.catch((err) => {
  logger.error({ error: err }, 'Bot error');
});

// Schedule daily summary (runs at 08:00 UTC)
async function scheduleDailySummary(): Promise<void> {
  const now = new Date();
  const target = new Date(now);
  target.setUTCHours(8, 0, 0, 0);
  
  if (target <= now) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  
  const delay = target.getTime() - now.getTime();
  
  setTimeout(async () => {
    await sendDailySummaryReport();
    scheduleDailySummary(); // Schedule next
  }, delay);
  
  logger.info({ nextRun: target.toISOString() }, 'Daily summary scheduled');
}

async function sendDailySummaryReport(): Promise<void> {
  try {
    const supabase = getSupabase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data: sentLogs } = await supabase
      .from('email_logs')
      .select('id', { count: 'exact' })
      .gte('created_at', today.toISOString())
      .eq('status', 'sent');
    
    const { data: failedLogs } = await supabase
      .from('email_logs')
      .select('id', { count: 'exact' })
      .gte('created_at', today.toISOString())
      .eq('status', 'failed');
    
    // Create a context for sending message
    const adminUid = parseInt(env.TELEGRAM_ADMIN_UID);
    
    await sendDailySummary(bot.api as unknown as MyContext, {
      sentCount: sentLogs?.length || 0,
      failedCount: failedLogs?.length || 0,
      queueDepth: 0, // Would need queue access
      date: today.toISOString().split('T')[0]
    });
    
  } catch (error) {
    logger.error({ error }, 'Failed to send daily summary');
  }
}

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down bot...');
  
  try {
    await bot.stop();
    await redis.quit();
    await closeRedis();
    logger.info('Bot shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Bot shutdown error');
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start bot
async function start() {
  try {
    await bot.start({
      onStart: () => {
        logger.info('Bot started');
      }
    });
    
    scheduleDailySummary();
  } catch (error) {
    logger.error({ error }, 'Failed to start bot');
    process.exit(1);
  }
}

start();