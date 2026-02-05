'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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

interface AgentsSettings {
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
}

interface ApiResponse {
  success: boolean
  data?: AgentsSettings
  message?: string
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

export default function AgentsSettingsForm() {
  const { apiCall } = useApi()
  const [settings, setSettings] = useState<AgentsSettings>({
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
      const data: ApiResponse = await apiCall('settings/agents')
      if (data.success && data.data) {
        setSettings(data.data)
      }
    } catch (error) {
      console.error('Error loading Agents settings:', error)
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

      const response = await apiCall('settings/agents', {
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

  const updateSetting = useCallback(<K extends keyof AgentsSettings>(
    key: K,
    value: AgentsSettings[K]
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
          <div className="bg-blue-100 p-3 rounded-lg">
            <BarChart3 className="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Agents Configuration</h1>
            <p className="text-muted-foreground">
              Configure external monitoring and observability agents
            </p>
          </div>
        </div>
      </div>

      {/* Information Card */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-6">
          <div className="space-y-3">
            <h3 className="font-semibold text-blue-900 flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              About Agents
            </h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              Agents are external applications used for monitoring, metrics collection, and observability. 
              Cockpit can manage configurations for applications like <strong>Grafana</strong>, <strong>Telegraf</strong>, 
              <strong>InfluxDB</strong>, and <strong>Smokeping</strong>.
            </p>
            <div className="bg-white/70 p-4 rounded-md border border-blue-200">
              <p className="text-sm text-gray-700 leading-relaxed">
                <strong>How it works:</strong> Cockpit renders configuration templates, commits them to a Git repository, 
                and then calls the agent to restart the Docker container running the application. This ensures 
                your monitoring stack stays synchronized with your network infrastructure.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {message && (
        <div
          className={cn(
            'flex items-center gap-2 p-4 rounded-md',
            status === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
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

      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <SettingsIcon className="h-4 w-4" />
            <span className="text-sm font-medium">Deployment Configuration</span>
          </div>
          <div className="text-xs text-blue-100">
            Configure agent repository settings
          </div>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-6">
          {/* Git Repository */}
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Git Repository</h3>
              <p className="text-sm text-muted-foreground">
                Select the repository where agent configurations will be stored
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="git-repository-id" className="text-sm font-medium text-gray-700">
                Configuration Repository <span className="text-red-500">*</span>
              </Label>
              {loadingGitRepos ? (
                <div className="flex items-center space-x-2 p-3 border border-gray-300 rounded-md bg-gray-50 max-w-2xl">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
                  <span className="text-sm text-gray-600">Loading repositories...</span>
                </div>
              ) : gitRepositories.length > 0 ? (
                <Select
                  value={settings.git_repository_id?.toString() || ''}
                  onValueChange={(value) => updateSetting('git_repository_id', parseInt(value) || null)}
                >
                  <SelectTrigger 
                    id="git-repository-id" 
                    className="max-w-2xl h-auto min-h-[44px] border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  >
                    <SelectValue placeholder="Select a repository" />
                  </SelectTrigger>
                  <SelectContent className="max-w-[600px]">
                    {gitRepositories.map((repo) => (
                      <SelectItem key={repo.id} value={repo.id.toString()} className="cursor-pointer">
                        <div className="flex flex-col py-1">
                          <span className="font-medium text-gray-900">{repo.name}</span>
                          <span className="text-xs text-gray-500 mt-0.5">
                            {repo.url} • branch: {repo.branch}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-4 border border-amber-200 rounded-md bg-amber-50 max-w-2xl">
                  <p className="text-sm text-amber-800">
                    <strong>No repositories found.</strong> Please add a Cockpit Configs repository in Settings → Git Management.
                  </p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Only repositories with category &quot;Cockpit Configs&quot; are shown
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end pt-4 border-t">
            <Button
              type="button"
              onClick={saveSettings}
              disabled={status === 'saving'}
              className="flex items-center gap-2"
            >
              {status === 'saving' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              <span>{status === 'saving' ? 'Saving...' : 'Save Configuration'}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
