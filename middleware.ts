import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicPaths = ['/api/auth', '/_next', '/favicon.ico'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (publicPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  response.headers.set('x-dev-mode', process.env.DEV_MODE === 'true' ? '1' : '0');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
