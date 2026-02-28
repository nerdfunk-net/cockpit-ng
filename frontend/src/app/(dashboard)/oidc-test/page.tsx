'use client'

import { useState, useEffect, useCallback } from 'react'
import { useApi } from '@/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  Settings,
  Key,
  Shield,
  LogIn,
  RefreshCw,
  FileText,
  ExternalLink
} from 'lucide-react'
import { cn } from '@/lib/utils'


interface ProviderDebugInfo {
  provider_id: string
  name: string
  enabled: boolean
  config: {
    client_id?: string
    authorization_endpoint?: string
    token_endpoint?: string
    userinfo_endpoint?: string
    jwks_uri?: string
    issuer?: string
    ca_cert_path?: string
    ca_cert_exists?: boolean
    scopes?: string[]
    response_type?: string
  }
  status: 'ok' | 'warning' | 'error'
  issues: string[]
}

interface DebugResponse {
  oidc_enabled: boolean
  allow_traditional_login: boolean
  providers: ProviderDebugInfo[]
  global_config: {
    default_role?: string
    auto_create_users?: boolean
    update_user_info?: boolean
  }
  timestamp: string
}

interface DebugLog {
  timestamp: string
  level: 'info' | 'warning' | 'error' | 'success'
  message: string
  details?: Record<string, unknown>
}

export default function OIDCTestPage() {
  const { apiCall } = useApi()
  const [debugInfo, setDebugInfo] = useState<DebugResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<DebugLog[]>([])
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null)
  const [testingProvider, setTestingProvider] = useState<string | null>(null)

  // Test parameter overrides
  const [useCustomParams, setUseCustomParams] = useState(false)
  const [useDebugCallback, setUseDebugCallback] = useState(false)
  const [customRedirectUri, setCustomRedirectUri] = useState('')
  const [customScopes, setCustomScopes] = useState('')
  const [customResponseType, setCustomResponseType] = useState('')
  const [customClientId, setCustomClientId] = useState('')

  const addLog = useCallback((level: DebugLog['level'], message: string, details?: Record<string, unknown>) => {
    const log: DebugLog = {
      timestamp: new Date().toISOString(),
      level,
      message,
      details
    }
    setLogs(prev => [log, ...prev])
  }, [])

  const fetchDebugInfo = useCallback(async () => {
    setLoading(true)
    addLog('info', 'Fetching OIDC configuration and debug information...')

    try {
      const data = await apiCall<DebugResponse>('auth/oidc/debug')
      setDebugInfo(data)

      addLog('success', 'Successfully loaded OIDC configuration', {
        providers_count: data.providers.length,
        oidc_enabled: data.oidc_enabled
      })

      // Auto-select first provider
      if (data.providers.length > 0 && data.providers[0]) {
        setSelectedProvider(data.providers[0].provider_id)
      }
    } catch (err) {
      addLog('error', 'Failed to fetch debug information', { error: String(err) })
      console.error('Debug fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [apiCall, addLog])

  useEffect(() => {
    fetchDebugInfo()
  }, [fetchDebugInfo])

  const handleTestLogin = async (
    providerId: string,
    testOverrides?: {
      redirect_uri?: string
      scopes?: string[]
      response_type?: string
      client_id?: string
    }
  ) => {
    setTestingProvider(providerId)
    addLog('info', `Initiating test login for provider: ${providerId}`)

    if (testOverrides && Object.values(testOverrides).some(v => v)) {
      addLog('info', 'Using custom test parameters', testOverrides)
    }

    try {
      // Use test endpoint if overrides are provided
      const endpoint = testOverrides
        ? `/api/proxy/auth/oidc/${providerId}/test-login`
        : `/api/proxy/auth/oidc/${providerId}/login`

      const options = testOverrides
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testOverrides)
          }
        : { method: 'GET' }

      const response = await fetch(endpoint, options)

      if (!response.ok) {
        throw new Error(`Failed to initiate OIDC login: ${response.status}`)
      }

      const data = await response.json()

      addLog('success', 'Authorization URL generated', {
        provider_id: data.provider_id,
        test_mode: data.test_mode || false,
        state: data.state?.substring(0, 10) + '...'
      })

      if (data.test_mode && data.overrides) {
        addLog('info', 'Test overrides applied', data.overrides)
      }

      if (data.authorization_url) {
        addLog('info', 'Redirecting to OIDC provider...')

        // Store state for validation
        if (data.state) {
          sessionStorage.setItem('oidc_state', data.state)
        }
        if (data.provider_id) {
          sessionStorage.setItem('oidc_provider_id', data.provider_id)
        }

        // Redirect
        window.location.href = data.authorization_url
      }
    } catch (err) {
      addLog('error', 'Test login failed', { error: String(err) })
      setTestingProvider(null)
    }
  }

  const getStatusIcon = (status: 'ok' | 'warning' | 'error') => {
    switch (status) {
      case 'ok':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />
    }
  }

  const getLevelIcon = (level: DebugLog['level']) => {
    switch (level) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case 'info':
        return <Info className="w-4 h-4 text-blue-500" />
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />
    }
  }

  const selectedProviderInfo = debugInfo?.providers.find(
    p => p.provider_id === selectedProvider
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-gray-600">Loading OIDC configuration...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Shield className="w-8 h-8 text-blue-500" />
              OIDC Testing Dashboard
            </h1>
            <p className="text-gray-600 mt-1">
              Debug and test OpenID Connect authentication flows
            </p>
          </div>
          <Button onClick={fetchDebugInfo} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">OIDC Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {debugInfo?.oidc_enabled ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span className="text-2xl font-bold text-green-600">Enabled</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-red-500" />
                    <span className="text-2xl font-bold text-red-600">Disabled</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Providers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-500" />
                <span className="text-2xl font-bold text-gray-900">
                  {debugInfo?.providers.length || 0}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Traditional Login</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {debugInfo?.allow_traditional_login ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span className="text-2xl font-bold text-green-600">Allowed</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-gray-400" />
                    <span className="text-2xl font-bold text-gray-600">Disabled</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Provider List */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Providers
              </CardTitle>
              <CardDescription>
                Click to view configuration details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {debugInfo?.providers.map((provider) => (
                <button
                  key={provider.provider_id}
                  onClick={() => setSelectedProvider(provider.provider_id)}
                  className={cn(
                    'w-full p-3 rounded-lg border-2 text-left transition-all',
                    selectedProvider === provider.provider_id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900">{provider.name}</span>
                    {getStatusIcon(provider.status)}
                  </div>
                  <p className="text-xs text-gray-500">{provider.provider_id}</p>
                  {provider.issues.length > 0 && (
                    <Badge variant="destructive" className="mt-2 text-xs">
                      {provider.issues.length} issue(s)
                    </Badge>
                  )}
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Provider Details */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Configuration Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedProviderInfo ? (
                <Tabs defaultValue="config" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="config">Configuration</TabsTrigger>
                    <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
                    <TabsTrigger value="test">Test Login</TabsTrigger>
                  </TabsList>

                  <TabsContent value="config" className="space-y-4 mt-4">
                    {/* Issues */}
                    {selectedProviderInfo.issues.length > 0 && (
                      <Alert className="border-red-500 bg-red-50 text-red-900">
                        <AlertCircle className="h-4 w-4 text-red-500" />
                        <AlertDescription>
                          <div className="font-semibold mb-1">Configuration Issues:</div>
                          <ul className="list-disc list-inside space-y-1">
                            {selectedProviderInfo.issues.map((issue) => (
                              <li key={issue} className="text-sm">{issue}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Basic Info */}
                    <div className="space-y-3">
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-sm font-medium text-gray-600">Provider ID</span>
                        <span className="text-sm font-mono">{selectedProviderInfo.provider_id}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-sm font-medium text-gray-600">Name</span>
                        <span className="text-sm">{selectedProviderInfo.name}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-sm font-medium text-gray-600">Client ID</span>
                        <span className="text-sm font-mono">{selectedProviderInfo.config.client_id || 'Not configured'}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-sm font-medium text-gray-600">Issuer</span>
                        <span className="text-sm font-mono text-right max-w-sm truncate">
                          {selectedProviderInfo.config.issuer || 'Not configured'}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-sm font-medium text-gray-600">Scopes</span>
                        <span className="text-sm font-mono">
                          {selectedProviderInfo.config.scopes?.join(', ') || 'None'}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-sm font-medium text-gray-600">Response Type</span>
                        <span className="text-sm font-mono">{selectedProviderInfo.config.response_type || 'code'}</span>
                      </div>

                      {/* CA Certificate */}
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-sm font-medium text-gray-600">Custom CA Certificate</span>
                        <div className="flex items-center gap-2">
                          {selectedProviderInfo.config.ca_cert_path ? (
                            <>
                              {selectedProviderInfo.config.ca_cert_exists ? (
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-500" />
                              )}
                              <span className="text-sm font-mono">
                                {selectedProviderInfo.config.ca_cert_exists ? 'Configured' : 'File not found'}
                              </span>
                            </>
                          ) : (
                            <span className="text-sm text-gray-500">Not configured</span>
                          )}
                        </div>
                      </div>
                      {selectedProviderInfo.config.ca_cert_path && (
                        <div className="text-xs font-mono text-gray-500 pl-4">
                          {selectedProviderInfo.config.ca_cert_path}
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="endpoints" className="space-y-3 mt-4">
                    {[
                      { label: 'Authorization', url: selectedProviderInfo.config.authorization_endpoint },
                      { label: 'Token', url: selectedProviderInfo.config.token_endpoint },
                      { label: 'UserInfo', url: selectedProviderInfo.config.userinfo_endpoint },
                      { label: 'JWKS', url: selectedProviderInfo.config.jwks_uri },
                    ].map(({ label, url }) => (
                      <div key={label} className="space-y-1">
                        <div className="text-sm font-medium text-gray-600">{label} Endpoint</div>
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm font-mono text-blue-600 hover:text-blue-700 break-all p-2 bg-blue-50 rounded border border-blue-200"
                          >
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            {url}
                          </a>
                        ) : (
                          <div className="text-sm text-gray-400 italic p-2 bg-gray-50 rounded">
                            Not configured
                          </div>
                        )}
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="test" className="space-y-4 mt-4">
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        This will redirect you to the OIDC provider for authentication.
                        Make sure your callback URL is properly configured.
                      </AlertDescription>
                    </Alert>

                    {/* Debug Callback Toggle */}
                    <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <Checkbox
                        id="use-debug-callback"
                        checked={useDebugCallback}
                        onCheckedChange={(checked) => setUseDebugCallback(checked as boolean)}
                      />
                      <Label
                        htmlFor="use-debug-callback"
                        className="text-sm font-medium cursor-pointer"
                      >
                        Use /login/oidc-test-callback for detailed debugging
                      </Label>
                    </div>

                    {/* Custom Parameters Toggle */}
                    <div className="flex items-center space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <Checkbox
                        id="use-custom-params"
                        checked={useCustomParams}
                        onCheckedChange={(checked) => setUseCustomParams(checked as boolean)}
                      />
                      <Label
                        htmlFor="use-custom-params"
                        className="text-sm font-medium cursor-pointer"
                      >
                        Override default parameters for testing
                      </Label>
                    </div>

                    {/* Custom Parameters Form */}
                    {useCustomParams && (
                      <div className="space-y-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <div className="space-y-2">
                          <Label htmlFor="custom-client-id" className="text-sm font-medium">
                            Client ID
                          </Label>
                          <Input
                            id="custom-client-id"
                            type="text"
                            placeholder={selectedProviderInfo.config.client_id || 'Enter custom client ID'}
                            value={customClientId}
                            onChange={(e) => setCustomClientId(e.target.value)}
                            className="font-mono text-sm"
                          />
                          <p className="text-xs text-gray-500">
                            Leave empty to use default: {selectedProviderInfo.config.client_id}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="custom-scopes" className="text-sm font-medium">
                            Scopes (space-separated)
                          </Label>
                          <Input
                            id="custom-scopes"
                            type="text"
                            placeholder={selectedProviderInfo.config.scopes?.join(' ') || 'openid profile email'}
                            value={customScopes}
                            onChange={(e) => setCustomScopes(e.target.value)}
                            className="font-mono text-sm"
                          />
                          <p className="text-xs text-gray-500">
                            Default: {selectedProviderInfo.config.scopes?.join(' ') || 'openid profile email'}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="custom-response-type" className="text-sm font-medium">
                            Response Type
                          </Label>
                          <Input
                            id="custom-response-type"
                            type="text"
                            placeholder="code"
                            value={customResponseType}
                            onChange={(e) => setCustomResponseType(e.target.value)}
                            className="font-mono text-sm"
                          />
                          <p className="text-xs text-gray-500">
                            Default: code
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="custom-redirect-uri" className="text-sm font-medium">
                            Redirect URI
                          </Label>
                          <Input
                            id="custom-redirect-uri"
                            type="text"
                            placeholder="http://localhost:3000/login/callback"
                            value={customRedirectUri}
                            onChange={(e) => setCustomRedirectUri(e.target.value)}
                            className="font-mono text-sm"
                          />
                          <p className="text-xs text-gray-500">
                            Leave empty to use system default
                          </p>
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={() => {
                        // Build overrides object
                        const overrides: Record<string, unknown> = {}

                        // If debug callback is enabled, set redirect_uri
                        if (useDebugCallback) {
                          const debugCallbackUrl = `${window.location.origin}/login/oidc-test-callback`
                          overrides.redirect_uri = debugCallbackUrl
                        }

                        // If custom params are enabled, add those overrides
                        if (useCustomParams) {
                          if (customClientId) overrides.client_id = customClientId
                          if (customScopes) overrides.scopes = customScopes.split(' ').filter(s => s)
                          if (customResponseType) overrides.response_type = customResponseType
                          // Only override redirect_uri if not already set by debug callback and user provided one
                          if (customRedirectUri && !useDebugCallback) overrides.redirect_uri = customRedirectUri
                        }

                        // Call with overrides if any are set
                        if (Object.keys(overrides).length > 0) {
                          handleTestLogin(selectedProviderInfo.provider_id, overrides)
                        } else {
                          handleTestLogin(selectedProviderInfo.provider_id)
                        }
                      }}
                      disabled={testingProvider !== null || selectedProviderInfo.status === 'error'}
                      className="w-full gap-2"
                    >
                      {testingProvider === selectedProviderInfo.provider_id ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Redirecting...
                        </>
                      ) : (
                        <>
                          <LogIn className="w-4 h-4" />
                          {useDebugCallback || useCustomParams ? 'Test with Custom Parameters' : `Test Login with ${selectedProviderInfo.name}`}
                        </>
                      )}
                    </Button>

                    {selectedProviderInfo.status === 'error' && (
                      <p className="text-sm text-red-600 text-center">
                        Fix configuration issues before testing
                      </p>
                    )}
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  Select a provider to view details
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Global Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Global Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-600">Auto-create Users</span>
                <Badge variant={debugInfo?.global_config.auto_create_users ? "default" : "secondary"}>
                  {debugInfo?.global_config.auto_create_users ? 'Yes' : 'No'}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-600">Update User Info</span>
                <Badge variant={debugInfo?.global_config.update_user_info ? "default" : "secondary"}>
                  {debugInfo?.global_config.update_user_info ? 'Yes' : 'No'}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-600">Default Role</span>
                <Badge variant="outline">
                  {debugInfo?.global_config.default_role || 'user'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Debug Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Debug Logs
            </CardTitle>
            <CardDescription>
              Real-time authentication flow events
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.map((log) => (
                <div
                  key={`${log.timestamp}-${log.message}-${log.level}`}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  {getLevelIcon(log.level)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">{log.message}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    {log.details && (
                      <pre className="text-xs text-gray-600 font-mono bg-white p-2 rounded overflow-x-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
              {logs.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No logs yet. Interact with the page to see debug information.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
