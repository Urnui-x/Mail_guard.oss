import { Worker, Queue, QueueScheduler } from 'bullmq';
import { 
  getSupabase, 
  closeRedis, 
  createLogger,
  decrypt,
  validateEnv,
  type SendEmailJobData
} from '@mailguard/core';
import { sendEmail } from '@mailguard/smtp';

// Create logger
const logger = createLogger({ name: 'worker' });

// Validate environment
validateEnv();

// Get Redis connection details
const redisUrl = process.env.REDIS_URL!;
const url = new URL(redisUrl);

const connection = {
  host: url.hostname,
  port: parseInt(url.port || '6379'),
  password: url.password || undefined,
  username: url.username || undefined
};

// Create queue
const emailQueue = new Queue('email-jobs', { connection });

// Create scheduler for repeatable jobs
const scheduler = new QueueScheduler('email-jobs', { connection });

// Create worker
const worker = new Worker<SendEmailJobData>(
  'email-jobs',
  async (job) => {
    const { 
      senderEmailId, 
      recipientEmail, 
      subject, 
      body, 
      format, 
      emailLogId,
      projectId 
    } = job.data;
    
    logger.info({ 
      jobId: job.id, 
      recipientEmail, 
      attempt: job.attemptsMade + 1 
    }, 'Processing email job');
    
    const supabase = getSupabase();
    
    // Fetch sender details
    const { data: sender, error: senderError } = await supabase
      .from('sender_emails')
      .select('*')
      .eq('id', senderEmailId)
      .single();
    
    if (senderError || !sender) {
      logger.error({ error: senderError, senderEmailId }, 'Failed to fetch sender');
      
      // Update email log
      if (emailLogId) {
        await supabase
          .from('email_logs')
          .update({ 
            status: 'failed', 
            error_message: 'Sender not found' 
          })
          .eq('id', emailLogId);
      }
      
      throw new Error('Sender not found');
    }
    
    // Check if sender is still active
    if (!sender.is_active) {
      logger.warn({ senderEmailId }, 'Sender is inactive');
      throw new Error('Sender is inactive');
    }
    
    try {
      // Send email
      const result = await sendEmail({
        from: {
          email: sender.email_address,
          displayName: sender.display_name || undefined
        },
        to: recipientEmail,
        subject,
        body,
        format,
        smtp: {
          host: sender.smtp_host,
          port: sender.smtp_port,
          encryptedPassword: sender.app_password_enc
        }
      });
      
      if (result.success) {
        logger.info({ 
          jobId: job.id, 
          recipientEmail, 
          messageId: result.messageId 
        }, 'Email sent successfully');
        
        // Update email log
        if (emailLogId) {
          await supabase
            .from('email_logs')
            .update({ 
              status: 'sent', 
              smtp_message_id: result.messageId,
              sent_at: new Date().toISOString()
            })
            .eq('id', emailLogId);
        }
        
        // Update sender last used
        await supabase
          .from('sender_emails')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', senderEmailId);
        
        return result;
      } else {
        throw new Error(result.error || 'Failed to send email');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ 
        jobId: job.id, 
        recipientEmail, 
        error: errorMessage,
        attempt: job.attemptsMade + 1
      }, 'Email send failed');
      
      // Update email log on final failure
      if (job.attemptsMade >= 2 && emailLogId) {
        await supabase
          .from('email_logs')
          .update({ 
            status: 'failed', 
            error_message: errorMessage 
          })
          .eq('id', emailLogId);
        
        // Send notification to admin via internal API
        await sendFailureNotification({
          senderEmail: sender.email_address,
          error: errorMessage,
          projectId,
          recipientEmail
        });
      }
      
      throw error;
    }
  },
  {
    connection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000
    }
  }
);

// Configure retry behavior
worker.on('failed', (job, error) => {
  logger.error({ 
    jobId: job?.id, 
    error: error.message,
    attempts: job?.attemptsMade 
  }, 'Job failed');
});

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Job completed');
});

/**
 * Send failure notification to admin
 */
async function sendFailureNotification(data: {
  senderEmail: string;
  error: string;
  projectId: string;
  recipientEmail: string;
}): Promise<void> {
  const internalApiUrl = process.env.INTERNAL_API_URL;
  
  if (!internalApiUrl) {
    logger.warn('INTERNAL_API_URL not set, skipping notification');
    return;
  }
  
  try {
    await fetch(`${internalApiUrl}/internal/notify/failure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'smtp_failure',
        sender_email: data.senderEmail,
        error: data.error,
        project_id: data.projectId,
        recipient_email: data.recipientEmail
      })
    });
  } catch (error) {
    logger.error({ error }, 'Failed to send notification');
  }
}

/**
 * Setup cleanup cron job
 */
async function setupCleanupJob(): Promise<void> {
  // Add repeatable job to cleanup expired OTPs every 15 minutes
  await emailQueue.add('cleanup-expired-otps', {}, {
    repeat: {
      every: 15 * 60 * 1000 // 15 minutes
    }
  });
  
  logger.info('Cleanup job scheduled');
}

// Process cleanup job
const cleanupWorker = new Worker(
  'email-jobs',
  async (job) => {
    if (job.name !== 'cleanup-expired-otps') return;
    
    logger.info('Running OTP cleanup');
    
    const supabase = getSupabase();
    const { error } = await supabase.rpc('cleanup_expired_otps');
    
    if (error) {
      logger.error({ error }, 'Cleanup failed');
    } else {
      logger.info('Cleanup completed');
    }
  },
  { connection }
);

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down worker...');
  
  try {
    await worker.close();
    await cleanupWorker.close();
    await scheduler.close();
    await closeRedis();
    logger.info('Worker shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Worker shutdown error');
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start
logger.info('Worker started');
setupCleanupJob();