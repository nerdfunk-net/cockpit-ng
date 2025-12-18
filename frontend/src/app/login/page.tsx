'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/lib/auth-store'
import { Heart, AlertCircle, LogIn, Building2, FlaskConical } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OIDCProvider {
  provider_id: string
  name: string
  description?: string
  icon?: string
  display_order: number
}

interface OIDCProvidersResponse {
  providers: OIDCProvider[]
  allow_traditional_login: boolean
}

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [oidcLoadingProvider, setOidcLoadingProvider] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [oidcProviders, setOidcProviders] = useState<OIDCProvider[]>([])
  const [allowTraditionalLogin, setAllowTraditionalLogin] = useState(true)
  const { login } = useAuthStore()
  const router = useRouter()

  // Fetch available OIDC providers
  useEffect(() => {
    const fetchOidcProviders = async () => {
      try {
        const response = await fetch('/api/proxy/auth/oidc/providers')
        if (response.ok) {
          const data: OIDCProvidersResponse = await response.json()
          setOidcProviders(data.providers || [])
          setAllowTraditionalLogin(data.allow_traditional_login)
        }
      } catch (err) {
        console.error('Failed to fetch OIDC providers:', err)
      }
    }
    fetchOidcProviders()
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
      console.log('='.repeat(80))
      console.log('LOGIN SUCCESS - FULL DATA:')
      console.log('='.repeat(80))
      console.log('Token:', data.access_token ? 'PRESENT' : 'MISSING')
      console.log('User object:', JSON.stringify(data.user, null, 2))
      console.log('User.roles specifically:', data.user?.roles)
      console.log('Type of roles:', typeof data.user?.roles, Array.isArray(data.user?.roles) ? 'ARRAY' : 'NOT ARRAY')
      console.log('='.repeat(80))

      // Store in sessionStorage so we can check it after redirect
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('last_login_data', JSON.stringify({
          timestamp: new Date().toISOString(),
          user: data.user,
          roles: data.user?.roles,
        }))
      }

      if (data.access_token) {
        login(data.access_token, {
          id: data.user?.id?.toString() || '1',
          username: data.user?.username || username,
          email: data.user?.email,
          roles: data.user?.roles || [],
          permissions: data.user?.permissions,
        })
        
        console.log('About to redirect to /')
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

  const handleOidcLogin = async (providerId: string) => {
    setOidcLoadingProvider(providerId)
    setError('')

    try {
      const response = await fetch(`/api/proxy/auth/oidc/${providerId}/login`)

      if (!response.ok) {
        throw new Error(`Failed to initiate OIDC login with ${providerId}`)
      }

      const data = await response.json()

      if (data.authorization_url) {
        // Store state in sessionStorage for validation on callback
        if (data.state) {
          sessionStorage.setItem('oidc_state', data.state)
        }
        // Store provider_id for callback
        if (data.provider_id) {
          sessionStorage.setItem('oidc_provider_id', data.provider_id)
        }
        // Redirect to OIDC provider
        window.location.href = data.authorization_url
      } else {
        throw new Error('No authorization URL received')
      }
    } catch (err) {
      console.error('OIDC login error:', err)
      setError(err instanceof Error ? err.message : 'OIDC login failed')
      setOidcLoadingProvider(null)
    }
  }

  // Helper to get icon for provider
  const getProviderIcon = (iconName?: string) => {
    switch (iconName) {
      case 'building':
        return <Building2 className="w-5 h-5" />
      case 'flask':
        return <FlaskConical className="w-5 h-5" />
      default:
        return <LogIn className="w-5 h-5" />
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
            {!allowTraditionalLogin && oidcProviders.length > 0 ? (
              // OIDC-only mode: Show only SSO options
              <div className="space-y-4">
                {error && (
                  <div className="flex items-center space-x-2 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                  </div>
                )}

                <p className="text-sm text-gray-600 text-center mb-4">
                  Choose your organization to sign in
                </p>

                {oidcProviders.map((provider) => (
                  <Button
                    key={provider.provider_id}
                    type="button"
                    variant="outline"
                    className="w-full h-14 flex items-center space-x-3"
                    onClick={() => handleOidcLogin(provider.provider_id)}
                    disabled={oidcLoadingProvider !== null}
                  >
                    {oidcLoadingProvider === provider.provider_id ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                        <span>Redirecting...</span>
                      </div>
                    ) : (
                      <>
                        {getProviderIcon(provider.icon)}
                        <div className="flex flex-col items-start text-left">
                          <span className="font-medium text-base">{provider.name}</span>
                          {provider.description && (
                            <span className="text-xs text-gray-500">{provider.description}</span>
                          )}
                        </div>
                      </>
                    )}
                  </Button>
                ))}
              </div>
            ) : (
              // Traditional login form with optional SSO buttons
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

              {oidcProviders.length > 0 && allowTraditionalLogin && (
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-gray-500">Or continue with</span>
                  </div>
                </div>
              )}

              {oidcProviders.map((provider) => (
                <Button
                  key={provider.provider_id}
                  type="button"
                  variant="outline"
                  className="w-full h-11 flex items-center justify-center space-x-2"
                  onClick={() => handleOidcLogin(provider.provider_id)}
                  disabled={oidcLoadingProvider !== null}
                >
                  {oidcLoadingProvider === provider.provider_id ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                      <span>Redirecting...</span>
                    </div>
                  ) : (
                    <>
                      {getProviderIcon(provider.icon)}
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{provider.name}</span>
                        {provider.description && (
                          <span className="text-xs text-gray-500">{provider.description}</span>
                        )}
                      </div>
                    </>
                  )}
                </Button>
              ))}
            </form>
            )}
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
