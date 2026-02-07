'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/lib/auth-store'
import { Heart, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

function OIDCCallbackContent() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useAuthStore()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code')
        const state = searchParams.get('state')
        const errorParam = searchParams.get('error')
        const errorDescription = searchParams.get('error_description')

        // Check for OIDC provider errors
        if (errorParam) {
          throw new Error(errorDescription || errorParam)
        }

        if (!code) {
          throw new Error('No authorization code received')
        }

        // Validate state parameter if available
        const storedState = sessionStorage.getItem('oidc_state')
        if (storedState && state !== storedState) {
          throw new Error('Invalid state parameter - possible CSRF attack')
        }

        // Extract provider_id from state (format: "provider_id:random_state")
        let providerId = 'default'
        if (state && state.includes(':')) {
          const [extractedProviderId] = state.split(':', 2)
          providerId = extractedProviderId || 'default'
        } else {
          // Fallback: Try to get from sessionStorage
          const storedProviderId = sessionStorage.getItem('oidc_provider_id')
          if (storedProviderId) {
            providerId = storedProviderId
          }
        }

        // Clear stored state and provider_id
        sessionStorage.removeItem('oidc_state')
        sessionStorage.removeItem('oidc_provider_id')

        // Exchange code for tokens with provider-specific endpoint
        const response = await fetch(`/api/proxy/auth/oidc/${providerId}/callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code, state }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.detail || `Authentication failed with provider '${providerId}'`)
        }

        const data = await response.json()

        // Check if user is awaiting approval
        if (data.status === 'approval_pending') {
          // Redirect to approval pending page with user info
          const params = new URLSearchParams({
            username: data.username || '',
            email: data.email || '',
            provider: data.oidc_provider || providerId,
          })
          router.push(`/login/approval-pending?${params.toString()}`)
          return
        }

        if (data.access_token) {
          login(data.access_token, {
            id: data.user?.id?.toString() || '1',
            username: data.user?.username || 'unknown',
            email: data.user?.email,
            roles: data.user?.roles || [],
            permissions: data.user?.permissions,
          })

          setStatus('success')

          // Redirect to dashboard after brief delay
          setTimeout(() => {
            router.push('/')
          }, 1000)
        } else {
          throw new Error('No access token received')
        }
      } catch (err) {
        console.error('OIDC callback error:', err)
        setError(err instanceof Error ? err.message : 'Authentication failed')
        setStatus('error')
      }
    }

    handleCallback()
  }, [searchParams, login, router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-apple-lg">
            <Heart className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Cockpit</h1>
        </div>

        {/* Status Card */}
        <Card className="glass backdrop-blur-xl border-white/20 shadow-apple-xl">
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              {status === 'processing' && 'Authenticating...'}
              {status === 'success' && 'Success!'}
              {status === 'error' && 'Authentication Failed'}
            </CardTitle>
            <CardDescription className="text-center">
              {status === 'processing' && 'Please wait while we complete your sign-in'}
              {status === 'success' && 'Redirecting to dashboard...'}
              {status === 'error' && 'There was a problem signing you in'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {status === 'processing' && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
              </div>
            )}

            {status === 'success' && (
              <div className="flex justify-center py-8">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
              </div>
            )}

            {status === 'error' && (
              <>
                <div className="flex items-center space-x-2 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg mb-4">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
                <Button
                  className="w-full"
                  onClick={() => window.location.replace('/login')}
                >
                  Return to Login
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function OIDCCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-apple-lg">
              <Heart className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Cockpit</h1>
          </div>
          <Card className="glass backdrop-blur-xl border-white/20 shadow-apple-xl">
            <CardContent className="pt-6 pb-6">
              <div className="flex justify-center py-8">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    }>
      <OIDCCallbackContent />
    </Suspense>
  )
}
