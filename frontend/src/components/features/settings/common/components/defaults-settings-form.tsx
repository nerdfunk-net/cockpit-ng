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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">{loadingMessage}</span>
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
        <CardHeader className="panel-header border-b-0 rounded-none m-0 py-2 px-4">
          <CardTitle className="flex items-center space-x-2 text-sm font-medium">
            <HeaderIcon className="h-4 w-4" />
            <span>{title}</span>
          </CardTitle>
          <CardDescription className="text-panel-header-muted text-xs mt-1">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 panel-content space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="default-location" className="text-sm font-medium text-foreground">
                Location
              </Label>
              <LocationSearchDropdown
                locations={locations}
                value={localDefaults.location}
                onChange={locationId => updateDefault('location', locationId)}
                placeholder="Search location..."
              />
              <p className="text-xs text-muted-foreground">Default location for new devices</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default-platform" className="text-sm font-medium text-foreground">
                Platform
              </Label>
              <Select
                value={localDefaults.platform ?? ''}
                onValueChange={value => updateDefault('platform', value)}
              >
                <SelectTrigger className="w-full border-border focus:border-primary focus:ring-ring/30">
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
              <p className="text-xs text-muted-foreground">Default platform for new devices</p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="default-interface-status"
                className="text-sm font-medium text-foreground"
              >
                Interface Status
              </Label>
              <Select
                value={localDefaults.interface_status ?? ''}
                onValueChange={value => updateDefault('interface_status', value)}
              >
                <SelectTrigger className="w-full border-border focus:border-primary focus:ring-ring/30">
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
              <p className="text-xs text-muted-foreground">Default status for new interfaces</p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="default-device-status"
                className="text-sm font-medium text-foreground"
              >
                Device Status
              </Label>
              <Select
                value={localDefaults.device_status ?? ''}
                onValueChange={value => updateDefault('device_status', value)}
              >
                <SelectTrigger className="w-full border-border focus:border-primary focus:ring-ring/30">
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
              <p className="text-xs text-muted-foreground">Default status for new devices</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default-ip-status" className="text-sm font-medium text-foreground">
                IP Address Status
              </Label>
              <Select
                value={localDefaults.ip_address_status ?? ''}
                onValueChange={value => updateDefault('ip_address_status', value)}
              >
                <SelectTrigger className="w-full border-border focus:border-primary focus:ring-ring/30">
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
              <p className="text-xs text-muted-foreground">Default status for new IP addresses</p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="default-ip-prefix-status"
                className="text-sm font-medium text-foreground"
              >
                IP Prefix Status
              </Label>
              <Select
                value={localDefaults.ip_prefix_status ?? ''}
                onValueChange={value => updateDefault('ip_prefix_status', value)}
              >
                <SelectTrigger className="w-full border-border focus:border-primary focus:ring-ring/30">
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
              <p className="text-xs text-muted-foreground">Default status for new IP prefixes</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default-namespace" className="text-sm font-medium text-foreground">
                Namespace
              </Label>
              <Select
                value={localDefaults.namespace ?? ''}
                onValueChange={value => updateDefault('namespace', value)}
              >
                <SelectTrigger className="w-full border-border focus:border-primary focus:ring-ring/30">
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
              <p className="text-xs text-muted-foreground">Default namespace for new IP addresses</p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="default-device-role"
                className="text-sm font-medium text-foreground"
              >
                Device Role
              </Label>
              <Select
                value={localDefaults.device_role ?? ''}
                onValueChange={value => updateDefault('device_role', value)}
              >
                <SelectTrigger className="w-full border-border focus:border-primary focus:ring-ring/30">
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
              <p className="text-xs text-muted-foreground">Default role for new devices</p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="default-secret-group"
                className="text-sm font-medium text-foreground"
              >
                Secret Group
              </Label>
              <Select
                value={localDefaults.secret_group ?? ''}
                onValueChange={value => updateDefault('secret_group', value)}
              >
                <SelectTrigger className="w-full border-border focus:border-primary focus:ring-ring/30">
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
              <p className="text-xs text-muted-foreground">
                Default secret group for device credentials
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="default-csv-delimiter"
                className="text-sm font-medium text-foreground"
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
                className="w-full border-border focus:border-primary focus:ring-ring/30"
              />
              <p className="text-xs text-muted-foreground">
                Default delimiter for CSV file uploads (default: comma)
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="default-csv-quote-char"
                className="text-sm font-medium text-foreground"
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
                className="w-full border-border focus:border-primary focus:ring-ring/30"
              />
              <p className="text-xs text-muted-foreground">
                Default quote character for CSV file uploads (default: double quote)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={resetDefaults}
            className="flex items-center space-x-2"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reset Defaults</span>
          </Button>

          <Button
            type="button"
            onClick={() => onSave(localDefaults)}
            disabled={isSaving}
            className="flex items-center space-x-2 px-6 py-2 text-base font-medium"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{isSaving ? 'Saving...' : 'Save Defaults'}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
