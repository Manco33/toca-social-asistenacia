import { type NextRequest, NextResponse } from 'next/server';

/**
 * Middleware para manejar sesiones y redireccionamientos
 * TODO: Implement custom session management
 */
export function middleware(request: NextRequest) {
  // Por ahora, solo permitir pasar todos los requests
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
