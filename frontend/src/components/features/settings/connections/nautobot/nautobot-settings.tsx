'use client'

import { useMemo, useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Server, Settings, RotateCcw, Database } from 'lucide-react'
import { useNautobotSettingsQuery } from './hooks/use-nautobot-settings-query'
import { useNautobotDefaultsQuery } from './hooks/use-nautobot-defaults-query'
import { useNautobotOffboardingQuery } from './hooks/use-nautobot-offboarding-query'
import { useNautobotOptionsQuery } from './hooks/use-nautobot-options-query'
import { useCustomFieldsQuery, useCustomFieldChoicesQueries } from './hooks/use-nautobot-custom-fields-queries'
import { useNautobotMutations } from './hooks/use-nautobot-mutations'
import { LocationSearchDropdown } from './components/location-search-dropdown'
import { CustomFieldsTable } from './components/custom-fields-table'
import { DEFAULT_NAUTOBOT_SETTINGS, DEFAULT_NAUTOBOT_DEFAULTS, EMPTY_ARRAY } from './utils/constants'
import type { NautobotSettings, NautobotDefaults, DeviceOffboardingSettings, CustomFieldChoice, NautobotOption, LocationItem } from './types'

const DEFAULT_OFFBOARDING: DeviceOffboardingSettings = {
  remove_all_custom_fields: false,
  clear_device_name: false,
  keep_serial: false,
  location_id: '',
  status_id: '',
  role_id: '',
  custom_field_settings: {},
}

export default function NautobotSettingsForm() {
  // Query hooks
  const { data: settings, isLoading: settingsLoading } = useNautobotSettingsQuery()
  const { data: defaults, isLoading: defaultsLoading } = useNautobotDefaultsQuery()
  const { data: offboardingSettings, isLoading: offboardingLoading } = useNautobotOffboardingQuery()
  const { data: options, isLoading: optionsLoading } = useNautobotOptionsQuery()
  const { data: customFields = EMPTY_ARRAY } = useCustomFieldsQuery()

  // Custom field choices queries
  const customFieldChoicesResults = useCustomFieldChoicesQueries(customFields)

  // Build custom field choices map
  const customFieldChoices = useMemo(() => {
    const choicesMap: { [key: string]: CustomFieldChoice[] } = {}
    customFieldChoicesResults.forEach((result) => {
      if (result.data) {
        choicesMap[result.data.fieldName] = result.data.choices
      }
    })
    return choicesMap
  }, [customFieldChoicesResults])

  // Mutation hooks
  const { saveSettings, testConnection, saveDefaults, saveOffboarding } = useNautobotMutations()

  // Local state for form editing
  const [localSettings, setLocalSettings] = useState<NautobotSettings>(DEFAULT_NAUTOBOT_SETTINGS)
  const [localDefaults, setLocalDefaults] = useState<NautobotDefaults>(DEFAULT_NAUTOBOT_DEFAULTS)
  const [localOffboarding, setLocalOffboarding] = useState<DeviceOffboardingSettings>(DEFAULT_OFFBOARDING)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // Sync server data to local state (same pattern as CheckMK settings)
  useEffect(() => {
    if (settings) {
      setLocalSettings(settings)
    }
  }, [settings])

  useEffect(() => {
    if (defaults) {
      setLocalDefaults(defaults)
    }
  }, [defaults])

  useEffect(() => {
    if (offboardingSettings) {
      setLocalOffboarding(offboardingSettings)
    }
  }, [offboardingSettings])

  // Update handlers
  const updateSetting = useCallback((key: keyof NautobotSettings, value: string | number | boolean) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }))
  }, [])

  const updateDefault = useCallback((key: keyof NautobotDefaults, value: string) => {
    setLocalDefaults(prev => ({ ...prev, [key]: value }))
  }, [])

  const resetSettings = useCallback(() => {
    setLocalSettings(DEFAULT_NAUTOBOT_SETTINGS)
    setTestResult(null)
  }, [])

  const resetDefaults = useCallback(() => {
    setLocalDefaults(DEFAULT_NAUTOBOT_DEFAULTS)
  }, [])

  // Loading state
  const isLoading = settingsLoading || defaultsLoading || optionsLoading || offboardingLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading settings...</span>
      </div>
    )
  }

  const {
    deviceStatuses = EMPTY_ARRAY as NautobotOption[],
    interfaceStatuses = EMPTY_ARRAY as NautobotOption[],
    ipAddressStatuses = EMPTY_ARRAY as NautobotOption[],
    ipPrefixStatuses = EMPTY_ARRAY as NautobotOption[],
    namespaces = EMPTY_ARRAY as NautobotOption[],
    deviceRoles = EMPTY_ARRAY as NautobotOption[],
    platforms = EMPTY_ARRAY as NautobotOption[],
    locations = EMPTY_ARRAY as LocationItem[],
    secretGroups = EMPTY_ARRAY as NautobotOption[],
  } = options || {}

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Server className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Nautobot Settings</h1>
            <p className="text-gray-600">Configure your Nautobot server connection and default values</p>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="connection" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="connection" className="flex items-center space-x-2">
            <Server className="h-4 w-4" />
            <span>Connection</span>
          </TabsTrigger>
          <TabsTrigger value="defaults" className="flex items-center space-x-2">
            <Database className="h-4 w-4" />
            <span>Defaults</span>
          </TabsTrigger>
          <TabsTrigger value="offboarding" className="flex items-center space-x-2">
            <RotateCcw className="h-4 w-4" />
            <span>Offboarding</span>
          </TabsTrigger>
        </TabsList>

        {/* Connection Tab */}
        <TabsContent value="connection" className="space-y-6">
          <Card className="shadow-lg border-0 overflow-hidden p-0">
            <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-4">
              <CardTitle className="flex items-center space-x-2 text-sm font-medium">
                <Settings className="h-4 w-4" />
                <span>Nautobot Connection Settings</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Nautobot URL */}
                <div className="space-y-2">
                  <Label htmlFor="nautobot-url" className="text-sm font-medium text-gray-700">
                    Nautobot Server URL <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="nautobot-url"
                    type="url"
                    placeholder="https://nautobot.example.com"
                    value={localSettings.url}
                    onChange={(e) => updateSetting('url', e.target.value)}
                    required
                    className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500">
                    The base URL of your Nautobot instance
                  </p>
                </div>

                {/* API Token */}
                <div className="space-y-2">
                  <Label htmlFor="nautobot-token" className="text-sm font-medium text-gray-700">
                    API Token <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="nautobot-token"
                    type="password"
                    placeholder="Enter your Nautobot API token"
                    value={localSettings.token}
                    onChange={(e) => updateSetting('token', e.target.value)}
                    required
                    className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500">
                    Get your API token from Nautobot: Admin → Users → [Your User] → API Tokens
                  </p>
                </div>

                {/* Connection Timeout */}
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
                    onChange={(e) => updateSetting('timeout', parseInt(e.target.value) || 30)}
                    className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500">
                    Request timeout in seconds (default: 30)
                  </p>
                </div>

                {/* SSL Verification */}
                <div className="space-y-2">
                  <Label htmlFor="nautobot-ssl" className="text-sm font-medium text-gray-700">
                    SSL Verification
                  </Label>
                  <div className="flex items-center space-x-2 p-3 bg-white rounded-lg border border-gray-200">
                    <Checkbox
                      id="nautobot-ssl"
                      checked={localSettings.verify_ssl}
                      onCheckedChange={(checked) => updateSetting('verify_ssl', !!checked)}
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

              {/* Test Connection Button */}
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
                            onSuccess: (data) => {
                              setTestResult({ 
                                success: true, 
                                message: data.message || 'Connection successful!' 
                              })
                            },
                            onError: (error) => {
                              setTestResult({ 
                                success: false, 
                                message: error instanceof Error ? error.message : 'Connection failed' 
                              })
                            }
                          })
                        }}
                        disabled={testConnection.isPending || !localSettings.url || !localSettings.token}
                        className="flex items-center space-x-2 border-blue-300 text-blue-700 hover:bg-blue-100"
                      >
                        {testConnection.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Server className="h-4 w-4" />
                        )}
                        <span>{testConnection.isPending ? 'Testing...' : 'Test Connection'}</span>
                      </Button>
                    </div>
                    <div className="text-xs text-blue-600 font-medium">
                      Test your connection before saving
                    </div>
                  </div>
                  
                  {/* Test Result Message */}
                  {testResult && (
                    <div className={`mt-3 p-3 rounded-md ${
                      testResult.success 
                        ? 'bg-green-50 border border-green-200 text-green-800' 
                        : 'bg-red-50 border border-red-200 text-red-800'
                    }`}>
                      <div className="flex items-center space-x-2">
                        {testResult.success ? (
                          <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
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

          {/* Connection Action Buttons */}
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
                disabled={saveSettings.isPending || !localSettings.url || !localSettings.token}
                className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2 text-base font-medium"
              >
                {saveSettings.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>{saveSettings.isPending ? 'Saving...' : 'Save Settings'}</span>
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Defaults Tab */}
        <TabsContent value="defaults" className="space-y-6">
          <Card className="shadow-lg border-0 overflow-hidden p-0">
            <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-4">
              <CardTitle className="flex items-center space-x-2 text-sm font-medium">
                <Database className="h-4 w-4" />
                <span>Nautobot Default Values</span>
              </CardTitle>
              <CardDescription className="text-blue-100 text-xs mt-1">
                Configure default values used when creating devices in Nautobot
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Location */}
                <div className="space-y-2">
                  <Label htmlFor="default-location" className="text-sm font-medium text-gray-700">
                    Location
                  </Label>
                  <LocationSearchDropdown
                    locations={locations}
                    value={localDefaults.location}
                    onChange={(locationId) => updateDefault('location', locationId)}
                    placeholder="Search location..."
                  />
                  <p className="text-xs text-gray-500">
                    Default location for new devices
                  </p>
                </div>

                {/* Platform */}
                <div className="space-y-2">
                  <Label htmlFor="default-platform" className="text-sm font-medium text-gray-700">
                    Platform
                  </Label>
                  <Select value={localDefaults.platform ?? ''} onValueChange={(value) => updateDefault('platform', value)}>
                    <SelectTrigger className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Select a platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="detect">
                        Auto-Detect Platform
                      </SelectItem>
                      {platforms.map((platform) => (
                        <SelectItem key={platform.id} value={platform.id}>
                          {platform.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Default platform for new devices
                  </p>
                </div>

                {/* Interface Status */}
                <div className="space-y-2">
                  <Label htmlFor="default-interface-status" className="text-sm font-medium text-gray-700">
                    Interface Status
                  </Label>
                  <Select value={localDefaults.interface_status ?? ''} onValueChange={(value) => updateDefault('interface_status', value)}>
                    <SelectTrigger className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Select interface status" />
                    </SelectTrigger>
                    <SelectContent>
                      {interfaceStatuses.map((status) => (
                        <SelectItem key={status.id} value={status.id}>
                          <div className="flex items-center space-x-2">
                            {status.color && (
                              <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: `#${status.color}` }} />
                            )}
                            <span>{status.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Default status for new interfaces
                  </p>
                </div>

                {/* Device Status */}
                <div className="space-y-2">
                  <Label htmlFor="default-device-status" className="text-sm font-medium text-gray-700">
                    Device Status
                  </Label>
                  <Select value={localDefaults.device_status ?? ''} onValueChange={(value) => updateDefault('device_status', value)}>
                    <SelectTrigger className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Select device status" />
                    </SelectTrigger>
                    <SelectContent>
                      {deviceStatuses.map((status) => (
                        <SelectItem key={status.id} value={status.id}>
                          <div className="flex items-center space-x-2">
                            {status.color && (
                              <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: `#${status.color}` }} />
                            )}
                            <span>{status.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Default status for new devices
                  </p>
                </div>

                {/* IP Address Status */}
                <div className="space-y-2">
                  <Label htmlFor="default-ip-status" className="text-sm font-medium text-gray-700">
                    IP Address Status
                  </Label>
                  <Select value={localDefaults.ip_address_status ?? ''} onValueChange={(value) => updateDefault('ip_address_status', value)}>
                    <SelectTrigger className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Select IP address status" />
                    </SelectTrigger>
                    <SelectContent>
                      {ipAddressStatuses.map((status) => (
                        <SelectItem key={status.id} value={status.id}>
                          <div className="flex items-center space-x-2">
                            {status.color && (
                              <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: `#${status.color}` }} />
                            )}
                            <span>{status.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Default status for new IP addresses
                  </p>
                </div>

                {/* IP Prefix Status */}
                <div className="space-y-2">
                  <Label htmlFor="default-ip-prefix-status" className="text-sm font-medium text-gray-700">
                    IP Prefix Status
                  </Label>
                  <Select value={localDefaults.ip_prefix_status ?? ''} onValueChange={(value) => updateDefault('ip_prefix_status', value)}>
                    <SelectTrigger className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Select IP prefix status" />
                    </SelectTrigger>
                    <SelectContent>
                      {ipPrefixStatuses.map((status) => (
                        <SelectItem key={status.id} value={status.id}>
                          <div className="flex items-center space-x-2">
                            {status.color && (
                              <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: `#${status.color}` }} />
                            )}
                            <span>{status.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Default status for new IP prefixes
                  </p>
                </div>

                {/* Namespace */}
                <div className="space-y-2">
                  <Label htmlFor="default-namespace" className="text-sm font-medium text-gray-700">
                    Namespace
                  </Label>
                  <Select value={localDefaults.namespace ?? ''} onValueChange={(value) => updateDefault('namespace', value)}>
                    <SelectTrigger className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Select a namespace" />
                    </SelectTrigger>
                    <SelectContent>
                      {namespaces.map((namespace) => (
                        <SelectItem key={namespace.id} value={namespace.id}>
                          {namespace.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Default namespace for new IP addresses
                  </p>
                </div>

                {/* Device Role */}
                <div className="space-y-2">
                  <Label htmlFor="default-device-role" className="text-sm font-medium text-gray-700">
                    Device Role
                  </Label>
                  <Select value={localDefaults.device_role ?? ''} onValueChange={(value) => updateDefault('device_role', value)}>
                    <SelectTrigger className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Select a device role" />
                    </SelectTrigger>
                    <SelectContent>
                      {deviceRoles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          <div className="flex items-center space-x-2">
                            {role.color && (
                              <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: `#${role.color}` }} />
                            )}
                            <span>{role.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Default role for new devices
                  </p>
                </div>

                {/* Secret Group */}
                <div className="space-y-2">
                  <Label htmlFor="default-secret-group" className="text-sm font-medium text-gray-700">
                    Secret Group
                  </Label>
                  <Select value={localDefaults.secret_group ?? ''} onValueChange={(value) => updateDefault('secret_group', value)}>
                    <SelectTrigger className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Select a secret group" />
                    </SelectTrigger>
                    <SelectContent>
                      {secretGroups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Default secret group for device credentials
                  </p>
                </div>

                {/* CSV Delimiter */}
                <div className="space-y-2">
                  <Label htmlFor="default-csv-delimiter" className="text-sm font-medium text-gray-700">
                    CSV Delimiter
                  </Label>
                  <Input
                    id="default-csv-delimiter"
                    type="text"
                    maxLength={1}
                    placeholder=","
                    value={localDefaults.csv_delimiter}
                    onChange={(e) => updateDefault('csv_delimiter', e.target.value)}
                    className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500">
                    Default delimiter for CSV file uploads (default: comma)
                  </p>
                </div>

                {/* CSV Quote Character */}
                <div className="space-y-2">
                  <Label htmlFor="default-csv-quote-char" className="text-sm font-medium text-gray-700">
                    CSV Quote Character
                  </Label>
                  <Input
                    id="default-csv-quote-char"
                    type="text"
                    maxLength={1}
                    placeholder='"'
                    value={localDefaults.csv_quote_char}
                    onChange={(e) => updateDefault('csv_quote_char', e.target.value)}
                    className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500">
                    Default quote character for CSV file uploads (default: double quote)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Defaults Action Buttons */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={resetDefaults}
                className="flex items-center space-x-2 border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reset Defaults</span>
              </Button>

              <Button
                type="button"
                onClick={() => saveDefaults.mutate(localDefaults)}
                disabled={saveDefaults.isPending}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 text-base font-medium"
              >
                {saveDefaults.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>{saveDefaults.isPending ? 'Saving...' : 'Save Defaults'}</span>
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Offboarding Tab */}
        <TabsContent value="offboarding" className="space-y-6">
          <Card className="shadow-lg border-0 overflow-hidden p-0">
            <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-4">
              <CardTitle className="text-sm font-medium">Device Offboarding Settings</CardTitle>
              <CardDescription className="text-blue-100 text-xs">
                Configure settings for device offboarding operations
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Location, Status and Role Selection */}
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Location Filter */}
                  <div className="space-y-1">
                    <Label htmlFor="offboard_location_search" className="text-xs font-medium text-blue-800">
                      Location
                    </Label>
                    <LocationSearchDropdown
                      locations={locations}
                      value={localOffboarding.location_id}
                      onChange={(locationId) =>
                        setLocalOffboarding(prev => ({ ...prev, location_id: locationId }))
                      }
                      placeholder="Search locations..."
                    />
                  </div>

                  {/* Status Filter */}
                  <div className="space-y-1">
                    <Label htmlFor="offboard_status" className="text-xs font-medium text-blue-800">
                      Status
                    </Label>
                    <Select value={localOffboarding.status_id ?? ''} onValueChange={(value) =>
                      setLocalOffboarding(prev => ({ ...prev, status_id: value }))
                    }>
                      <SelectTrigger className="w-full h-8 text-xs bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
                        <SelectValue placeholder="Select status..." />
                      </SelectTrigger>
                      <SelectContent>
                        {deviceStatuses.map((status) => (
                          <SelectItem key={status.id} value={status.id}>
                            <div className="flex items-center space-x-2">
                              {status.color && (
                                <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: `#${status.color}` }} />
                              )}
                              <span className="text-xs">{status.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Role Filter */}
                  <div className="space-y-1">
                    <Label htmlFor="offboard_role" className="text-xs font-medium text-blue-800">
                      Role
                    </Label>
                    <Select value={localOffboarding.role_id ?? ''} onValueChange={(value) =>
                      setLocalOffboarding(prev => ({ ...prev, role_id: value }))
                    }>
                      <SelectTrigger className="w-full h-8 text-xs bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
                        <SelectValue placeholder="Select role..." />
                      </SelectTrigger>
                      <SelectContent>
                        {deviceRoles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            <div className="flex items-center space-x-2">
                              {role.color && (
                                <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: `#${role.color}` }} />
                              )}
                              <span className="text-xs">{role.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Settings Panel */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                <h3 className="text-sm font-medium text-gray-900">General Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex items-center space-x-1">
                    <Checkbox
                      id="remove-all-custom-fields"
                      checked={localOffboarding.remove_all_custom_fields}
                      onCheckedChange={(checked) =>
                        setLocalOffboarding(prev => ({
                          ...prev,
                          remove_all_custom_fields: checked === true
                        }))
                      }
                    />
                    <Label htmlFor="remove-all-custom-fields" className="text-xs font-medium">
                      Remove all custom fields
                    </Label>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Checkbox
                      id="clear-device-name"
                      checked={localOffboarding.clear_device_name}
                      onCheckedChange={(checked) =>
                        setLocalOffboarding(prev => ({
                          ...prev,
                          clear_device_name: checked === true
                        }))
                      }
                    />
                    <Label htmlFor="clear-device-name" className="text-xs font-medium">
                      Clear device name
                    </Label>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Checkbox
                      id="keep-serial"
                      checked={localOffboarding.keep_serial}
                      onCheckedChange={(checked) =>
                        setLocalOffboarding(prev => ({
                          ...prev,
                          keep_serial: checked === true
                        }))
                      }
                    />
                    <Label htmlFor="keep-serial" className="text-xs font-medium">
                      Keep serial
                    </Label>
                  </div>
                </div>
              </div>

              {/* Custom Fields Table */}
              {!localOffboarding.remove_all_custom_fields && (
                <CustomFieldsTable
                  customFields={customFields}
                  customFieldChoices={customFieldChoices}
                  values={localOffboarding.custom_field_settings}
                  onChange={(fieldName, value) =>
                    setLocalOffboarding(prev => ({
                      ...prev,
                      custom_field_settings: {
                        ...prev.custom_field_settings,
                        [fieldName]: value
                      }
                    }))
                  }
                />
              )}

              {/* Save Button */}
              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  onClick={() => saveOffboarding.mutate(localOffboarding)}
                  disabled={saveOffboarding.isPending}
                  className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 text-sm font-medium"
                >
                  {saveOffboarding.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                  <span>{saveOffboarding.isPending ? 'Saving...' : 'Save Offboarding Settings'}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
