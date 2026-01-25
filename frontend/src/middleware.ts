import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if this is a Swagger UI or API docs request
  if (
    pathname === '/api/docs' ||
    pathname === '/api/redoc' ||
    pathname === '/api/openapi.json' ||
    pathname.startsWith('/api/docs/') ||
    pathname.startsWith('/api/redoc/')
  ) {
    // Clone the response
    const response = NextResponse.next()

    // Set relaxed CSP headers for Swagger UI
    response.headers.set(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
        "script-src-elem 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
        "style-src-elem 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
        "img-src 'self' data: blob: https://fastapi.tiangolo.com https://cdn.jsdelivr.net",
        "font-src 'self' data: https://cdn.jsdelivr.net",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ')
    )

    // Security headers for Swagger UI
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('X-XSS-Protection', '1; mode=block')

    return response
  }

  // For all other routes, continue without modification
  // (next.config.ts headers will be applied)
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/docs/:path*',
    '/api/redoc/:path*',
    '/api/openapi.json',
  ],
}
