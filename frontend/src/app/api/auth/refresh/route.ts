import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    
    console.log('Frontend API: Proxying refresh request to backend...')
    
    // Forward the request to the backend
    const backendResponse = await fetch(`${BACKEND_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { Authorization: authHeader }),
      },
    })

    console.log('Backend refresh response status:', backendResponse.status)

    // Get the response data
    const responseData = await backendResponse.json()
    
    if (!backendResponse.ok) {
      console.log('Backend refresh error response:', responseData)
      return NextResponse.json(
        responseData,
        { status: backendResponse.status }
      )
    }

    console.log('Token refresh successful')
    
    // Return the successful response
    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })

  } catch (error) {
    console.error('Frontend API refresh error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
