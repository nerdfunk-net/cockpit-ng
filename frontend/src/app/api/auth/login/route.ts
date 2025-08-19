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
    
    if (!backendResponse.ok) {
      console.log('Backend error response:', responseData)
      return NextResponse.json(
        responseData,
        { status: backendResponse.status }
      )
    }

    console.log('Login successful, returning token to frontend')
    
    // Return the successful response
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
