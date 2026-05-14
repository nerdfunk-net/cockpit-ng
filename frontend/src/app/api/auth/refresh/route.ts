import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')

    // Forward the request to the backend
    const backendResponse = await fetch(`${BACKEND_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { Authorization: authHeader }),
      },
    })

    // Get the response data
    const responseData = await backendResponse.json()

    if (!backendResponse.ok) {
      return NextResponse.json(responseData, { status: backendResponse.status })
    }

    // Return the successful response
    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('Frontend API refresh error:', error)

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
