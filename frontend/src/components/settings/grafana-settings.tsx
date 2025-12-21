'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useApi } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import { Loader2, CheckCircle, XCircle, BarChart3, Settings as SettingsIcon, AlertCircle } from 'lucide-react'

interface GrafanaSettings {
  deployment_method: 'local' | 'sftp' | 'git'
  local_root_path: string
  sftp_hostname: string
  sftp_port: number
  sftp_path: string
  sftp_username: string
  sftp_password: string
  use_global_credentials: boolean
  global_credential_id: number | null
  git_repository_id: number | null
  dashboards_path: string
  datasources_path: string
  telegraf_config_path: string
}

interface ApiResponse {
  success: boolean
  data?: GrafanaSettings
  message?: string
}

interface Credential {
  id: number
  name: string
  username: string
  type: string
  valid_until: string | null
  is_active: boolean
  source: string
  owner: string | null
  created_at: string
  updated_at: string
  status: string
  has_password: boolean
  has_ssh_key: boolean
  has_ssh_passphrase: boolean
}

interface CredentialsResponse {
  success: boolean
  data?: Credential[]
}

type StatusType = 'idle' | 'testing' | 'success' | 'error' | 'saving'

export default function GrafanaSettingsForm() {
  const { apiCall } = useApi()
  const [settings, setSettings] = useState<GrafanaSettings>({
    deployment_method: 'local',
    local_root_path: '',
    sftp_hostname: '',
    sftp_port: 22,
    sftp_path: '',
    sftp_username: '',
    sftp_password: '',
    use_global_credentials: false,
    global_credential_id: null,
    git_repository_id: null,
    dashboards_path: 'dashboards/',
    datasources_path: 'datasources/',
    telegraf_config_path: 'telegraf/',
  })

  const [status, setStatus] = useState<StatusType>('idle')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('connection')
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [loadingCredentials, setLoadingCredentials] = useState(false)

  const showMessage = useCallback((msg: string, type: 'success' | 'error') => {
    setMessage(msg)
    setStatus(type === 'success' ? 'success' : 'error')

    setTimeout(() => {
      setMessage('')
      setStatus('idle')
    }, 5000)
  }, [])

  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true)
      const data: ApiResponse = await apiCall('settings/grafana')
      if (data.success && data.data) {
        setSettings(data.data)
      }
    } catch (error) {
      console.error('Error loading Grafana settings:', error)
      showMessage('Failed to load settings', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [apiCall, showMessage])

  const loadCredentials = useCallback(async () => {
    try {
      setLoadingCredentials(true)
      const data = await apiCall('credentials') as Credential[] | CredentialsResponse

      // Handle both array and object response formats
      let allCredentials: Credential[] = []
      if (Array.isArray(data)) {
        allCredentials = data
      } else if (data && 'data' in data && data.data) {
        allCredentials = data.data
      }

      // Filter for active credentials with SSH or SSH key type (for SFTP)
      const filteredCredentials = allCredentials.filter(cred =>
        cred.is_active &&
        cred.status === 'active' &&
        (cred.type === 'ssh' || cred.type === 'ssh_key')
      )

      setCredentials(filteredCredentials)
    } catch (error) {
      console.error('Error loading credentials:', error)
      showMessage('Failed to load credentials', 'error')
    } finally {
      setLoadingCredentials(false)
    }
  }, [apiCall, showMessage])

  const testConnection = useCallback(async () => {
    try {
      setStatus('testing')

      const testData = {
        deployment_method: settings.deployment_method,
        local_root_path: settings.local_root_path,
        sftp_hostname: settings.sftp_hostname,
        sftp_port: settings.sftp_port,
        sftp_path: settings.sftp_path,
        sftp_username: settings.sftp_username,
        sftp_password: settings.sftp_password,
        git_repository_id: settings.git_repository_id,
      }

      const response = await apiCall('settings/test/grafana', {
        method: 'POST',
        body: JSON.stringify(testData),
      }) as { success?: boolean; message?: string }

      if (response.success) {
        showMessage(response.message || 'Connection test successful', 'success')
      } else {
        showMessage(response.message || 'Connection test failed', 'error')
      }
    } catch (error) {
      console.error('Error testing connection:', error)
      showMessage('Failed to test connection', 'error')
    }
  }, [apiCall, settings, showMessage])

  const saveSettings = useCallback(async () => {
    try {
      setStatus('saving')

      const response = await apiCall('settings/grafana', {
        method: 'POST',
        body: JSON.stringify(settings),
      }) as ApiResponse

      if (response.success) {
        showMessage('Settings saved successfully', 'success')
        if (response.data) {
          setSettings(response.data)
        }
      } else {
        showMessage(response.message || 'Failed to save settings', 'error')
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      showMessage('Failed to save settings', 'error')
    }
  }, [apiCall, settings, showMessage])

  const updateSetting = useCallback(<K extends keyof GrafanaSettings>(
    key: K,
    value: GrafanaSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  useEffect(() => {
    if (settings.deployment_method === 'sftp' && credentials.length === 0) {
      loadCredentials()
    }
  }, [settings.deployment_method, credentials.length, loadCredentials])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <BarChart3 className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Grafana Settings</h1>
            <p className="text-muted-foreground">
              Configure Grafana deployment method and paths
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={cn(
            'flex items-center gap-2 p-4 rounded-md',
            status === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          )}
        >
          {status === 'success' ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <XCircle className="h-5 w-5" />
          )}
          <span>{message}</span>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="connection" className="flex items-center space-x-2">
            <SettingsIcon className="h-4 w-4" />
            <span>Connection</span>
          </TabsTrigger>
          <TabsTrigger value="telegraf" disabled className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4" />
            <span>Telegraf (Coming Soon)</span>
          </TabsTrigger>
          <TabsTrigger value="grafana" disabled className="flex items-center space-x-2">
            <BarChart3 className="h-4 w-4" />
            <span>Grafana (Coming Soon)</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connection" className="space-y-6">
          <Card className="shadow-lg border-0 overflow-hidden p-0">
            <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-4">
              <CardTitle className="flex items-center space-x-2 text-sm font-medium">
                <SettingsIcon className="h-4 w-4" />
                <span>Deployment Configuration</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-6">
              {/* Deployment Method */}
              <div className="space-y-2">
                <Label htmlFor="deployment-method" className="text-sm font-medium text-gray-700">
                  Deployment Method <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={settings.deployment_method}
                  onValueChange={(value: 'local' | 'sftp' | 'git') => updateSetting('deployment_method', value)}
                >
                  <SelectTrigger id="deployment-method" className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Local File System</SelectItem>
                    <SelectItem value="sftp">SFTP</SelectItem>
                    <SelectItem value="git">Git Repository</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Choose how to deploy configuration files to Grafana
                </p>
              </div>

              {/* Local Deployment */}
              {settings.deployment_method === 'local' && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-md space-y-4">
                  <h3 className="font-semibold text-blue-900">Local File System</h3>
                  <div className="space-y-2">
                    <Label htmlFor="local-root-path" className="text-sm font-medium text-gray-700">
                      Root Path <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="local-root-path"
                      type="text"
                      placeholder="/etc/grafana/provisioning"
                      value={settings.local_root_path}
                      onChange={(e) => updateSetting('local_root_path', e.target.value)}
                      className="w-full border-blue-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                    <p className="text-xs text-blue-700">
                      Local directory path where Grafana configuration files will be stored
                    </p>
                  </div>
                </div>
              )}

              {/* SFTP Deployment */}
              {settings.deployment_method === 'sftp' && (
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-md space-y-4">
                  <h3 className="font-semibold text-purple-900">SFTP Configuration</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sftp-hostname" className="text-sm font-medium text-gray-700">
                        Hostname <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="sftp-hostname"
                        type="text"
                        placeholder="grafana.example.com"
                        value={settings.sftp_hostname}
                        onChange={(e) => updateSetting('sftp_hostname', e.target.value)}
                        className="w-full border-purple-300 focus:border-purple-500 focus:ring-purple-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sftp-port" className="text-sm font-medium text-gray-700">
                        Port
                      </Label>
                      <Input
                        id="sftp-port"
                        type="number"
                        placeholder="22"
                        value={settings.sftp_port}
                        onChange={(e) => updateSetting('sftp_port', parseInt(e.target.value) || 22)}
                        className="w-full border-purple-300 focus:border-purple-500 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sftp-path" className="text-sm font-medium text-gray-700">
                      Remote Path <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="sftp-path"
                      type="text"
                      placeholder="/etc/grafana/provisioning"
                      value={settings.sftp_path}
                      onChange={(e) => updateSetting('sftp_path', e.target.value)}
                      className="w-full border-purple-300 focus:border-purple-500 focus:ring-purple-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="credential-id" className="text-sm font-medium text-gray-700">
                      Credential <span className="text-red-500">*</span>
                    </Label>
                    {loadingCredentials ? (
                      <div className="flex items-center space-x-2 p-2 border border-purple-300 rounded-md">
                        <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                        <span className="text-sm text-gray-600">Loading credentials...</span>
                      </div>
                    ) : credentials.length > 0 ? (
                      <Select
                        value={settings.global_credential_id?.toString() || ''}
                        onValueChange={(value) => updateSetting('global_credential_id', parseInt(value) || null)}
                      >
                        <SelectTrigger id="credential-id" className="w-full border-purple-300 focus:border-purple-500 focus:ring-purple-500">
                          <SelectValue placeholder="Select a credential" />
                        </SelectTrigger>
                        <SelectContent>
                          {credentials.map((cred) => (
                            <SelectItem key={cred.id} value={cred.id.toString()}>
                              <div className="flex flex-col">
                                <span className="font-medium">{cred.name}</span>
                                <span className="text-xs text-gray-500">
                                  {cred.username} • {cred.type} • {cred.source === 'private' ? `Private (${cred.owner})` : 'Global'}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="p-3 border border-purple-200 rounded-md bg-purple-50">
                        <p className="text-sm text-purple-700">
                          No credentials configured. Go to Settings / Credentials to add one.
                        </p>
                      </div>
                    )}
                    <p className="text-xs text-purple-700">
                      Select a credential from Settings / Credentials to use for SFTP authentication
                    </p>
                  </div>
                </div>
              )}

              {/* Git Deployment */}
              {settings.deployment_method === 'git' && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-md space-y-4">
                  <h3 className="font-semibold text-green-900">Git Repository</h3>
                  <div className="space-y-2">
                    <Label htmlFor="git-repository-id" className="text-sm font-medium text-gray-700">
                      Git Repository ID <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="git-repository-id"
                      type="number"
                      placeholder="1"
                      value={settings.git_repository_id || ''}
                      onChange={(e) => updateSetting('git_repository_id', parseInt(e.target.value) || null)}
                      className="w-full border-green-300 focus:border-green-500 focus:ring-green-500"
                    />
                    <p className="text-xs text-green-700">
                      Select a configured Git repository from Settings / Git Management
                    </p>
                  </div>
                </div>
              )}

              {/* Common Paths */}
              <div className="pt-4 border-t border-gray-200 space-y-4">
                <h3 className="font-semibold text-gray-900">Configuration Paths</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dashboards-path" className="text-sm font-medium text-gray-700">
                      Dashboards Path
                    </Label>
                    <Input
                      id="dashboards-path"
                      type="text"
                      placeholder="dashboards/"
                      value={settings.dashboards_path}
                      onChange={(e) => updateSetting('dashboards_path', e.target.value)}
                      className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="datasources-path" className="text-sm font-medium text-gray-700">
                      Datasources Path
                    </Label>
                    <Input
                      id="datasources-path"
                      type="text"
                      placeholder="datasources/"
                      value={settings.datasources_path}
                      onChange={(e) => updateSetting('datasources_path', e.target.value)}
                      className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="telegraf-path" className="text-sm font-medium text-gray-700">
                      Telegraf Path
                    </Label>
                    <Input
                      id="telegraf-path"
                      type="text"
                      placeholder="telegraf/"
                      value={settings.telegraf_config_path}
                      onChange={(e) => updateSetting('telegraf_config_path', e.target.value)}
                      className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Relative paths within the deployment root for different configuration types
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={testConnection}
                  disabled={status === 'testing' || status === 'saving'}
                  className="flex items-center space-x-2"
                >
                  {status === 'testing' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  <span>Test Connection</span>
                </Button>
                <Button
                  type="button"
                  onClick={saveSettings}
                  disabled={status === 'testing' || status === 'saving'}
                  className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {status === 'saving' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <SettingsIcon className="h-4 w-4" />
                  )}
                  <span>Save Settings</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
