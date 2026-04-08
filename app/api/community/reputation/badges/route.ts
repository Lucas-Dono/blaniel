import { NextRequest, NextResponse } from 'next/server';
import { BADGES } from '@/lib/services/reputation.service';

/**
 * GET /api/community/reputation/badges - Lista de todos los badges disponibles
 */
export async function GET(_request: NextRequest) {
  try {
    return NextResponse.json(BADGES);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
