'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useApi } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import { Loader2, CheckCircle, XCircle, Server, Settings, RotateCcw, Shield, FileText, AlertCircle } from 'lucide-react'

interface CheckMKSettings {
  url: string
  site: string
  username: string
  password: string
  verify_ssl: boolean
}

interface ApiResponse {
  success: boolean
  data?: CheckMKSettings
  message?: string
}

type StatusType = 'idle' | 'testing' | 'success' | 'error' | 'saving'

export default function CheckMKSettingsForm() {
  const { apiCall } = useApi()
  const [settings, setSettings] = useState<CheckMKSettings>({
    url: '',
    site: '',
    username: '',
    password: '',
    verify_ssl: true
  })
  
  const [status, setStatus] = useState<StatusType>('idle')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  
  // YAML content states
  const [checkmkYaml, setCheckmkYaml] = useState('')
  const [checkmkQueriesYaml, setCheckmkQueriesYaml] = useState('')
  const [yamlLoading, setYamlLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('connection')
  const [validating, setValidating] = useState(false)
  const [validationError, setValidationError] = useState<{
    message: string
    error?: string
    line?: number
    column?: number
  } | null>(null)
  const [showValidationDialog, setShowValidationDialog] = useState(false)

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
      const data: ApiResponse = await apiCall('settings/checkmk')
      if (data.success && data.data) {
        setSettings(data.data)
      }
    } catch (error) {
      console.error('Error loading CheckMK settings:', error)
      showMessage('Failed to load settings', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [apiCall, showMessage])

  const loadYamlFiles = useCallback(async () => {
    try {
      setYamlLoading(true)

      // Load files independently so one missing file doesn't break the other
      const [checkmkResponse, queriesResponse] = await Promise.allSettled([
        apiCall('config/checkmk.yaml'),
        apiCall('config/checkmk_queries.yaml')
      ])

      // Handle checkmk.yaml
      if (checkmkResponse.status === 'fulfilled') {
        const response = checkmkResponse.value as { success?: boolean; data?: string; message?: string }
        if (response.success && response.data) {
          setCheckmkYaml(response.data)
        } else {
          // File doesn't exist, set empty content
          setCheckmkYaml('')
          console.log('checkmk.yaml not found, using empty content')
        }
      } else {
        setCheckmkYaml('')
        console.warn('Failed to load checkmk.yaml:', checkmkResponse.reason)
      }

      // Handle checkmk_queries.yaml
      if (queriesResponse.status === 'fulfilled') {
        const response = queriesResponse.value as { success?: boolean; data?: string; message?: string }
        if (response.success && response.data) {
          setCheckmkQueriesYaml(response.data)
        } else {
          // File doesn't exist, set empty content
          setCheckmkQueriesYaml('')
          console.log('checkmk_queries.yaml not found, using empty content')
        }
      } else {
        setCheckmkQueriesYaml('')
        console.warn('Failed to load checkmk_queries.yaml:', queriesResponse.reason)
      }
    } catch (error) {
      console.error('Error loading YAML files:', error)
      showMessage('Failed to load YAML configuration files', 'error')
    } finally {
      setYamlLoading(false)
    }
  }, [apiCall, showMessage])

  // Load settings on component mount
  useEffect(() => {
    loadSettings()
    loadYamlFiles()
  }, [loadSettings, loadYamlFiles])

  const testConnection = async () => {
    setStatus('testing')
    setMessage('')
    
    try {
      const data: ApiResponse = await apiCall('settings/test/checkmk', {
        method: 'POST',
        body: settings
      })
      
      if (data.success) {
        setStatus('success')
        setMessage('Connection successful!')
      } else {
        setStatus('error')
        setMessage(data.message || 'Connection failed')
      }
    } catch (error) {
      setStatus('error')
      setMessage('Connection failed')
      console.error('Error testing connection:', error)
    }
    
    // Reset status after 5 seconds
    setTimeout(() => {
      setStatus('idle')
      setMessage('')
    }, 5000)
  }

  const saveSettings = async () => {
    setStatus('saving')
    setMessage('')
    
    try {
      const data: ApiResponse = await apiCall('settings/checkmk', {
        method: 'POST',
        body: settings
      })
      
      if (data.success) {
        showMessage('CheckMK settings saved successfully!', 'success')
      } else {
        showMessage(data.message || 'Failed to save settings', 'error')
      }
    } catch (error) {
      showMessage('Error saving settings', 'error')
      console.error('Error saving settings:', error)
    } finally {
      setStatus('idle')
    }
  }

  const resetSettings = () => {
    setSettings({
      url: '',
      site: '',
      username: '',
      password: '',
      verify_ssl: true
    })
    showMessage('Settings reset to defaults', 'success')
  }

  const updateSetting = (key: keyof CheckMKSettings, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const saveYamlFile = async (filename: 'checkmk.yaml' | 'snmp_mapping.yaml' | 'checkmk_queries.yaml', content: string) => {
    try {
      setYamlLoading(true)
      const response = await apiCall(`config/${filename}`, {
        method: 'POST',
        body: { content }
      }) as { success?: boolean; message?: string }
      
      if (response.success) {
        showMessage(`${filename} saved successfully!`, 'success')
      } else {
        showMessage(response.message || `Failed to save ${filename}`, 'error')
      }
    } catch (error) {
      console.error(`Error saving ${filename}:`, error)
      showMessage(`Error saving ${filename}`, 'error')
    } finally {
      setYamlLoading(false)
    }
  }

  const validateYaml = async (content: string, filename: string) => {
    try {
      setValidating(true)
      const response = await apiCall('config/validate', {
        method: 'POST',
        body: { content }
      }) as { success?: boolean; valid?: boolean; message?: string; error?: string; line?: number; column?: number }
      
      if (response.success && response.valid) {
        showMessage(`${filename} is valid YAML!`, 'success')
        setValidationError(null)
      } else if (response.success && !response.valid) {
        // Show validation error in dialog
        setValidationError({
          message: response.message || 'YAML syntax error',
          error: response.error,
          line: response.line,
          column: response.column
        })
        setShowValidationDialog(true)
      } else {
        showMessage(response.message || 'Validation failed', 'error')
      }
    } catch (error) {
      console.error(`Error validating ${filename}:`, error)
      showMessage(`Error validating ${filename}`, 'error')
    } finally {
      setValidating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading settings...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Shield className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">CheckMK Settings</h1>
            <p className="text-gray-600">Configure your CheckMK server connection and configuration files</p>
          </div>
        </div>
      </div>

      {/* Status Message */}
      {message && (
        <div className={cn(
          "p-4 rounded-lg border flex items-center space-x-2",
          status === 'success' && "bg-green-50 border-green-200 text-green-800",
          status === 'error' && "bg-red-50 border-red-200 text-red-800"
        )}>
          {status === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
          {status === 'error' && <XCircle className="h-5 w-5 text-red-500" />}
          <span className="font-medium">{message}</span>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="connection" className="flex items-center space-x-2">
            <Settings className="h-4 w-4" />
            <span>Connection</span>
          </TabsTrigger>
          <TabsTrigger value="checkmk-config" className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span>CheckMK Config</span>
          </TabsTrigger>
          <TabsTrigger value="queries" className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span>Queries</span>
          </TabsTrigger>
        </TabsList>

        {/* Connection Settings Tab */}
        <TabsContent value="connection" className="space-y-6">
          <Card className="shadow-lg border-0 overflow-hidden p-0">
            <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-4">
              <CardTitle className="flex items-center space-x-2 text-sm font-medium">
                <Settings className="h-4 w-4" />
                <span>CheckMK Connection Settings</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* CheckMK URL */}
                <div className="space-y-2">
                  <Label htmlFor="checkmk-url" className="text-sm font-medium text-gray-700">
                    CheckMK Server URL <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="checkmk-url"
                    type="url"
                    placeholder="https://checkmk.example.com"
                    value={settings.url}
                    onChange={(e) => updateSetting('url', e.target.value)}
                    required
                    className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500">
                    The base URL of your CheckMK instance
                  </p>
                </div>

                {/* Site */}
                <div className="space-y-2">
                  <Label htmlFor="checkmk-site" className="text-sm font-medium text-gray-700">
                    Site <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="checkmk-site"
                    type="text"
                    placeholder="Enter your CheckMK site name (e.g., 'cmk')"
                    value={settings.site}
                    onChange={(e) => updateSetting('site', e.target.value)}
                    required
                    className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500">
                    The CheckMK site name (usually &apos;cmk&apos; for default installations)
                  </p>
                </div>

                {/* Username */}
                <div className="space-y-2">
                  <Label htmlFor="checkmk-username" className="text-sm font-medium text-gray-700">
                    Username <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="checkmk-username"
                    type="text"
                    placeholder="Enter your CheckMK username"
                    value={settings.username}
                    onChange={(e) => updateSetting('username', e.target.value)}
                    required
                    className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500">
                    Your CheckMK login username
                  </p>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="checkmk-password" className="text-sm font-medium text-gray-700">
                    Password <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="checkmk-password"
                    type="password"
                    placeholder="Enter your CheckMK password"
                    value={settings.password}
                    onChange={(e) => updateSetting('password', e.target.value)}
                    required
                    className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500">
                    Your CheckMK login password or API key
                  </p>
                </div>

                {/* SSL Verification */}
                <div className="space-y-2">
                  <Label htmlFor="checkmk-ssl" className="text-sm font-medium text-gray-700">
                    SSL Verification
                  </Label>
                  <div className="flex items-center space-x-2 p-3 bg-white rounded-lg border border-gray-200">
                    <Checkbox
                      id="checkmk-ssl"
                      checked={settings.verify_ssl}
                      onCheckedChange={(checked) => updateSetting('verify_ssl', !!checked)}
                      className="border-gray-300"
                    />
                    <Label htmlFor="checkmk-ssl" className="text-sm text-gray-700">
                      Verify SSL certificates
                    </Label>
                  </div>
                  <p className="text-xs text-gray-500">
                    Uncheck only for development environments
                  </p>
                </div>
              </div>

              {/* Test Connection Button */}
              <div className="pt-4 border-t border-gray-200">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={testConnection}
                        disabled={status === 'testing' || !settings.url || !settings.site || !settings.username || !settings.password}
                        className="flex items-center space-x-2 border-blue-300 text-blue-700 hover:bg-blue-100"
                      >
                        {status === 'testing' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Server className="h-4 w-4" />
                        )}
                        <span>{status === 'testing' ? 'Testing...' : 'Test Connection'}</span>
                      </Button>
                      
                      {/* Connection Status */}
                      {status === 'success' && (
                        <div className="flex items-center space-x-2 text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-sm font-medium">Connection successful!</span>
                        </div>
                      )}
                      
                      {status === 'error' && message && (
                        <div className="flex items-center space-x-2 text-red-600">
                          <XCircle className="h-4 w-4" />
                          <span className="text-sm font-medium">{message}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-blue-600 font-medium">
                      Test your connection before saving
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons for Connection */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={resetSettings}
                className="flex items-center space-x-2 border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reset to Defaults</span>
              </Button>
              
              <Button
                type="button"
                onClick={saveSettings}
                disabled={status === 'saving' || !settings.url || !settings.site || !settings.username || !settings.password}
                className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2 text-base font-medium"
              >
                {status === 'saving' && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>{status === 'saving' ? 'Saving...' : 'Save Settings'}</span>
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* CheckMK Configuration Tab */}
        <TabsContent value="checkmk-config" className="space-y-6">
          <Card className="shadow-lg border-0 overflow-hidden p-0">
            <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-4">
              <CardTitle className="flex items-center space-x-2 text-sm font-medium">
                <FileText className="h-4 w-4" />
                <span>CheckMK Configuration (checkmk.yaml)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Configuration Content</Label>
                <Textarea
                  value={checkmkYaml}
                  onChange={(e) => setCheckmkYaml(e.target.value)}
                  placeholder="YAML content will be loaded here..."
                  className="w-full h-96 font-mono text-sm border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500">
                  Edit the CheckMK configuration YAML file. This controls site mapping, folder structure, and host tag groups.
                </p>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={loadYamlFiles}
                  disabled={yamlLoading || validating}
                  className="flex items-center space-x-2"
                >
                  {yamlLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  <span>Reload</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => validateYaml(checkmkYaml, 'checkmk.yaml')}
                  disabled={yamlLoading || validating || !checkmkYaml}
                  className="flex items-center space-x-2"
                >
                  {validating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  <span>Check YAML</span>
                </Button>
                <Button
                  type="button"
                  onClick={() => saveYamlFile('checkmk.yaml', checkmkYaml)}
                  disabled={yamlLoading || validating}
                  className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  {yamlLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  <span>Save Configuration</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Queries Tab */}
        <TabsContent value="queries" className="space-y-6">
          <Card className="shadow-lg border-0 overflow-hidden p-0">
            <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-4">
              <CardTitle className="flex items-center space-x-2 text-sm font-medium">
                <FileText className="h-4 w-4" />
                <span>CheckMK Queries Configuration (checkmk_queries.yaml)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Queries Content</Label>
                <Textarea
                  value={checkmkQueriesYaml}
                  onChange={(e) => setCheckmkQueriesYaml(e.target.value)}
                  placeholder="YAML content will be loaded here..."
                  className="w-full h-96 font-mono text-sm border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500">
                  Edit the CheckMK queries configuration YAML file. This defines custom queries and filters for CheckMK.
                </p>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={loadYamlFiles}
                  disabled={yamlLoading || validating}
                  className="flex items-center space-x-2"
                >
                  {yamlLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  <span>Reload</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => validateYaml(checkmkQueriesYaml, 'checkmk_queries.yaml')}
                  disabled={yamlLoading || validating || !checkmkQueriesYaml}
                  className="flex items-center space-x-2"
                >
                  {validating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  <span>Check YAML</span>
                </Button>
                <Button
                  type="button"
                  onClick={() => saveYamlFile('checkmk_queries.yaml', checkmkQueriesYaml)}
                  disabled={yamlLoading || validating}
                  className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  {yamlLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  <span>Save Queries</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* YAML Validation Error Dialog */}
      <Dialog open={showValidationDialog} onOpenChange={setShowValidationDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <span>YAML Validation Error</span>
            </DialogTitle>
            <DialogDescription>
              The YAML content contains syntax errors that need to be fixed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {validationError && (
              <>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-semibold text-red-800 mb-2">Error Details:</h4>
                  <div className="space-y-2 text-sm">
                    {validationError.line && validationError.column && (
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-red-700">Location:</span>
                        <span className="text-red-900">
                          Line {validationError.line}, Column {validationError.column}
                        </span>
                      </div>
                    )}
                    {validationError.error && (
                      <div className="space-y-1">
                        <span className="font-medium text-red-700">Error Message:</span>
                        <pre className="bg-white border border-red-300 rounded p-3 text-xs overflow-x-auto text-red-900 whitespace-pre-wrap">
                          {validationError.error}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-2">Common YAML Issues:</h4>
                  <ul className="text-sm text-blue-900 space-y-1 list-disc list-inside">
                    <li>Check for proper indentation (use spaces, not tabs)</li>
                    <li>Ensure colons are followed by a space</li>
                    <li>Verify quotes are properly closed</li>
                    <li>Check for special characters that need escaping</li>
                  </ul>
                </div>
              </>
            )}
            <div className="flex justify-end">
              <Button
                onClick={() => setShowValidationDialog(false)}
                variant="outline"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}