import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('Frontend API: Proxying login request to backend...')
    
    // Forward the request to the backend
    const backendResponse = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    console.log('Backend response status:', backendResponse.status)

    // Get the response data
    const responseData = await backendResponse.json()
    
    console.log('Backend response data:', JSON.stringify(responseData, null, 2))
    
    if (!backendResponse.ok) {
      console.log('Backend error response:', responseData)
      return NextResponse.json(
        responseData,
        { status: backendResponse.status }
      )
    }

    console.log('Login successful, returning response with enhanced security')

    // Return the successful response - let client handle cookies for now
    // This maintains compatibility with existing auth flow
    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })

  } catch (error) {
    console.error('Frontend API login error:', error)
    
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
