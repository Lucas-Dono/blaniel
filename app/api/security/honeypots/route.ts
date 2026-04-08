/**
 * Honeypot Management API
 */

import { NextRequest, NextResponse } from 'next/server';
import { HONEYPOT_CONFIGS } from '@/lib/security/honeypots';

// GET - List honeypot configurations
export async function GET(_request: NextRequest) {
  try {
    const configs = HONEYPOT_CONFIGS.map(config => ({
      path: config.path,
      name: config.name,
      type: config.type,
      description: config.description,
      autoBlock: config.autoBlock,
      tarpitDelay: config.tarpitDelay,
    }));

    return NextResponse.json({ honeypots: configs });
  } catch (error) {
    console.error('[HONEYPOTS_API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch honeypots' },
      { status: 500 }
    );
  }
}
