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
    // All assets served locally - no CDN dependencies for air-gapped environments
    response.headers.set(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "script-src-elem 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "style-src-elem 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
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
