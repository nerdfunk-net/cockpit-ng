'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useApi } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import { Loader2, CheckCircle, XCircle, BarChart3, Settings as SettingsIcon } from 'lucide-react'

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

interface GitRepository {
  id: number
  name: string
  url: string
  category: string
  branch: string
  last_sync: string | null
}

interface GitRepositoriesResponse {
  repositories: GitRepository[]
  total: number
}

type StatusType = 'idle' | 'success' | 'error' | 'saving'

export default function TigStackSettingsForm() {
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
  const [gitRepositories, setGitRepositories] = useState<GitRepository[]>([])
  const [loadingGitRepos, setLoadingGitRepos] = useState(false)

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

  const loadGitRepositories = useCallback(async () => {
    try {
      setLoadingGitRepos(true)
      const response = await apiCall('git-repositories') as GitRepositoriesResponse

      if (response.repositories) {
        // Filter for Cockpit Configs category (case-insensitive)
        const cockpitRepos = response.repositories.filter(repo =>
          repo.category.toLowerCase() === 'cockpit_configs'
        )
        setGitRepositories(cockpitRepos)
      }
    } catch (error) {
      console.error('Error loading git repositories:', error)
      showMessage('Failed to load git repositories', 'error')
    } finally {
      setLoadingGitRepos(false)
    }
  }, [apiCall, showMessage])

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
    if (gitRepositories.length === 0) {
      loadGitRepositories()
    }
  }, [gitRepositories.length, loadGitRepositories])

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
            <h1 className="text-3xl font-bold">TIG-Stack Settings</h1>
            <p className="text-muted-foreground">
              Configure TIG-Stack (Telegraf, InfluxDB, Grafana) deployment and paths
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

      <Card className="shadow-lg border-0 overflow-hidden p-0">
            <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-4">
              <CardTitle className="flex items-center space-x-2 text-sm font-medium">
                <SettingsIcon className="h-4 w-4" />
                <span>Deployment Configuration</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-6">
              {/* Git Repository */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-md space-y-4">
                  <h3 className="font-semibold text-blue-900">Git Repository</h3>
                  <div className="space-y-2">
                    <Label htmlFor="git-repository-id" className="text-sm font-medium text-gray-700">
                      Git Repository <span className="text-red-500">*</span>
                    </Label>
                    {loadingGitRepos ? (
                      <div className="flex items-center space-x-2 p-2 border border-blue-300 rounded-md">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        <span className="text-sm text-gray-600">Loading repositories...</span>
                      </div>
                    ) : gitRepositories.length > 0 ? (
                      <Select
                        value={settings.git_repository_id?.toString() || ''}
                        onValueChange={(value) => updateSetting('git_repository_id', parseInt(value) || null)}
                      >
                        <SelectTrigger id="git-repository-id" className="w-full border-blue-300 focus:border-blue-500 focus:ring-blue-500">
                          <SelectValue placeholder="Select a repository" />
                        </SelectTrigger>
                        <SelectContent>
                          {gitRepositories.map((repo) => (
                            <SelectItem key={repo.id} value={repo.id.toString()}>
                              <div className="flex flex-col">
                                <span className="font-medium">{repo.name}</span>
                                <span className="text-xs text-gray-500">
                                  {repo.url} • {repo.branch}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="p-3 border border-blue-200 rounded-md bg-blue-50">
                        <p className="text-sm text-blue-700">
                          No Cockpit Configs repositories found. Go to Settings / Git Management to add one.
                        </p>
                      </div>
                    )}
                    <p className="text-xs text-blue-700">
                      Select a Cockpit Configs repository from Settings / Git Management
                    </p>
                  </div>
                </div>

              {/* Configuration Paths */}
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
              <div className="flex justify-end pt-4 border-t border-gray-200">
                <Button
                  type="button"
                  onClick={saveSettings}
                  disabled={status === 'saving'}
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
    </div>
  )
}
