import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    
    console.log('Frontend API: Proxying logout request to backend...')
    
    // Forward the request to the backend
    const backendResponse = await fetch(`${BACKEND_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { Authorization: authHeader }),
      },
    })

    console.log('Backend logout response status:', backendResponse.status)

    if (!backendResponse.ok) {
      const responseData = await backendResponse.json()
      console.log('Backend logout error response:', responseData)
      return NextResponse.json(
        responseData,
        { status: backendResponse.status }
      )
    }

    console.log('Logout successful')

    // Return successful response - client will handle cookie cleanup
    return NextResponse.json(
      { message: 'Logged out successfully' },
      { status: 200 }
    )

  } catch (error) {
    console.error('Frontend API logout error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
