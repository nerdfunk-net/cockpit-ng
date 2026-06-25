import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'
const AUTH_COOKIE = 'cockpit_auth_token'
const TOKEN_MAX_AGE = 60 * 60 * 24 // 1 day in seconds

// Auth paths that may return an access_token in the JSON body
const AUTH_TOKEN_RE = /^auth\/(login|refresh|oidc\/[^/]+\/callback)/

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params
  return handleRequest(request, 'GET', resolvedParams.path)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params
  return handleRequest(request, 'POST', resolvedParams.path)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params
  return handleRequest(request, 'PUT', resolvedParams.path)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params
  return handleRequest(request, 'DELETE', resolvedParams.path)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params
  return handleRequest(request, 'PATCH', resolvedParams.path)
}

async function handleRequest(
  request: NextRequest,
  method: string,
  pathSegments: string[]
) {
  try {
    const originalPath = request.nextUrl.pathname
    const proxyPrefix = '/api/proxy/'

    const pathAfterProxy = originalPath.startsWith(proxyPrefix)
      ? originalPath.slice(proxyPrefix.length)
      : pathSegments.join('/')

    // Reject path traversal attempts
    const decoded = decodeURIComponent(pathAfterProxy)
    if (decoded.includes('..') || decoded.includes('\\')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    const searchParams = request.nextUrl.searchParams.toString()

    let url: string
    if (pathAfterProxy.startsWith('auth/') || pathAfterProxy.startsWith('profile')) {
      url = `${BACKEND_URL}/${pathAfterProxy}${searchParams ? `?${searchParams}` : ''}`
    } else if (pathAfterProxy.startsWith('api/')) {
      url = `${BACKEND_URL}/${pathAfterProxy}${searchParams ? `?${searchParams}` : ''}`
    } else {
      url = `${BACKEND_URL}/api/${pathAfterProxy}${searchParams ? `?${searchParams}` : ''}`
    }

    let body = undefined
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      try {
        body = await request.text()
      } catch {
        // No body or invalid body
      }
    }

    const headers: Record<string, string> = {}

    // Copy safe headers only — Authorization is injected from the httpOnly cookie below
    const headersToCopy = ['content-type', 'accept', 'user-agent', 'x-forwarded-for']
    headersToCopy.forEach(headerName => {
      const value = request.headers.get(headerName)
      if (value) {
        headers[headerName] = value
      }
    })

    // Inject auth from the httpOnly cookie (single source of truth)
    const cookieToken = request.cookies.get(AUTH_COOKIE)?.value
    if (cookieToken) {
      headers['authorization'] = `Bearer ${cookieToken}`
    }

    if (body && !headers['content-type']) {
      headers['content-type'] = 'application/json'
    }

    const backendResponse = await fetch(url, {
      method,
      headers,
      ...(body && { body }),
    })

    if (backendResponse.status === 204) {
      return new NextResponse(null, { status: 204 })
    }

    const contentType = backendResponse.headers.get('content-type')

    // For auth paths that return a token: set httpOnly cookie and strip token from body
    if (
      AUTH_TOKEN_RE.test(pathAfterProxy) &&
      backendResponse.ok &&
      contentType?.includes('application/json')
    ) {
      const responseData = await backendResponse.json()
      if (responseData.access_token) {
        const { access_token, ...safeData } = responseData
        const res = NextResponse.json(safeData, {
          status: backendResponse.status,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            Pragma: 'no-cache',
          },
        })
        res.cookies.set(AUTH_COOKIE, access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/',
          maxAge: TOKEN_MAX_AGE,
        })
        return res
      }
      return NextResponse.json(responseData, {
        status: backendResponse.status,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          Pragma: 'no-cache',
        },
      })
    }

    // Handle file downloads (pass through without JSON serialization)
    if (
      contentType?.includes('application/x-yaml') ||
      contentType?.includes('text/csv') ||
      contentType?.includes('application/octet-stream') ||
      contentType?.includes('application/zip')
    ) {
      const blob = await backendResponse.blob()

      const responseHeaders = new Headers()
      const blobHeadersToCopy = ['content-type', 'content-disposition', 'content-length']
      blobHeadersToCopy.forEach(header => {
        const value = backendResponse.headers.get(header)
        if (value) {
          responseHeaders.set(header, value)
        }
      })

      return new NextResponse(blob, {
        status: backendResponse.status,
        headers: responseHeaders,
      })
    }

    let responseData
    if (contentType?.includes('application/json')) {
      responseData = await backendResponse.json()
    } else {
      responseData = await backendResponse.text()
    }

    if (!backendResponse.ok) {
      return NextResponse.json(
        typeof responseData === 'string' ? { error: responseData } : responseData,
        { status: backendResponse.status }
      )
    }

    return NextResponse.json(responseData, {
      status: backendResponse.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
      },
    })
  } catch (error) {
    console.error(`Frontend API ${method} error:`, error)

    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { error: 'Cannot connect to backend server' },
        { status: 503 }
      )
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
