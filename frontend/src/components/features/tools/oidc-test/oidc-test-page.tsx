'use client'

import { useState, useEffect, useCallback } from 'react'
import { useApi } from '@/hooks/use-api'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  XCircle,
  AlertCircle,
  Info,
  Settings,
  Key,
  Shield,
  LogIn,
  RefreshCw,
  FileText,
  ExternalLink,
  ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { IconChip } from '@/components/shared/icon-chip'
import { StatusIcon } from '@/components/shared/status-icon'
import type { StatusVariant } from '@/components/shared/status-badge'

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

const PROVIDER_STATUS_VARIANT: Record<ProviderDebugInfo['status'], StatusVariant> = {
  ok: 'success',
  warning: 'warning',
  error: 'error',
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

  const addLog = useCallback(
    (level: DebugLog['level'], message: string, details?: Record<string, unknown>) => {
      const log: DebugLog = {
        timestamp: new Date().toISOString(),
        level,
        message,
        details,
      }
      setLogs(prev => [log, ...prev])
    },
    []
  )

  const fetchDebugInfo = useCallback(async () => {
    setLoading(true)
    addLog('info', 'Fetching OIDC configuration and debug information...')

    try {
      const data = await apiCall<DebugResponse>('auth/oidc/debug')
      setDebugInfo(data)

      addLog('success', 'Successfully loaded OIDC configuration', {
        providers_count: data.providers.length,
        oidc_enabled: data.oidc_enabled,
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
            body: JSON.stringify(testOverrides),
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
        state: data.state?.substring(0, 10) + '...',
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

  const selectedProviderInfo = debugInfo?.providers.find(
    p => p.provider_id === selectedProvider
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading OIDC configuration...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/tools">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <IconChip variant="primary">
              <Shield className="h-6 w-6" />
            </IconChip>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                OIDC Testing Dashboard
              </h1>
              <p className="text-muted-foreground mt-2">
                Debug and test OpenID Connect authentication flows
              </p>
            </div>
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
              <CardTitle className="text-sm font-medium text-muted-foreground">
                OIDC Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {debugInfo?.oidc_enabled ? (
                  <>
                    <StatusIcon variant="success" className="w-5 h-5" />
                    <span className="text-2xl font-bold text-success-foreground">
                      Enabled
                    </span>
                  </>
                ) : (
                  <>
                    <StatusIcon variant="error" className="w-5 h-5" />
                    <span className="text-2xl font-bold text-error-foreground">
                      Disabled
                    </span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Providers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                <span className="text-2xl font-bold text-foreground">
                  {debugInfo?.providers.length || 0}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Traditional Login
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {debugInfo?.allow_traditional_login ? (
                  <>
                    <StatusIcon variant="success" className="w-5 h-5" />
                    <span className="text-2xl font-bold text-success-foreground">
                      Allowed
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-muted-foreground" />
                    <span className="text-2xl font-bold text-muted-foreground">
                      Disabled
                    </span>
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
              <CardDescription>Click to view configuration details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {debugInfo?.providers.map(provider => (
                <button
                  key={provider.provider_id}
                  onClick={() => setSelectedProvider(provider.provider_id)}
                  className={cn(
                    'w-full p-3 rounded-lg border-2 text-left transition-all',
                    selectedProvider === provider.provider_id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-muted bg-card'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-foreground">{provider.name}</span>
                    <StatusIcon
                      variant={PROVIDER_STATUS_VARIANT[provider.status]}
                      className="w-5 h-5"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{provider.provider_id}</p>
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
                      <Alert className="status-error">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <div className="font-semibold mb-1">
                            Configuration Issues:
                          </div>
                          <ul className="list-disc list-inside space-y-1">
                            {selectedProviderInfo.issues.map(issue => (
                              <li key={issue} className="text-sm">
                                {issue}
                              </li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Basic Info */}
                    <div className="space-y-3">
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-sm font-medium text-muted-foreground">
                          Provider ID
                        </span>
                        <span className="text-sm font-mono">
                          {selectedProviderInfo.provider_id}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-sm font-medium text-muted-foreground">Name</span>
                        <span className="text-sm">{selectedProviderInfo.name}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-sm font-medium text-muted-foreground">
                          Client ID
                        </span>
                        <span className="text-sm font-mono">
                          {selectedProviderInfo.config.client_id || 'Not configured'}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-sm font-medium text-muted-foreground">
                          Issuer
                        </span>
                        <span className="text-sm font-mono text-right max-w-sm truncate">
                          {selectedProviderInfo.config.issuer || 'Not configured'}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-sm font-medium text-muted-foreground">
                          Scopes
                        </span>
                        <span className="text-sm font-mono">
                          {selectedProviderInfo.config.scopes?.join(', ') || 'None'}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-sm font-medium text-muted-foreground">
                          Response Type
                        </span>
                        <span className="text-sm font-mono">
                          {selectedProviderInfo.config.response_type || 'code'}
                        </span>
                      </div>

                      {/* CA Certificate */}
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-sm font-medium text-muted-foreground">
                          Custom CA Certificate
                        </span>
                        <div className="flex items-center gap-2">
                          {selectedProviderInfo.config.ca_cert_path ? (
                            <>
                              <StatusIcon
                                variant={
                                  selectedProviderInfo.config.ca_cert_exists
                                    ? 'success'
                                    : 'error'
                                }
                                className="w-4 h-4"
                              />
                              <span className="text-sm font-mono">
                                {selectedProviderInfo.config.ca_cert_exists
                                  ? 'Configured'
                                  : 'File not found'}
                              </span>
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              Not configured
                            </span>
                          )}
                        </div>
                      </div>
                      {selectedProviderInfo.config.ca_cert_path && (
                        <div className="text-xs font-mono text-muted-foreground pl-4">
                          {selectedProviderInfo.config.ca_cert_path}
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="endpoints" className="space-y-3 mt-4">
                    {[
                      {
                        label: 'Authorization',
                        url: selectedProviderInfo.config.authorization_endpoint,
                      },
                      {
                        label: 'Token',
                        url: selectedProviderInfo.config.token_endpoint,
                      },
                      {
                        label: 'UserInfo',
                        url: selectedProviderInfo.config.userinfo_endpoint,
                      },
                      { label: 'JWKS', url: selectedProviderInfo.config.jwks_uri },
                    ].map(({ label, url }) => (
                      <div key={label} className="space-y-1">
                        <div className="text-sm font-medium text-muted-foreground">
                          {label} Endpoint
                        </div>
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm font-mono text-primary hover:opacity-80 break-all p-2 bg-info rounded border border-info-border"
                          >
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            {url}
                          </a>
                        ) : (
                          <div className="text-sm text-muted-foreground italic p-2 bg-muted rounded">
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
                    <div className="flex items-center space-x-2 p-3 bg-success border border-success-border rounded-lg">
                      <Checkbox
                        id="use-debug-callback"
                        checked={useDebugCallback}
                        onCheckedChange={checked =>
                          setUseDebugCallback(checked as boolean)
                        }
                      />
                      <Label
                        htmlFor="use-debug-callback"
                        className="text-sm font-medium cursor-pointer"
                      >
                        Use /login/oidc-test-callback for detailed debugging
                      </Label>
                    </div>

                    {/* Custom Parameters Toggle */}
                    <div className="flex items-center space-x-2 p-3 bg-info border border-info-border rounded-lg">
                      <Checkbox
                        id="use-custom-params"
                        checked={useCustomParams}
                        onCheckedChange={checked =>
                          setUseCustomParams(checked as boolean)
                        }
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
                      <div className="space-y-4 p-4 bg-muted border border-border rounded-lg">
                        <div className="space-y-2">
                          <Label
                            htmlFor="custom-client-id"
                            className="text-sm font-medium"
                          >
                            Client ID
                          </Label>
                          <Input
                            id="custom-client-id"
                            type="text"
                            placeholder={
                              selectedProviderInfo.config.client_id ||
                              'Enter custom client ID'
                            }
                            value={customClientId}
                            onChange={e => setCustomClientId(e.target.value)}
                            className="font-mono text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            Leave empty to use default:{' '}
                            {selectedProviderInfo.config.client_id}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label
                            htmlFor="custom-scopes"
                            className="text-sm font-medium"
                          >
                            Scopes (space-separated)
                          </Label>
                          <Input
                            id="custom-scopes"
                            type="text"
                            placeholder={
                              selectedProviderInfo.config.scopes?.join(' ') ||
                              'openid profile email'
                            }
                            value={customScopes}
                            onChange={e => setCustomScopes(e.target.value)}
                            className="font-mono text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            Default:{' '}
                            {selectedProviderInfo.config.scopes?.join(' ') ||
                              'openid profile email'}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label
                            htmlFor="custom-response-type"
                            className="text-sm font-medium"
                          >
                            Response Type
                          </Label>
                          <Input
                            id="custom-response-type"
                            type="text"
                            placeholder="code"
                            value={customResponseType}
                            onChange={e => setCustomResponseType(e.target.value)}
                            className="font-mono text-sm"
                          />
                          <p className="text-xs text-muted-foreground">Default: code</p>
                        </div>

                        <div className="space-y-2">
                          <Label
                            htmlFor="custom-redirect-uri"
                            className="text-sm font-medium"
                          >
                            Redirect URI
                          </Label>
                          <Input
                            id="custom-redirect-uri"
                            type="text"
                            placeholder="http://localhost:3000/login/callback"
                            value={customRedirectUri}
                            onChange={e => setCustomRedirectUri(e.target.value)}
                            className="font-mono text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
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
                          if (customScopes)
                            overrides.scopes = customScopes.split(' ').filter(s => s)
                          if (customResponseType)
                            overrides.response_type = customResponseType
                          // Only override redirect_uri if not already set by debug callback and user provided one
                          if (customRedirectUri && !useDebugCallback)
                            overrides.redirect_uri = customRedirectUri
                        }

                        // Call with overrides if any are set
                        if (Object.keys(overrides).length > 0) {
                          handleTestLogin(selectedProviderInfo.provider_id, overrides)
                        } else {
                          handleTestLogin(selectedProviderInfo.provider_id)
                        }
                      }}
                      disabled={
                        testingProvider !== null ||
                        selectedProviderInfo.status === 'error'
                      }
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
                          {useDebugCallback || useCustomParams
                            ? 'Test with Custom Parameters'
                            : `Test Login with ${selectedProviderInfo.name}`}
                        </>
                      )}
                    </Button>

                    {selectedProviderInfo.status === 'error' && (
                      <p className="text-sm text-destructive text-center">
                        Fix configuration issues before testing
                      </p>
                    )}
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
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
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium text-muted-foreground">
                  Auto-create Users
                </span>
                <Badge
                  variant={
                    debugInfo?.global_config.auto_create_users ? 'default' : 'secondary'
                  }
                >
                  {debugInfo?.global_config.auto_create_users ? 'Yes' : 'No'}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium text-muted-foreground">
                  Update User Info
                </span>
                <Badge
                  variant={
                    debugInfo?.global_config.update_user_info ? 'default' : 'secondary'
                  }
                >
                  {debugInfo?.global_config.update_user_info ? 'Yes' : 'No'}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium text-muted-foreground">Default Role</span>
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
            <CardDescription>Real-time authentication flow events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.map(log => (
                <div
                  key={`${log.timestamp}-${log.level}-${log.message}`}
                  className="flex items-start gap-3 p-3 bg-muted rounded-lg border border-border"
                >
                  <StatusIcon variant={log.level} className="w-4 h-4" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-foreground">
                        {log.message}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    {log.details && (
                      <pre className="text-xs text-muted-foreground font-mono bg-card p-2 rounded overflow-x-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
              {logs.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
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
