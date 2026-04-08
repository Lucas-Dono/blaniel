/**
 * Email Sequence Service
 *
 * Core service for managing email sequences, scheduling, and sending
 */



import type {
  EmailTrigger,
  EmailTemplateData,
  SequenceName,
  TriggerEvent,
  ConversionType,
} from '../types';

import {addDays, addHours, setHours} from 'date-fns';

/**
 * Trigger an email sequence for a user
 */
export async function triggerSequence(_trigger: EmailTrigger): Promise<void> {
  // TODO: Re-enable when email sequence models are added to Prisma schema
  console.warn('[Email Sequences] Email sequence system is currently disabled - missing Prisma models');
  return;

  /* DISABLED UNTIL SCHEMA IS UPDATED
  const { event, userId, metadata } = trigger;

  // Get user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { emailPreference: true },
  });

  if (!user || !user.email) {
    console.warn(`User ${userId} not found or has no email`);
    return;
  }

  // Check if user has unsubscribed
  if (user.emailPreference?.unsubscribedAll) {
    console.log(`User ${userId} has unsubscribed from all emails`);
    return;
  }

  // Find matching sequence
  const sequence = await prisma.emailSequence.findFirst({
    where: {
      triggerEvent: event,
      active: true,
    },
    include: {
      emails: {
        where: { active: true },
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!sequence) {
    console.warn(`No active sequence found for event: ${event}`);
    return;
  }

  // Check if sequence applies to user's plan
  const targetPlans = sequence.targetPlans as string[];
  if (targetPlans.length > 0 && !targetPlans.includes(user.plan)) {
    console.log(`Sequence ${sequence.name} does not target plan: ${user.plan}`);
    return;
  }

  // Check category preferences
  const prefs = user.emailPreference;
  if (prefs && !shouldSendSequenceCategory(sequence.category, prefs)) {
    console.log(`User has disabled ${sequence.category} emails`);
    return;
  }

  // Check if user is already in this sequence
  const existingState = await prisma.userSequenceState.findUnique({
    where: {
      userId_sequenceId: {
        userId,
        sequenceId: sequence.id,
      },
    },
  });

  if (existingState && existingState.status === 'active') {
    console.log(`User ${userId} is already in sequence ${sequence.name}`);
    return;
  }

  // Create or update sequence state
  const now = new Date();
  const firstEmail = sequence.emails[0];

  if (!firstEmail) {
    console.warn(`Sequence ${sequence.name} has no emails`);
    return;
  }

  const nextEmailAt = calculateNextEmailTime(now, firstEmail, prefs);

  await prisma.userSequenceState.upsert({
    where: {
      userId_sequenceId: {
        userId,
        sequenceId: sequence.id,
      },
    },
    create: {
      userId,
      sequenceId: sequence.id,
      status: 'active',
      currentStep: 0,
      startedAt: now,
      nextEmailAt,
      metadata: metadata || {},
    },
    update: {
      status: 'active',
      currentStep: 0,
      startedAt: now,
      nextEmailAt,
      metadata: metadata || {},
      cancelledAt: null,
    },
  });

  console.log(`✅ Started sequence ${sequence.name} for user ${userId}`);
  */
}

/**
 * Process scheduled emails (called by cron job)
 */
export async function processScheduledEmails(): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  // TODO: Re-enable when email sequence models are added to Prisma schema
  console.warn('[Email Sequences] Email sequence system is currently disabled - missing Prisma models');
  return { processed: 0, sent: 0, failed: 0 };

  /* DISABLED UNTIL SCHEMA IS UPDATED
  const now = new Date();

  // Find all sequence states ready for next email
  const readyStates = await prisma.userSequenceState.findMany({
    where: {
      status: 'active',
      nextEmailAt: {
        lte: now,
      },
    },
    include: {
      user: {
        include: { emailPreference: true },
      },
      sequence: {
        include: {
          emails: {
            where: { active: true },
            orderBy: { order: 'asc' },
          },
        },
      },
    },
    take: 100, // Process 100 at a time
  });

  let processed = 0;
  let sent = 0;
  let failed = 0;

  for (const state of readyStates) {
    processed++;

    try {
      const { user, sequence } = state;
      const emailTemplate = sequence.emails[state.currentStep];

      if (!emailTemplate) {
        // Sequence completed
        await prisma.userSequenceState.update({
          where: { id: state.id },
          data: {
            status: 'completed',
            completedAt: now,
          },
        });
        continue;
      }

      // Check email preferences
      if (!shouldSendEmail(user, sequence, emailTemplate)) {
        // Skip this email and move to next
        const nextStep = state.currentStep + 1;
        const nextEmail = sequence.emails[nextStep];

        if (nextEmail) {
          const nextEmailAt = calculateNextEmailTime(now, nextEmail, user.emailPreference);
          await prisma.userSequenceState.update({
            where: { id: state.id },
            data: {
              currentStep: nextStep,
              nextEmailAt,
            },
          });
        } else {
          await prisma.userSequenceState.update({
            where: { id: state.id },
            data: {
              status: 'completed',
              completedAt: now,
            },
          });
        }
        continue;
      }

      // Prepare email data
      const emailData: EmailTemplateData = {
        userName: user.name || user.email.split('@')[0],
        userEmail: user.email,
        plan: user.plan as any,
        unsubscribeUrl: `${process.env.NEXTAUTH_URL}/api/email/unsubscribe?userId=${user.id}`,
        loginUrl: `${process.env.NEXTAUTH_URL}/login`,
        dashboardUrl: `${process.env.NEXTAUTH_URL}/dashboard`,
        upgradeUrl: `${process.env.NEXTAUTH_URL}/dashboard/upgrade`,
        supportUrl: `${process.env.NEXTAUTH_URL}/support`,
        ...(state.metadata as any),
      };

      // Render email template
      const { html, text, subject } = await renderEmailTemplate(
        emailTemplate.templateId,
        emailData,
        emailTemplate.subject
      );

      // Send email
      const result = await sendEmail({
        to: user.email,
        subject,
        html,
        text,
        tags: [
          { name: 'sequence', value: sequence.name },
          { name: 'template', value: emailTemplate.name },
        ],
      });

      if (result.success && result.data?.data?.id) {
        // Track sent email
        await prisma.emailSent.create({
          data: {
            userId: user.id,
            sequenceId: sequence.id,
            templateId: emailTemplate.id,
            recipientEmail: user.email,
            subject,
            resendId: result.data.data.id,
            status: 'sent',
            sentAt: now,
          },
        });

        // Update sequence state
        const nextStep = state.currentStep + 1;
        const nextEmail = sequence.emails[nextStep];

        if (nextEmail) {
          const nextEmailAt = calculateNextEmailTime(now, nextEmail, user.emailPreference);
          await prisma.userSequenceState.update({
            where: { id: state.id },
            data: {
              currentStep: nextStep,
              lastEmailSentAt: now,
              nextEmailAt,
            },
          });
        } else {
          // Sequence completed
          await prisma.userSequenceState.update({
            where: { id: state.id },
            data: {
              status: 'completed',
              lastEmailSentAt: now,
              completedAt: now,
            },
          });
        }

        sent++;
        console.log(`✅ Sent ${emailTemplate.name} to ${user.email}`);
      } else {
        // Track failed email
        await prisma.emailSent.create({
          data: {
            userId: user.id,
            sequenceId: sequence.id,
            templateId: emailTemplate.id,
            recipientEmail: user.email,
            subject,
            status: 'failed',
            error: result.error || 'Unknown error',
          },
        });

        failed++;
        console.error(`❌ Failed to send ${emailTemplate.name} to ${user.email}:`, result.error);
      }
    } catch (error) {
      failed++;
      console.error('Error processing email:', error);
    }
  }

  return { processed, sent, failed };
  */
}

/**
 * Track email conversion
 */
export async function trackConversion(_params: {
  userId: string;
  sequenceId: string;
  conversionType: ConversionType;
}): Promise<void> {
  // TODO: Re-enable when email sequence models are added to Prisma schema
  console.warn('[Email Sequences] Email sequence system is currently disabled - missing Prisma models');
  return;

  /* DISABLED UNTIL SCHEMA IS UPDATED
  const { userId, sequenceId, conversionType } = params;

  // Find most recent email sent in this sequence
  const emailSent = await prisma.emailSent.findFirst({
    where: {
      userId,
      sequenceId,
      converted: false,
    },
    orderBy: {
      sentAt: 'desc',
    },
  });

  if (emailSent) {
    await prisma.emailSent.update({
      where: { id: emailSent.id },
      data: {
        converted: true,
        convertedAt: new Date(),
        conversionType,
      },
    });

    console.log(`✅ Tracked conversion: ${conversionType} for sequence ${sequenceId}`);
  }
  */
}

/**
 * Cancel a sequence for a user
 */
export async function cancelSequence(_userId: string, _sequenceName: SequenceName): Promise<void> {
  // TODO: Re-enable when email sequence models are added to Prisma schema
  console.warn('[Email Sequences] Email sequence system is currently disabled - missing Prisma models');
  return;

  /* DISABLED UNTIL SCHEMA IS UPDATED
  const sequence = await prisma.emailSequence.findUnique({
    where: { name: sequenceName },
  });

  if (!sequence) return;

  await prisma.userSequenceState.updateMany({
    where: {
      userId,
      sequenceId: sequence.id,
      status: 'active',
    },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
    },
  });
  */
}

/**
 * Helper: Calculate next email send time
 */
function calculateNextEmailTime(
  baseTime: Date,
  template: any,
  preferences: any
): Date {
  let nextTime = addDays(baseTime, template.delayDays || 0);
  nextTime = addHours(nextTime, template.delayHours || 0);

  // Respect send time window
  if (template.sendTimeStart !== null && template.sendTimeEnd !== null) {
    const currentHour = nextTime.getHours();
    if (currentHour < template.sendTimeStart) {
      nextTime = setHours(nextTime, template.sendTimeStart);
    } else if (currentHour >= template.sendTimeEnd) {
      nextTime = addDays(setHours(nextTime, template.sendTimeStart), 1);
    }
  }

  // Respect user preferences
  if (preferences?.preferredHourStart && preferences?.preferredHourEnd) {
    const currentHour = nextTime.getHours();
    if (currentHour < preferences.preferredHourStart) {
      nextTime = setHours(nextTime, preferences.preferredHourStart);
    } else if (currentHour >= preferences.preferredHourEnd) {
      nextTime = addDays(setHours(nextTime, preferences.preferredHourStart), 1);
    }
  }

  return nextTime;
}

/**
 * Helper: Check if sequence category is allowed for user
 */
function shouldSendSequenceCategory(category: string, preferences: any): boolean {
  if (!preferences) return true;

  switch (category) {
    case 'onboarding':
      return preferences.onboardingEmails !== false;
    case 'retention':
      return preferences.retentionEmails !== false;
    case 'conversion':
      return preferences.conversionEmails !== false;
    case 'feature_announcement':
      return preferences.featureEmails !== false;
    default:
      return true;
  }
}

/**
 * Helper: Check if email should be sent
 */
function shouldSendEmail(user: any, sequence: any, _template: any): boolean {
  // Always send transactional emails
  if (sequence.category === 'transactional') return true;

  // Check global unsubscribe
  if (user.emailPreference?.unsubscribedAll) return false;

  // Check category preferences
  if (!shouldSendSequenceCategory(sequence.category, user.emailPreference)) {
    return false;
  }

  return true;
}
