/**
 * Resend Email Client Configuration
 *
 * Centralized Resend client for sending emails across the platform
 */

import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  console.warn('⚠️  RESEND_API_KEY not found in environment variables. Email sending will be disabled.');
}

// Lazy-initialize Resend client to avoid build errors when API key is missing
let _resend: Resend | null = null;
export const resend = new Proxy({} as Resend, {
  get(target, prop) {
    if (!_resend && process.env.RESEND_API_KEY) {
      _resend = new Resend(process.env.RESEND_API_KEY);
    }
    if (!_resend) {
      throw new Error('Resend client not initialized - RESEND_API_KEY is missing');
    }
    return Reflect.get(_resend, prop);
  }
});

// Default sender email
export const DEFAULT_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@blaniel.com';
export const DEFAULT_FROM_NAME = process.env.RESEND_FROM_NAME || 'Blaniel';

// Email configuration
export const EMAIL_CONFIG = {
  defaultFrom: `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_EMAIL}>`,
  replyTo: process.env.RESEND_REPLY_TO_EMAIL,

  // Rate limits (Resend free tier: 100 emails/day)
  maxEmailsPerDay: parseInt(process.env.EMAIL_MAX_PER_DAY || '100'),
  maxEmailsPerHour: parseInt(process.env.EMAIL_MAX_PER_HOUR || '50'),

  // Batch settings
  batchSize: parseInt(process.env.EMAIL_BATCH_SIZE || '10'), // Send in batches
  batchDelay: parseInt(process.env.EMAIL_BATCH_DELAY_MS || '1000'), // 1s between batches

  // Retry settings
  maxRetries: 3,
  retryDelay: 5000, // 5 seconds

  // Tracking
  trackOpens: true,
  trackClicks: true,
} as const;

/**
 * Check if email sending is enabled
 */
export function isEmailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/**
 * Send a single email using Resend
 */
export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
  headers?: Record<string, string>;
}) {
  if (!isEmailEnabled()) {
    console.warn('Email sending is disabled. Skipping email:', params.subject);
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const result = await resend.emails.send({
      from: params.from || EMAIL_CONFIG.defaultFrom,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      replyTo: params.replyTo || EMAIL_CONFIG.replyTo,
      tags: params.tags,
      headers: params.headers,
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Send batch emails with rate limiting
 */
export async function sendBatchEmails(
  emails: Array<{
    to: string;
    subject: string;
    html: string;
    text?: string;
    tags?: { name: string; value: string }[];
  }>
) {
  if (!isEmailEnabled()) {
    console.warn('Email sending is disabled. Skipping batch emails.');
    return { success: false, sent: 0, failed: 0 };
  }

  const results = [];
  let sent = 0;
  let failed = 0;

  // Process in batches
  for (let i = 0; i < emails.length; i += EMAIL_CONFIG.batchSize) {
    const batch = emails.slice(i, i + EMAIL_CONFIG.batchSize);

    const batchResults = await Promise.allSettled(
      batch.map(email => sendEmail(email))
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value.success) {
        sent++;
      } else {
        failed++;
      }
    }

    results.push(...batchResults);

    // Delay between batches to avoid rate limits
    if (i + EMAIL_CONFIG.batchSize < emails.length) {
      await new Promise(resolve => setTimeout(resolve, EMAIL_CONFIG.batchDelay));
    }
  }

  return {
    success: failed === 0,
    sent,
    failed,
    results,
  };
}
