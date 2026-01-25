import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

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

export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params
  return handleRequest(request, 'HEAD', resolvedParams.path)
}

async function handleRequest(
  request: NextRequest,
  method: string,
  pathSegments: string[]
) {
  try {
    const originalPath = request.nextUrl.pathname
    const searchParams = request.nextUrl.searchParams.toString()

    // Extract the path after /api/
    const pathAfterApi = originalPath.startsWith('/api/')
      ? originalPath.slice('/api/'.length)
      : pathSegments.join('/')

    // Build the backend URL
    // For special FastAPI endpoints (docs, openapi.json, redoc), proxy directly without /api/ prefix
    // For regular API calls, keep the /api/ prefix
    let backendPath: string

    if (
      pathAfterApi === 'docs' ||
      pathAfterApi === 'redoc' ||
      pathAfterApi === 'openapi.json' ||
      pathAfterApi.startsWith('docs/') ||
      pathAfterApi.startsWith('redoc/')
    ) {
      // Swagger/ReDoc endpoints - proxy to backend root
      backendPath = pathAfterApi
    } else {
      // Regular API calls - keep /api/ prefix
      backendPath = `api/${pathAfterApi}`
    }

    const url = `${BACKEND_URL}/${backendPath}${searchParams ? `?${searchParams}` : ''}`

    console.log(`[API Proxy] ${method} ${originalPath} → ${url}`)

    // Get request body for methods that can have one
    let body = undefined
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      try {
        body = await request.text()
      } catch {
        // No body or invalid body
      }
    }

    // Get headers from the original request
    const headers: Record<string, string> = {}

    // Copy important headers
    const headersToCopy = [
      'authorization',
      'content-type',
      'accept',
      'user-agent',
      'cookie',
      'referer',
      'x-forwarded-for',
      'x-forwarded-proto',
      'x-forwarded-host'
    ]

    headersToCopy.forEach(headerName => {
      const value = request.headers.get(headerName)
      if (value) {
        headers[headerName] = value
      }
    })

    // Set default content-type if not set and we have a body
    if (body && !headers['content-type']) {
      headers['content-type'] = 'application/json'
    }

    // Forward the request to the backend
    const backendResponse = await fetch(url, {
      method,
      headers,
      ...(body && { body }),
    })

    console.log(`[API Proxy] Backend response: ${backendResponse.status} ${backendResponse.statusText}`)

    // Handle 204 No Content responses
    if (backendResponse.status === 204) {
      return new NextResponse(null, { status: 204 })
    }

    // Get response content type
    const contentType = backendResponse.headers.get('content-type') || ''

    // Build response headers
    const responseHeaders = new Headers()

    // Copy relevant headers from backend
    const responseHeadersToCopy = [
      'content-type',
      'content-disposition',
      'content-length',
      'cache-control',
      'etag',
      'last-modified',
      'set-cookie'
    ]

    responseHeadersToCopy.forEach(header => {
      const value = backendResponse.headers.get(header)
      if (value) {
        responseHeaders.set(header, value)
      }
    })

    // Handle different content types

    // OpenAPI JSON - modify server URLs and paths to work with proxy
    if (pathAfterApi === 'openapi.json') {
      try {
        // Parse the JSON response from backend
        const openApiSpec = await backendResponse.json()

        console.log('[API Proxy] Received OpenAPI spec, version:', openApiSpec.openapi || openApiSpec.swagger)

        // Update servers to use the /api prefix
        openApiSpec.servers = [
          {
            url: '/api',
            description: 'Frontend Proxy to Backend API'
          }
        ]

        // Rewrite paths to remove /api/ prefix to avoid double /api/api/ in URLs
        // Backend paths are like "/api/nautobot/devices" and "/auth/login"
        // We want them to be "/nautobot/devices" and "/auth/login"
        // Then Swagger UI will prepend /api server, resulting in "/api/nautobot/devices" and "/api/auth/login"
        const rewrittenPaths: Record<string, unknown> = {}

        for (const [path, pathItem] of Object.entries(openApiSpec.paths || {})) {
          // Remove leading /api/ if present
          const newPath = path.startsWith('/api/')
            ? path.substring('/api'.length) // Remove /api but keep the /
            : path

          rewrittenPaths[newPath] = pathItem
        }

        openApiSpec.paths = rewrittenPaths

        console.log('[API Proxy] Rewrote', Object.keys(openApiSpec.paths || {}).length, 'paths')

        // Return the modified spec
        return NextResponse.json(openApiSpec, {
          status: backendResponse.status,
          headers: {
            'Content-Type': 'application/json',
          },
        })
      } catch (error) {
        console.error('[API Proxy] Failed to process OpenAPI JSON:', error)

        // Return error response
        return NextResponse.json(
          { error: 'Failed to process OpenAPI specification', details: error instanceof Error ? error.message : 'Unknown error' },
          { status: 500 }
        )
      }
    }

    // HTML responses (Swagger UI, ReDoc)
    if (contentType.includes('text/html')) {
      let html = await backendResponse.text()

      // Rewrite OpenAPI URLs in Swagger UI and ReDoc to use the /api prefix
      if (pathAfterApi === 'docs' || pathAfterApi.startsWith('docs/')) {
        // Swagger UI - rewrite the OpenAPI spec URL
        html = html.replace(
          /url:\s*['"]\/openapi\.json['"]/g,
          'url: "/api/openapi.json"'
        )
        html = html.replace(
          /"\/openapi\.json"/g,
          '"/api/openapi.json"'
        )
      } else if (pathAfterApi === 'redoc' || pathAfterApi.startsWith('redoc/')) {
        // ReDoc - rewrite the spec-url attribute
        html = html.replace(
          /spec-url=['"]\/openapi\.json['"]/g,
          'spec-url="/api/openapi.json"'
        )
      }

      return new NextResponse(html, {
        status: backendResponse.status,
        headers: responseHeaders,
      })
    }

    // JavaScript files
    if (
      contentType.includes('application/javascript') ||
      contentType.includes('text/javascript')
    ) {
      const js = await backendResponse.text()
      return new NextResponse(js, {
        status: backendResponse.status,
        headers: responseHeaders,
      })
    }

    // CSS files
    if (contentType.includes('text/css')) {
      const css = await backendResponse.text()
      return new NextResponse(css, {
        status: backendResponse.status,
        headers: responseHeaders,
      })
    }

    // Image files
    if (
      contentType.includes('image/') ||
      contentType.includes('font/')
    ) {
      const blob = await backendResponse.blob()
      return new NextResponse(blob, {
        status: backendResponse.status,
        headers: responseHeaders,
      })
    }

    // File downloads (YAML, CSV, ZIP, etc.)
    if (
      contentType.includes('application/x-yaml') ||
      contentType.includes('text/csv') ||
      contentType.includes('application/octet-stream') ||
      contentType.includes('application/zip')
    ) {
      const blob = await backendResponse.blob()
      return new NextResponse(blob, {
        status: backendResponse.status,
        headers: responseHeaders,
      })
    }

    // JSON responses
    if (contentType.includes('application/json')) {
      const data = await backendResponse.json()

      if (!backendResponse.ok) {
        console.log(`[API Proxy] Backend error:`, data)
      }

      return NextResponse.json(data, {
        status: backendResponse.status,
        headers: responseHeaders,
      })
    }

    // Plain text or unknown content type - return as text
    const text = await backendResponse.text()

    if (!backendResponse.ok) {
      console.log(`[API Proxy] Backend error:`, text)
    }

    return new NextResponse(text, {
      status: backendResponse.status,
      headers: responseHeaders,
    })

  } catch (error) {
    console.error(`[API Proxy] ${method} error:`, error)

    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { error: 'Cannot connect to backend server' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
