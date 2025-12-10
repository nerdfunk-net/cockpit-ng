'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowLeft,
  Key,
  Code,
  FileText,
  RefreshCw,
  Copy,
  Check
} from 'lucide-react'
import Link from 'next/link'

interface TokenResponse {
  access_token?: string
  id_token?: string
  refresh_token?: string
  token_type?: string
  expires_in?: number
  scope?: string
}

interface DecodedToken {
  header: Record<string, unknown>
  payload: Record<string, unknown>
  signature: string
}

interface CallbackDebugInfo {
  query_params: Record<string, string>
  stored_state?: string
  state_match?: boolean
  token_response?: TokenResponse
  decoded_id_token?: DecodedToken
  decoded_access_token?: DecodedToken
  error?: string
}

function OIDCTestCallbackContent() {
  const searchParams = useSearchParams()
  const [debugInfo, setDebugInfo] = useState<CallbackDebugInfo>({ query_params: {} })
  const [loading, setLoading] = useState(true)
  const [exchangingToken, setExchangingToken] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  useEffect(() => {
    analyzeCallback()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const analyzeCallback = async () => {
    setLoading(true)

    // Collect all query parameters
    const params: Record<string, string> = {}
    searchParams.forEach((value, key) => {
      params[key] = value
    })

    // Get stored state from sessionStorage
    const storedState = sessionStorage.getItem('oidc_state')
    const stateMatch = storedState === params.state

    const info: CallbackDebugInfo = {
      query_params: params,
      stored_state: storedState || undefined,
      state_match: stateMatch,
    }

    // Check for error in callback
    if (params.error) {
      info.error = `${params.error}: ${params.error_description || 'No description provided'}`
    }

    setDebugInfo(info)
    setLoading(false)
  }

  const handleTokenExchange = async () => {
    setExchangingToken(true)

    try {
      const code = debugInfo.query_params.code
      const state = debugInfo.query_params.state
      const providerId = sessionStorage.getItem('oidc_provider_id')

      if (!code) {
        throw new Error('No authorization code found in callback')
      }

      if (!providerId) {
        throw new Error('No provider ID found in session storage')
      }

      // Build the redirect_uri that was used for the authorization request
      const redirectUri = `${window.location.origin}/login/oidc-test-callback`

      // Call the callback endpoint to exchange code for tokens
      const response = await fetch(`/api/proxy/auth/oidc/${providerId}/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          state,
          provider_id: providerId,
          redirect_uri: redirectUri,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `Token exchange failed: ${response.status}`)
      }

      const data = await response.json()

      // Decode JWT tokens for display
      const decodedIdToken = data.user ? undefined : decodeJWT(data.id_token)
      const decodedAccessToken = decodeJWT(data.access_token)

      setDebugInfo(prev => ({
        ...prev,
        token_response: {
          access_token: data.access_token,
          id_token: data.id_token,
          refresh_token: data.refresh_token,
          token_type: data.token_type,
          expires_in: data.expires_in,
          scope: data.scope,
        },
        decoded_id_token: decodedIdToken,
        decoded_access_token: decodedAccessToken,
      }))
    } catch (err) {
      setDebugInfo(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Token exchange failed',
      }))
    } finally {
      setExchangingToken(false)
    }
  }

  const decodeJWT = (token: string): DecodedToken | undefined => {
    if (!token) return undefined

    try {
      const parts = token.split('.')
      if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return undefined

      return {
        header: JSON.parse(atob(parts[0])),
        payload: JSON.parse(atob(parts[1])),
        signature: parts[2],
      }
    } catch {
      return undefined
    }
  }

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const renderJSON = (data: Record<string, unknown> | unknown, title: string) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => copyToClipboard(JSON.stringify(data, null, 2), title)}
          className="h-8"
        >
          {copiedField === title ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </Button>
      </div>
      <pre className="text-xs font-mono bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )

  const renderToken = (token: string | undefined, label: string) => {
    if (!token) return null

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-700">{label}</h4>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => copyToClipboard(token, label)}
            className="h-8"
          >
            {copiedField === label ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </Button>
        </div>
        <div className="text-xs font-mono bg-gray-900 text-yellow-400 p-4 rounded-lg overflow-x-auto break-all">
          {token}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-gray-600">Analyzing callback parameters...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Key className="w-8 h-8 text-blue-500" />
              OIDC Test Callback Debugger
            </h1>
            <p className="text-gray-600 mt-1">
              Inspect callback parameters and token exchange details
            </p>
          </div>
          <Link href="/oidc-test">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Test Dashboard
            </Button>
          </Link>
        </div>

        {/* Error Alert */}
        {debugInfo.error && (
          <Alert className="border-red-500 bg-red-50 text-red-900">
            <XCircle className="h-4 w-4 text-red-500" />
            <AlertDescription>
              <strong>Error:</strong> {debugInfo.error}
            </AlertDescription>
          </Alert>
        )}

        {/* Callback Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Callback Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-600">Authorization Code</span>
                {debugInfo.query_params.code ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Received
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="w-3 h-3" />
                    Missing
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-600">State Validation</span>
                {debugInfo.state_match ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Valid
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="w-3 h-3" />
                    Invalid
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-600">Callback Error</span>
                {debugInfo.query_params.error ? (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Error
                  </Badge>
                ) : (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Success
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Query Parameters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="w-5 h-5" />
              Query Parameters
            </CardTitle>
            <CardDescription>
              Parameters received from the OIDC provider callback
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(debugInfo.query_params).map(([key, value]) => (
              <div key={key} className="flex flex-col space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{key}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(value, key)}
                    className="h-6"
                  >
                    {copiedField === key ? (
                      <Check className="w-3 h-3 text-green-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                </div>
                <code className="text-xs font-mono bg-gray-100 p-2 rounded border border-gray-200 break-all">
                  {value}
                </code>
              </div>
            ))}

            {debugInfo.stored_state && (
              <div className="flex flex-col space-y-1 pt-3 border-t">
                <span className="text-sm font-medium text-gray-700">Stored State (Session)</span>
                <code className="text-xs font-mono bg-gray-100 p-2 rounded border border-gray-200 break-all">
                  {debugInfo.stored_state}
                </code>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Token Exchange */}
        {debugInfo.query_params.code && !debugInfo.token_response && !debugInfo.error && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Token Exchange
              </CardTitle>
              <CardDescription>
                Exchange the authorization code for access tokens
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleTokenExchange}
                disabled={exchangingToken}
                className="w-full gap-2"
              >
                {exchangingToken ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Exchanging Code for Tokens...
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4" />
                    Exchange Code for Tokens
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Token Response */}
        {debugInfo.token_response && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Token Exchange Response
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="tokens" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="tokens">Raw Tokens</TabsTrigger>
                  <TabsTrigger value="id-token">ID Token</TabsTrigger>
                  <TabsTrigger value="access-token">Access Token</TabsTrigger>
                </TabsList>

                <TabsContent value="tokens" className="space-y-4 mt-4">
                  {renderToken(debugInfo.token_response.access_token, 'Access Token')}
                  {renderToken(debugInfo.token_response.id_token, 'ID Token')}
                  {renderToken(debugInfo.token_response.refresh_token, 'Refresh Token')}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm font-medium text-gray-600">Token Type</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {debugInfo.token_response.token_type || 'N/A'}
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm font-medium text-gray-600">Expires In</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {debugInfo.token_response.expires_in ? `${debugInfo.token_response.expires_in}s` : 'N/A'}
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm font-medium text-gray-600">Scope</div>
                      <div className="text-sm font-mono text-gray-900">
                        {debugInfo.token_response.scope || 'N/A'}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="id-token" className="space-y-4 mt-4">
                  {debugInfo.decoded_id_token ? (
                    <>
                      {renderJSON(debugInfo.decoded_id_token.header, 'Header')}
                      {renderJSON(debugInfo.decoded_id_token.payload, 'Payload (Claims)')}
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-gray-700">Signature</h4>
                        <code className="text-xs font-mono bg-gray-900 text-red-400 p-4 rounded-lg block break-all">
                          {debugInfo.decoded_id_token.signature}
                        </code>
                      </div>
                    </>
                  ) : (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>No ID token available to decode</AlertDescription>
                    </Alert>
                  )}
                </TabsContent>

                <TabsContent value="access-token" className="space-y-4 mt-4">
                  {debugInfo.decoded_access_token ? (
                    <>
                      {renderJSON(debugInfo.decoded_access_token.header, 'Header')}
                      {renderJSON(debugInfo.decoded_access_token.payload, 'Payload (Claims)')}
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-gray-700">Signature</h4>
                        <code className="text-xs font-mono bg-gray-900 text-red-400 p-4 rounded-lg block break-all">
                          {debugInfo.decoded_access_token.signature}
                        </code>
                      </div>
                    </>
                  ) : (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>No access token available to decode</AlertDescription>
                    </Alert>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600">
            <p>To use this debug callback endpoint:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Configure your OIDC provider (e.g., Keycloak) with this callback URL</li>
              <li>
                <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                  {typeof window !== 'undefined' ? window.location.origin : ''}/login/oidc-test-callback
                </code>
              </li>
              <li>When testing with custom redirect_uri, use this URL</li>
              <li>All callback parameters and tokens will be displayed on this page</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function OIDCTestCallbackPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Loading OIDC Callback...</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>
    }>
      <OIDCTestCallbackContent />
    </Suspense>
  )
}
