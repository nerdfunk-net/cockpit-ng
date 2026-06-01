'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Server, Settings, RotateCcw } from 'lucide-react'
import { useNautobotSettingsQuery } from './hooks/use-nautobot-settings-query'
import { useNautobotMutations } from './hooks/use-nautobot-mutations'
import { DEFAULT_NAUTOBOT_SETTINGS } from './utils/constants'
import type { NautobotSettings } from './types'

export default function NautobotSettingsForm() {
  const { data: settings, isLoading: settingsLoading } = useNautobotSettingsQuery()
  const { saveSettings, testConnection } = useNautobotMutations()

  const [localSettings, setLocalSettings] = useState<NautobotSettings>(
    DEFAULT_NAUTOBOT_SETTINGS
  )
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings)
    }
  }, [settings])

  const updateSetting = useCallback(
    (key: keyof NautobotSettings, value: string | number | boolean) => {
      setLocalSettings(prev => ({ ...prev, [key]: value }))
    },
    []
  )

  const resetSettings = useCallback(() => {
    setLocalSettings(DEFAULT_NAUTOBOT_SETTINGS)
    setTestResult(null)
  }, [])

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading settings...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Server className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Nautobot Settings</h1>
            <p className="text-gray-600">Configure your Nautobot server connection</p>
          </div>
        </div>
      </div>

      <Card className="shadow-lg border-0 overflow-hidden p-0">
        <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-4">
          <CardTitle className="flex items-center space-x-2 text-sm font-medium">
            <Settings className="h-4 w-4" />
            <span>Nautobot Connection Settings</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="nautobot-url" className="text-sm font-medium text-gray-700">
                Nautobot Server URL <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nautobot-url"
                type="url"
                placeholder="https://nautobot.example.com"
                value={localSettings.url}
                onChange={e => updateSetting('url', e.target.value)}
                required
                className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500">The base URL of your Nautobot instance</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nautobot-token" className="text-sm font-medium text-gray-700">
                API Token <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nautobot-token"
                type="password"
                placeholder="Enter your Nautobot API token"
                value={localSettings.token}
                onChange={e => updateSetting('token', e.target.value)}
                required
                className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500">
                Get your API token from Nautobot: Admin → Users → [Your User] → API Tokens
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nautobot-timeout" className="text-sm font-medium text-gray-700">
                Connection Timeout (seconds)
              </Label>
              <Input
                id="nautobot-timeout"
                type="number"
                min="5"
                max="300"
                value={localSettings.timeout}
                onChange={e => updateSetting('timeout', parseInt(e.target.value) || 30)}
                className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500">Request timeout in seconds (default: 30)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nautobot-ssl" className="text-sm font-medium text-gray-700">
                SSL Verification
              </Label>
              <div className="flex items-center space-x-2 p-3 bg-white rounded-lg border border-gray-200">
                <Checkbox
                  id="nautobot-ssl"
                  checked={localSettings.verify_ssl}
                  onCheckedChange={checked => updateSetting('verify_ssl', !!checked)}
                  className="border-gray-300"
                />
                <Label htmlFor="nautobot-ssl" className="text-sm text-gray-700">
                  Verify SSL certificates
                </Label>
              </div>
              <p className="text-xs text-gray-500">
                Uncheck only for development environments
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setTestResult(null)
                      testConnection.mutate(localSettings, {
                        onSuccess: data => {
                          setTestResult({
                            success: true,
                            message: data.message || 'Connection successful!',
                          })
                        },
                        onError: error => {
                          setTestResult({
                            success: false,
                            message:
                              error instanceof Error
                                ? error.message
                                : 'Connection failed',
                          })
                        },
                      })
                    }}
                    disabled={
                      testConnection.isPending ||
                      !localSettings.url ||
                      !localSettings.token
                    }
                    className="flex items-center space-x-2 border-blue-300 text-blue-700 hover:bg-blue-100"
                  >
                    {testConnection.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Server className="h-4 w-4" />
                    )}
                    <span>
                      {testConnection.isPending ? 'Testing...' : 'Test Connection'}
                    </span>
                  </Button>
                </div>
                <div className="text-xs text-blue-600 font-medium">
                  Test your connection before saving
                </div>
              </div>

              {testResult && (
                <div
                  className={`mt-3 p-3 rounded-md ${
                    testResult.success
                      ? 'bg-green-50 border border-green-200 text-green-800'
                      : 'bg-red-50 border border-red-200 text-red-800'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    {testResult.success ? (
                      <svg
                        className="h-5 w-5 text-green-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="h-5 w-5 text-red-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    )}
                    <span className="text-sm font-medium">
                      {testResult.success ? 'Success' : 'Failed'}: {testResult.message}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

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
            onClick={() => saveSettings.mutate(localSettings)}
            disabled={
              saveSettings.isPending || !localSettings.url || !localSettings.token
            }
            className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2 text-base font-medium"
          >
            {saveSettings.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{saveSettings.isPending ? 'Saving...' : 'Save Settings'}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
