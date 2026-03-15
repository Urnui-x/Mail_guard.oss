import { FastifyInstance } from 'fastify';
import { 
  generateOtp, 
  hashOtp, 
  maskEmail, 
  getSupabase,
  getRedis,
  checkRedisHealth,
  type Project,
  type SenderEmail
} from '@mailguard/core';
import { 
  renderTemplate, 
  DEFAULT_OTP_SUBJECT, 
  getDefaultOtpBody 
} from '@mailguard/smtp';
import { Queue } from 'bullmq';
import { sendOtpSchema, verifyOtpSchema } from '../schemas.js';
import { authMiddleware, apiRateLimitMiddleware, otpSendRateLimitMiddleware } from '../middleware/index.js';

// BullMQ queue for email jobs
let emailQueue: Queue | null = null;

function getEmailQueue(): Queue {
  if (!emailQueue) {
    const redisUrl = process.env.REDIS_URL!;
    const url = new URL(redisUrl);
    
    emailQueue = new Queue('email-jobs', {
      connection: {
        host: url.hostname,
        port: parseInt(url.port || '6379'),
        password: url.password || undefined,
        username: url.username || undefined
      }
    });
  }
  return emailQueue;
}

/**
 * OTP Routes
 */
export async function otpRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/v1/otp/send
  fastify.post('/send', {
    preHandler: [authMiddleware, otpSendRateLimitMiddleware],
    schema: {
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' },
          purpose: { type: 'string', maxLength: 50 }
        }
      }
    }
  }, async (request, reply) => {
    const body = request.body as { email: string; purpose?: string };
    const project = request.project!;
    const apiKey = request.apiKey!;
    
    // Validate input
    const parsed = sendOtpSchema.safeParse(body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'validation_error',
        message: parsed.error.issues[0].message
      });
    }
    
    const { email, purpose } = parsed.data;
    
    // Check if sandbox key - return fake success
    if (apiKey.is_sandbox) {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      return reply.send({
        id: fakeId,
        status: 'sent',
        expires_in: project.otp_expiry_seconds,
        masked_email: maskEmail(email)
      });
    }
    
    // Check if project has a sender email configured
    if (!project.sender_email_id || !project.sender_email) {
      return reply.code(400).send({
        error: 'sender_not_configured',
        message: 'No sender email configured for this project'
      });
    }
    
    const sender = project.sender_email as SenderEmail;
    
    // Check if sender is active and verified
    if (!sender.is_active || !sender.is_verified) {
      return reply.code(400).send({
        error: 'sender_not_configured',
        message: 'Sender email is not active or not verified'
      });
    }
    
    const supabase = getSupabase();
    
    // Generate OTP
    const otp = generateOtp(project.otp_length);
    const otpHash = await hashOtp(otp);
    
    // Calculate expiry
    const expiresAt = new Date(Date.now() + project.otp_expiry_seconds * 1000);
    
    // Invalidate any previous active OTPs for this email + project
    await supabase
      .from('otp_records')
      .update({ is_invalidated: true })
      .eq('project_id', project.id)
      .eq('recipient_email', email.toLowerCase())
      .eq('is_verified', false)
      .eq('is_invalidated', false);
    
    // Insert new OTP record
    const { data: otpRecord, error: otpError } = await supabase
      .from('otp_records')
      .insert({
        project_id: project.id,
        recipient_email: email.toLowerCase(),
        otp_hash: otpHash,
        purpose: purpose || 'verification',
        expires_at: expiresAt.toISOString(),
        ip_address: request.ip
      })
      .select()
      .single();
    
    if (otpError || !otpRecord) {
      request.log.error({ error: otpError }, 'Failed to create OTP record');
      return reply.code(500).send({
        error: 'internal_error',
        message: 'Failed to create OTP'
      });
    }
    
    // Create email log entry
    const { data: emailLog, error: logError } = await supabase
      .from('email_logs')
      .insert({
        project_id: project.id,
        sender_email_id: sender.id,
        type: 'otp',
        recipient_email: email.toLowerCase(),
        subject: project.otp_subject_tmpl || DEFAULT_OTP_SUBJECT,
        status: 'queued'
      })
      .select()
      .single();
    
    if (logError || !emailLog) {
      request.log.error({ error: logError }, 'Failed to create email log');
      // Continue anyway, OTP is created
    }
    
    // Render email content
    const subject = renderTemplate(
      project.otp_subject_tmpl || DEFAULT_OTP_SUBJECT,
      {
        otp_code: otp,
        app_name: project.name,
        expiry_minutes: Math.floor(project.otp_expiry_seconds / 60),
        recipient_email: email
      }
    );
    
    const bodyTemplate = project.otp_body_tmpl || getDefaultOtpBody(project.otp_format);
    const emailBody = renderTemplate(bodyTemplate, {
      otp_code: otp,
      app_name: project.name,
      expiry_minutes: Math.floor(project.otp_expiry_seconds / 60),
      recipient_email: email
    });
    
    // Push job to queue
    try {
      const queue = getEmailQueue();
      await queue.add('send-email', {
        senderEmailId: sender.id,
        recipientEmail: email.toLowerCase(),
        subject,
        body: emailBody,
        format: project.otp_format,
        emailLogId: emailLog?.id,
        projectId: project.id,
        otpRecordId: otpRecord.id
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        removeOnComplete: 100,
        removeOnFail: 50
      });
    } catch (error) {
      request.log.error({ error }, 'Failed to queue email job');
      // Update email log status
      if (emailLog) {
        await supabase
          .from('email_logs')
          .update({ 
            status: 'failed', 
            error_message: 'Failed to queue email job' 
          })
          .eq('id', emailLog.id);
      }
    }
    
    return reply.send({
      id: otpRecord.id,
      status: 'queued',
      expires_in: project.otp_expiry_seconds,
      masked_email: maskEmail(email)
    });
  });
  
  // POST /api/v1/otp/verify
  fastify.post('/verify', {
    preHandler: [authMiddleware, apiRateLimitMiddleware],
    schema: {
      body: {
        type: 'object',
        required: ['email', 'code'],
        properties: {
          email: { type: 'string', format: 'email' },
          code: { type: 'string', pattern: '^\\d{4,8}$' }
        }
      }
    }
  }, async (request, reply) => {
    const body = request.body as { email: string; code: string };
    const project = request.project!;
    const apiKey = request.apiKey!;
    
    // Validate input
    const parsed = verifyOtpSchema.safeParse(body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'validation_error',
        message: parsed.error.issues[0].message
      });
    }
    
    const { email, code } = parsed.data;
    
    // Check if sandbox key - return fake verification
    if (apiKey.is_sandbox) {
      return reply.send({
        verified: true,
        token: 'sandbox_token',
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      });
    }
    
    const supabase = getSupabase();
    
    // Find active OTP record
    const { data: otpRecord, error: otpError } = await supabase
      .from('otp_records')
      .select('*')
      .eq('project_id', project.id)
      .eq('recipient_email', email.toLowerCase())
      .eq('is_verified', false)
      .eq('is_invalidated', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (otpError || !otpRecord) {
      return reply.code(410).send({
        verified: false,
        error: 'otp_expired',
        message: 'OTP has expired or does not exist'
      });
    }
    
    // Check if account is locked
    if (otpRecord.attempts_count >= project.otp_max_attempts) {
      return reply.code(423).send({
        verified: false,
        error: 'account_locked',
        message: 'Maximum attempts exceeded',
        attempts_remaining: 0
      });
    }
    
    // Import verifyOtp function
    const { verifyOtp, signJwt } = await import('@mailguard/core');
    
    // Verify OTP
    const isValid = await verifyOtp(code, otpRecord.otp_hash);
    
    if (isValid) {
      // Update OTP record as verified
      await supabase
        .from('otp_records')
        .update({
          is_verified: true,
          is_invalidated: true,
          verified_at: new Date().toISOString()
        })
        .eq('id', otpRecord.id);
      
      // Generate JWT token
      const token = signJwt(
        {
          sub: email.toLowerCase(),
          projectId: project.id,
          purpose: otpRecord.purpose
        },
        900 // 15 minutes
      );
      
      return reply.send({
        verified: true,
        token,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      });
    }
    
    // Increment attempts
    await supabase.rpc('increment_otp_attempts', { otp_id: otpRecord.id });
    
    const attemptsRemaining = project.otp_max_attempts - otpRecord.attempts_count - 1;
    
    return reply.code(400).send({
      verified: false,
      error: 'invalid_code',
      message: 'Invalid OTP code',
      attempts_remaining: Math.max(0, attemptsRemaining)
    });
  });
}