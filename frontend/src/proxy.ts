import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const AUTH_COOKIE = 'cockpit_auth_token'

const DOCS_PATHS = ['/api/docs', '/api/redoc', '/api/openapi.json']
const DOCS_PREFIXES = ['/api/docs/', '/api/redoc/']

function isDocsPath(pathname: string): boolean {
  return (
    DOCS_PATHS.includes(pathname) ||
    DOCS_PREFIXES.some(p => pathname.startsWith(p))
  )
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isDocsPath(pathname)) {
    if (process.env.NODE_ENV === 'production') {
      return new NextResponse('Not found', { status: 404 })
    }

    const response = NextResponse.next()
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
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('X-XSS-Protection', '1; mode=block')
    return response
  }

  // Redirect unauthenticated requests for protected dashboard routes to /login.
  // Cookie presence is a cheap edge check; real validation happens at the backend.
  if (!request.cookies.get(AUTH_COOKIE)?.value) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Run on all routes except Next.js internals, static assets, login, and auth API
    '/((?!_next/static|_next/image|favicon.ico|fonts|login|api/auth).*)',
    '/api/docs/:path*',
    '/api/redoc/:path*',
    '/api/openapi.json',
  ],
}
