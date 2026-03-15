import { Context } from 'grammy';
import { maskEmail } from '@mailguard/core';

/**
 * Send SMTP failure notification
 */
export async function sendSmtpFailureNotification(
  ctx: Context,
  data: {
    senderEmail: string;
    error: string;
    projectName: string;
    recipientEmail: string;
    attempts: number;
  }
): Promise<void> {
  const message = 
    `🚨 <b>SMTP Failure</b>\n\n` +
    `📧 <b>Sender:</b> ${maskEmail(data.senderEmail)}\n` +
    `📁 <b>Project:</b> ${data.projectName}\n` +
    `👤 <b>Recipient:</b> ${maskEmail(data.recipientEmail)}\n` +
    `🔄 <b>Attempts:</b> ${data.attempts}\n\n` +
    `<b>Error:</b>\n<code>${data.error.substring(0, 200)}</code>`;
  
  await ctx.reply(message, { parse_mode: 'HTML' });
}

/**
 * Send rate limit hit notification
 */
export async function sendRateLimitNotification(
  ctx: Context,
  data: {
    tier: string;
    projectName: string;
    key: string;
    limit: number;
  }
): Promise<void> {
  const message = 
    `⚠️ <b>Rate Limit Hit</b>\n\n` +
    `📁 <b>Project:</b> ${data.projectName}\n` +
    `📊 <b>Tier:</b> ${data.tier}\n` +
    `🔑 <b>Key:</b> ${data.key}\n` +
    `📈 <b>Limit:</b> ${data.limit}`;
  
  await ctx.reply(message, { parse_mode: 'HTML' });
}

/**
 * Send daily summary notification
 */
export async function sendDailySummary(
  ctx: Context,
  data: {
    sentCount: number;
    failedCount: number;
    queueDepth: number;
    date: string;
  }
): Promise<void> {
  const successRate = data.sentCount > 0 
    ? ((data.sentCount - data.failedCount) / data.sentCount * 100).toFixed(1)
    : 0;
  
  const message = 
    `📊 <b>Daily Summary</b>\n` +
    `📅 ${data.date}\n\n` +
    `✅ <b>Sent:</b> ${data.sentCount}\n` +
    `❌ <b>Failed:</b> ${data.failedCount}\n` +
    `📈 <b>Success Rate:</b> ${successRate}%\n` +
    `📬 <b>Queue Depth:</b> ${data.queueDepth}`;
  
  await ctx.reply(message, { parse_mode: 'HTML' });
}

/**
 * Send sender verification notification
 */
export async function sendSenderVerifiedNotification(
  ctx: Context,
  data: {
    email: string;
    provider: string;
    dailyLimit: number;
  }
): Promise<void> {
  const message = 
    `✅ <b>Sender Verified</b>\n\n` +
    `📧 <b>Email:</b> ${maskEmail(data.email)}\n` +
    `🏢 <b>Provider:</b> ${data.provider}\n` +
    `📊 <b>Daily Limit:</b> ${data.dailyLimit}`;
  
  await ctx.reply(message, { parse_mode: 'HTML' });
}