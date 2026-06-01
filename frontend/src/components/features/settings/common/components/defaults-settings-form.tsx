'use client'

import { useState, useCallback, useEffect } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { Loader2, RotateCcw } from 'lucide-react'
import { LocationSearchDropdown } from '@/components/features/settings/connections/nautobot/components/location-search-dropdown'
import { useNautobotOptionsQuery } from '@/components/features/settings/connections/nautobot/hooks/use-nautobot-options-query'
import { EMPTY_ARRAY } from '@/components/features/settings/connections/nautobot/utils/constants'
import type {
  NautobotOption,
  LocationItem,
} from '@/components/features/settings/connections/nautobot/types'
import type { DefaultsFields } from '../types/defaults-fields'

interface DefaultsSettingsFormProps {
  title: string
  description: string
  loadingMessage: string
  headerIcon: LucideIcon
  defaults: DefaultsFields | undefined
  isLoadingDefaults: boolean
  isSaving: boolean
  emptyDefaults: DefaultsFields
  onSave: (values: DefaultsFields) => void
}

export function DefaultsSettingsForm({
  title,
  description,
  loadingMessage,
  headerIcon: HeaderIcon,
  defaults,
  isLoadingDefaults,
  isSaving,
  emptyDefaults,
  onSave,
}: DefaultsSettingsFormProps) {
  const { data: options, isLoading: optionsLoading } = useNautobotOptionsQuery()
  const [localDefaults, setLocalDefaults] = useState<DefaultsFields>(emptyDefaults)

  useEffect(() => {
    if (defaults) {
      setLocalDefaults(defaults)
    }
  }, [defaults])

  const updateDefault = useCallback((key: keyof DefaultsFields, value: string) => {
    setLocalDefaults(prev => ({ ...prev, [key]: value }))
  }, [])

  const resetDefaults = useCallback(() => {
    setLocalDefaults(emptyDefaults)
  }, [emptyDefaults])

  const isLoading = isLoadingDefaults || optionsLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">{loadingMessage}</span>
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
      <Card className="shadow-lg border-0 overflow-hidden p-0">
        <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-4">
          <CardTitle className="flex items-center space-x-2 text-sm font-medium">
            <HeaderIcon className="h-4 w-4" />
            <span>{title}</span>
          </CardTitle>
          <CardDescription className="text-blue-100 text-xs mt-1">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="default-location" className="text-sm font-medium text-gray-700">
                Location
              </Label>
              <LocationSearchDropdown
                locations={locations}
                value={localDefaults.location}
                onChange={locationId => updateDefault('location', locationId)}
                placeholder="Search location..."
              />
              <p className="text-xs text-gray-500">Default location for new devices</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default-platform" className="text-sm font-medium text-gray-700">
                Platform
              </Label>
              <Select
                value={localDefaults.platform ?? ''}
                onValueChange={value => updateDefault('platform', value)}
              >
                <SelectTrigger className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue placeholder="Select a platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="detect">Auto-Detect Platform</SelectItem>
                  {platforms.map(platform => (
                    <SelectItem key={platform.id} value={platform.id}>
                      {platform.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Default platform for new devices</p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="default-interface-status"
                className="text-sm font-medium text-gray-700"
              >
                Interface Status
              </Label>
              <Select
                value={localDefaults.interface_status ?? ''}
                onValueChange={value => updateDefault('interface_status', value)}
              >
                <SelectTrigger className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue placeholder="Select interface status" />
                </SelectTrigger>
                <SelectContent>
                  {interfaceStatuses.map(status => (
                    <SelectItem key={status.id} value={status.id}>
                      <div className="flex items-center space-x-2">
                        {status.color && (
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: `#${status.color}` }}
                          />
                        )}
                        <span>{status.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Default status for new interfaces</p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="default-device-status"
                className="text-sm font-medium text-gray-700"
              >
                Device Status
              </Label>
              <Select
                value={localDefaults.device_status ?? ''}
                onValueChange={value => updateDefault('device_status', value)}
              >
                <SelectTrigger className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue placeholder="Select device status" />
                </SelectTrigger>
                <SelectContent>
                  {deviceStatuses.map(status => (
                    <SelectItem key={status.id} value={status.id}>
                      <div className="flex items-center space-x-2">
                        {status.color && (
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: `#${status.color}` }}
                          />
                        )}
                        <span>{status.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Default status for new devices</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default-ip-status" className="text-sm font-medium text-gray-700">
                IP Address Status
              </Label>
              <Select
                value={localDefaults.ip_address_status ?? ''}
                onValueChange={value => updateDefault('ip_address_status', value)}
              >
                <SelectTrigger className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue placeholder="Select IP address status" />
                </SelectTrigger>
                <SelectContent>
                  {ipAddressStatuses.map(status => (
                    <SelectItem key={status.id} value={status.id}>
                      <div className="flex items-center space-x-2">
                        {status.color && (
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: `#${status.color}` }}
                          />
                        )}
                        <span>{status.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Default status for new IP addresses</p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="default-ip-prefix-status"
                className="text-sm font-medium text-gray-700"
              >
                IP Prefix Status
              </Label>
              <Select
                value={localDefaults.ip_prefix_status ?? ''}
                onValueChange={value => updateDefault('ip_prefix_status', value)}
              >
                <SelectTrigger className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue placeholder="Select IP prefix status" />
                </SelectTrigger>
                <SelectContent>
                  {ipPrefixStatuses.map(status => (
                    <SelectItem key={status.id} value={status.id}>
                      <div className="flex items-center space-x-2">
                        {status.color && (
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: `#${status.color}` }}
                          />
                        )}
                        <span>{status.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Default status for new IP prefixes</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default-namespace" className="text-sm font-medium text-gray-700">
                Namespace
              </Label>
              <Select
                value={localDefaults.namespace ?? ''}
                onValueChange={value => updateDefault('namespace', value)}
              >
                <SelectTrigger className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue placeholder="Select a namespace" />
                </SelectTrigger>
                <SelectContent>
                  {namespaces.map(namespace => (
                    <SelectItem key={namespace.id} value={namespace.id}>
                      {namespace.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Default namespace for new IP addresses</p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="default-device-role"
                className="text-sm font-medium text-gray-700"
              >
                Device Role
              </Label>
              <Select
                value={localDefaults.device_role ?? ''}
                onValueChange={value => updateDefault('device_role', value)}
              >
                <SelectTrigger className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue placeholder="Select a device role" />
                </SelectTrigger>
                <SelectContent>
                  {deviceRoles.map(role => (
                    <SelectItem key={role.id} value={role.id}>
                      <div className="flex items-center space-x-2">
                        {role.color && (
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: `#${role.color}` }}
                          />
                        )}
                        <span>{role.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Default role for new devices</p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="default-secret-group"
                className="text-sm font-medium text-gray-700"
              >
                Secret Group
              </Label>
              <Select
                value={localDefaults.secret_group ?? ''}
                onValueChange={value => updateDefault('secret_group', value)}
              >
                <SelectTrigger className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue placeholder="Select a secret group" />
                </SelectTrigger>
                <SelectContent>
                  {secretGroups.map(group => (
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

            <div className="space-y-2">
              <Label
                htmlFor="default-csv-delimiter"
                className="text-sm font-medium text-gray-700"
              >
                CSV Delimiter
              </Label>
              <Input
                id="default-csv-delimiter"
                type="text"
                maxLength={1}
                placeholder=","
                value={localDefaults.csv_delimiter}
                onChange={e => updateDefault('csv_delimiter', e.target.value)}
                className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500">
                Default delimiter for CSV file uploads (default: comma)
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="default-csv-quote-char"
                className="text-sm font-medium text-gray-700"
              >
                CSV Quote Character
              </Label>
              <Input
                id="default-csv-quote-char"
                type="text"
                maxLength={1}
                placeholder='"'
                value={localDefaults.csv_quote_char}
                onChange={e => updateDefault('csv_quote_char', e.target.value)}
                className="w-full border-gray-200 focus:border-blue-500 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500">
                Default quote character for CSV file uploads (default: double quote)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
            onClick={() => onSave(localDefaults)}
            disabled={isSaving}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 text-base font-medium"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{isSaving ? 'Saving...' : 'Save Defaults'}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
