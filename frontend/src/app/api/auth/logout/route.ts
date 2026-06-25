import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'
const AUTH_COOKIE = 'cockpit_auth_token'

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE)?.value

  try {
    if (token) {
      await fetch(`${BACKEND_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }).catch(() => {}) // best-effort audit log
    }
  } catch (error) {
    console.error('Frontend API logout error:', error)
  }

  const res = NextResponse.json({ message: 'Logged out successfully' }, { status: 200 })
  res.cookies.delete(AUTH_COOKIE)
  return res
}
