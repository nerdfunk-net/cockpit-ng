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

async function handleRequest(
  request: NextRequest,
  method: string,
  pathSegments: string[]
) {
  try {
    const path = pathSegments.join('/')
    const searchParams = request.nextUrl.searchParams.toString()
    
    // Handle auth endpoints differently - they don't use /api/ prefix
    let url: string
    if (path.startsWith('auth/')) {
      url = `${BACKEND_URL}/${path}${searchParams ? `?${searchParams}` : ''}`
    } else {
      url = `${BACKEND_URL}/api/${path}${searchParams ? `?${searchParams}` : ''}`
    }
    
    console.log(`Frontend API: Proxying ${method} request to:`, url)
    
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
      'x-forwarded-for'
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
    
    console.log(`Backend ${method} response status:`, backendResponse.status)
    
    // Get response content type
    const contentType = backendResponse.headers.get('content-type')
    
    // Handle different response types
    let responseData
    if (contentType?.includes('application/json')) {
      responseData = await backendResponse.json()
    } else {
      responseData = await backendResponse.text()
    }
    
    if (!backendResponse.ok) {
      console.log(`Backend ${method} error response:`, responseData)
      return NextResponse.json(
        typeof responseData === 'string' ? { error: responseData } : responseData,
        { status: backendResponse.status }
      )
    }
    
    // Return the successful response
    return NextResponse.json(responseData, {
      status: backendResponse.status,
      headers: {
        'Content-Type': 'application/json',
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
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
