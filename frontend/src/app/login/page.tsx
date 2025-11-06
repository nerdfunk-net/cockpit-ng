'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/lib/auth-store'
import { Heart, AlertCircle, LogIn } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isOidcLoading, setIsOidcLoading] = useState(false)
  const [error, setError] = useState('')
  const [oidcEnabled, setOidcEnabled] = useState(false)
  const { login } = useAuthStore()
  const router = useRouter()

  // Check if OIDC is enabled
  useEffect(() => {
    const checkOidcEnabled = async () => {
      try {
        const response = await fetch('/api/proxy/auth/oidc/enabled')
        if (response.ok) {
          const data = await response.json()
          setOidcEnabled(data.enabled)
        }
      } catch (err) {
        console.error('Failed to check OIDC status:', err)
      }
    }
    checkOidcEnabled()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      // Use Next.js API route instead of direct backend call
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      console.log('Login response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json()
        console.log('Login error response:', errorData)

        if (response.status === 401) {
          throw new Error('Invalid username or password')
        } else if (response.status === 503) {
          throw new Error('Cannot connect to backend server. Is it running?')
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again later.')
        } else {
          throw new Error(errorData.error || `Login failed: ${response.status}`)
        }
      }

      const data = await response.json()
      console.log('Login successful:', data)

      if (data.access_token) {
        login(data.access_token, {
          id: data.user?.id?.toString() || '1',
          username: data.user?.username || username,
          email: data.user?.email,
          role: data.user?.role,
          permissions: data.user?.permissions,
        })
        router.push('/')
      } else {
        throw new Error('No access token received')
      }
    } catch (err) {
      console.error('Login error:', err)
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Cannot connect to server. Please check your connection.')
      } else {
        setError(err instanceof Error ? err.message : 'Login failed')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleOidcLogin = async () => {
    setIsOidcLoading(true)
    setError('')

    try {
      const response = await fetch('/api/proxy/auth/oidc/login')

      if (!response.ok) {
        throw new Error('Failed to initiate OIDC login')
      }

      const data = await response.json()

      if (data.authorization_url) {
        // Store state in sessionStorage for validation on callback
        if (data.state) {
          sessionStorage.setItem('oidc_state', data.state)
        }
        // Redirect to OIDC provider
        window.location.href = data.authorization_url
      } else {
        throw new Error('No authorization URL received')
      }
    } catch (err) {
      console.error('OIDC login error:', err)
      setError(err instanceof Error ? err.message : 'OIDC login failed')
      setIsOidcLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-apple-lg">
            <Heart className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Cockpit!</h1>
          <p className="text-gray-600">Network Management Dashboard</p>
        </div>

        {/* Login Form */}
        <Card className="glass backdrop-blur-xl border-white/20 shadow-apple-xl">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Sign In</CardTitle>
            <CardDescription className="text-center">
              Enter your credentials to access the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center space-x-2 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="h-11"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11"
                />
              </div>
              
              <Button
                type="submit"
                className={cn(
                  'w-full h-11 button-apple',
                  'bg-gradient-to-r from-green-500 to-green-600',
                  'hover:from-green-600 hover:to-green-700',
                  'text-white font-medium shadow-apple-lg'
                )}
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </div>
                ) : (
                  'Sign In'
                )}
              </Button>

              {oidcEnabled && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-gray-500">Or continue with</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11"
                    onClick={handleOidcLogin}
                    disabled={isOidcLoading}
                  >
                    {isOidcLoading ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                        <span>Redirecting...</span>
                      </div>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4 mr-2" />
                        Sign in with SSO
                      </>
                    )}
                  </Button>
                </>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>© 2025 Cockpit Network Management</p>
        </div>
      </div>
    </div>
  )
}
