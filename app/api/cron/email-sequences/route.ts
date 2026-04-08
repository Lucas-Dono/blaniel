/**
 * Email Sequences Cron Job
 *
 * DISABLED: This feature uses Prisma models that don't exist in the schema yet.
 * Models needed: emailSequence, emailSent, emailSequenceAnalytics
 *
 * TODO: Implement email sequence models in Prisma schema before enabling this endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Feature is disabled
  return NextResponse.json(
    {
      success: false,
      error: 'Email sequences feature is not yet implemented. Required Prisma models are missing.',
      message: 'This endpoint requires emailSequence, emailSent, and emailSequenceAnalytics models to be added to the Prisma schema.',
      timestamp: new Date().toISOString(),
    },
    { status: 501 } // 501 Not Implemented
  );
}
