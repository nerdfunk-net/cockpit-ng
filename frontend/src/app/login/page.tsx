'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/lib/auth-store'
import { Heart, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuthStore()
  const router = useRouter()

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
          id: data.user?.id || '1',
          username: data.user?.username || username,
          email: data.user?.email,
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
            </form>
            
            {/* Demo Credentials Info */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-700 font-medium mb-1">Demo Credentials:</p>
              <p className="text-xs text-blue-600">
                Username: <code className="bg-blue-100 px-1 rounded">admin</code> | 
                Password: <code className="bg-blue-100 px-1 rounded">admin</code>
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Or: <code className="bg-blue-100 px-1 rounded">guest/guest</code>
              </p>
            </div>
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
