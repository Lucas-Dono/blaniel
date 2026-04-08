import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/middleware/auth-helper';

import { ResearchService } from '@/lib/services/research.service';

/**
 * GET /api/community/research - Listar proyectos de investigación
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category') || undefined;
    const tags = searchParams.get('tags')?.split(',') || undefined;
    const leadAuthorId = searchParams.get('leadAuthorId') || searchParams.get('leaderId') || undefined;
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;
    const openForContributions = searchParams.get('openForContributions') === 'true' || searchParams.get('lookingForCollaborators') === 'true' || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');

    const result = await ResearchService.listProjects(
      { category, tags, leadAuthorId, status, search, openForContributions },
      page,
      limit
    );

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/**
 * POST /api/community/research - Crear proyecto de investigación
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const data = await request.json();
    const project = await ResearchService.createProject(session.user.id, data);

    return NextResponse.json(project, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
