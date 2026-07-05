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
import { IconChip } from '@/components/shared/icon-chip'
import { StatusIcon } from '@/components/shared/status-icon'
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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading settings...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <div className="flex items-center space-x-3">
          <IconChip>
            <Server className="h-6 w-6" />
          </IconChip>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Nautobot Settings</h1>
            <p className="text-muted-foreground">Configure your Nautobot server connection</p>
          </div>
        </div>
      </div>

      <Card className="shadow-lg border-0 overflow-hidden p-0">
        <CardHeader className="panel-header border-b-0 rounded-none m-0 py-2 px-4">
          <CardTitle className="flex items-center space-x-2 text-sm font-medium">
            <Settings className="h-4 w-4" />
            <span>Nautobot Connection Settings</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="panel-content p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="nautobot-url" className="text-sm font-medium text-muted-foreground">
                Nautobot Server URL <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nautobot-url"
                type="url"
                placeholder="https://nautobot.example.com"
                value={localSettings.url}
                onChange={e => updateSetting('url', e.target.value)}
                required
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">The base URL of your Nautobot instance</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nautobot-token" className="text-sm font-medium text-muted-foreground">
                API Token <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nautobot-token"
                type="password"
                placeholder="Enter your Nautobot API token"
                value={localSettings.token}
                onChange={e => updateSetting('token', e.target.value)}
                required
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Get your API token from Nautobot: Admin → Users → [Your User] → API Tokens
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nautobot-timeout" className="text-sm font-medium text-muted-foreground">
                Connection Timeout (seconds)
              </Label>
              <Input
                id="nautobot-timeout"
                type="number"
                min="5"
                max="300"
                value={localSettings.timeout}
                onChange={e => updateSetting('timeout', parseInt(e.target.value) || 30)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">Request timeout in seconds (default: 30)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nautobot-ssl" className="text-sm font-medium text-muted-foreground">
                SSL Verification
              </Label>
              <div className="flex items-center space-x-2 p-3 bg-card rounded-lg border border-border">
                <Checkbox
                  id="nautobot-ssl"
                  checked={localSettings.verify_ssl}
                  onCheckedChange={checked => updateSetting('verify_ssl', !!checked)}
                />
                <Label htmlFor="nautobot-ssl" className="text-sm text-muted-foreground">
                  Verify SSL certificates
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Uncheck only for development environments
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <div className="bg-info p-4 rounded-lg border border-info-border">
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
                    className="flex items-center space-x-2 border-info-border text-info-foreground hover:bg-info"
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
                <div className="text-xs text-info-foreground font-medium">
                  Test your connection before saving
                </div>
              </div>

              {testResult && (
                <div
                  className={`mt-3 p-3 rounded-md border ${
                    testResult.success
                      ? 'bg-success border-success-border text-success-foreground'
                      : 'bg-error border-error-border text-error-foreground'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <StatusIcon variant={testResult.success ? 'success' : 'error'} />
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

      <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={resetSettings}
            className="flex items-center space-x-2"
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
            className="flex items-center space-x-2 px-6 py-2 text-base font-medium"
          >
            {saveSettings.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{saveSettings.isPending ? 'Saving...' : 'Save Settings'}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
