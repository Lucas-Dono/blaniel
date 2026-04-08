/**
 * Resend Webhook Handler
 *
 * Handles email events from Resend:
 * - email.sent
 * - email.delivered
 * - email.bounced
 * - email.opened
 * - email.clicked
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const { type, _data} = payload;

    console.log('📧 Resend webhook received:', type);

    // TODO: EmailSent model not yet implemented in schema
    // Uncomment when EmailSent model is added to Prisma schema
    /*
    // Find email by Resend ID
    const emailSent = await prisma.emailSent.findUnique({
      where: { resendId: data.email_id },
    });

    if (!emailSent) {
      console.warn('Email not found for Resend ID:', data.email_id);
      return NextResponse.json({ success: true }); // Return 200 to acknowledge
    }

    // Handle different event types
    switch (type) {
      case 'email.sent':
        await handleEmailSent(emailSent.id, data);
        break;

      case 'email.delivered':
        await handleEmailDelivered(emailSent.id, data);
        break;

      case 'email.bounced':
        await handleEmailBounced(emailSent.id, data);
        break;

      case 'email.opened':
        await handleEmailOpened(emailSent.id, data);
        break;

      case 'email.clicked':
        await handleEmailClicked(emailSent.id, data);
        break;

      default:
        console.log('Unknown event type:', type);
    }
    */

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing Resend webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// TODO: Uncomment when EmailSent model is added to Prisma schema
/*
async function handleEmailSent(emailId: string, data: any) {
  await prisma.emailSent.update({
    where: { id: emailId },
    data: {
      status: 'sent',
      sentAt: new Date(data.created_at),
    },
  });
  console.log('✅ Email sent:', emailId);
}

async function handleEmailDelivered(emailId: string, data: any) {
  await prisma.emailSent.update({
    where: { id: emailId },
    data: {
      status: 'delivered',
      delivered: true,
      deliveredAt: new Date(data.created_at),
    },
  });
  console.log('✅ Email delivered:', emailId);
}

async function handleEmailBounced(emailId: string, data: any) {
  await prisma.emailSent.update({
    where: { id: emailId },
    data: {
      status: 'bounced',
      bounceReason: data.bounce_type || 'Unknown',
    },
  });
  console.log('❌ Email bounced:', emailId, data.bounce_type);
}

async function handleEmailOpened(emailId: string, data: any) {
  const email = await prisma.emailSent.findUnique({
    where: { id: emailId },
  });

  if (!email) return;

  await prisma.emailSent.update({
    where: { id: emailId },
    data: {
      opened: true,
      openedAt: email.openedAt || new Date(data.created_at), // First open time
      openCount: email.openCount + 1,
    },
  });
  console.log('👁️  Email opened:', emailId);
}

async function handleEmailClicked(emailId: string, data: any) {
  const email = await prisma.emailSent.findUnique({
    where: { id: emailId },
  });

  if (!email) return;

  const clickedUrls = (email.clickedUrls as string[]) || [];
  if (data.click?.link && !clickedUrls.includes(data.click.link)) {
    clickedUrls.push(data.click.link);
  }

  await prisma.emailSent.update({
    where: { id: emailId },
    data: {
      clicked: true,
      clickedAt: email.clickedAt || new Date(data.created_at), // First click time
      clickCount: email.clickCount + 1,
      clickedUrls,
    },
  });
  console.log('🖱️  Email clicked:', emailId, data.click?.link);
}
*/
