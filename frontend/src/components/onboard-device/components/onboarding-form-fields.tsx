'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Search, Tags, FileText } from 'lucide-react'
import { LocationSelector } from './location-selector'
import type { DropdownOption, LocationItem, OnboardFormData, IPValidation } from '../types'

const EMPTY_OPTIONS: DropdownOption[] = []

interface OnboardingFormFieldsProps {
  formData: OnboardFormData
  ipValidation: IPValidation
  locations: LocationItem[]
  namespaces: DropdownOption[]
  deviceRoles: DropdownOption[]
  platforms: DropdownOption[]
  deviceStatuses: DropdownOption[]
  interfaceStatuses: DropdownOption[]
  ipAddressStatuses: DropdownOption[]
  prefixStatuses: DropdownOption[]
  secretGroups: DropdownOption[]
  locationSearchValue: string
  deviceSearchQuery: string
  selectedTagsCount: number
  onIPChange: (value: string) => void
  onFormDataChange: (field: keyof OnboardFormData, value: string | number) => void
  onSyncOptionChange: (option: string, checked: boolean) => void
  onLocationSelect: (location: LocationItem) => void
  onCheckIP: () => void
  onSearchDevice: () => void
  onDeviceSearchQueryChange: (value: string) => void
  onShowTagsModal: () => void
  onShowCustomFieldsModal: () => void
  isValidatingIP: boolean
  isSearchingDevice: boolean
}

export function OnboardingFormFields({
  formData,
  ipValidation,
  locations,
  namespaces = EMPTY_OPTIONS,
  deviceRoles = EMPTY_OPTIONS,
  platforms = EMPTY_OPTIONS,
  deviceStatuses = EMPTY_OPTIONS,
  interfaceStatuses = EMPTY_OPTIONS,
  ipAddressStatuses = EMPTY_OPTIONS,
  prefixStatuses = EMPTY_OPTIONS,
  secretGroups = EMPTY_OPTIONS,
  locationSearchValue,
  deviceSearchQuery,
  onIPChange,
  onFormDataChange,
  onSyncOptionChange,
  onLocationSelect,
  onCheckIP,
  onSearchDevice,
  onDeviceSearchQueryChange,
  onShowTagsModal,
  onShowCustomFieldsModal,
  selectedTagsCount,
  isValidatingIP,
  isSearchingDevice
}: OnboardingFormFieldsProps) {
  return (
    <div className="space-y-4">
      {/* Panel 1: Device Information - IP Address and Device Search */}
      <div className="rounded-xl border shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-1.5 px-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold">Device Information</h3>
              <p className="text-blue-100 text-[10px]">Enter IP address and verify availability</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={onShowTagsModal}
                size="sm"
                variant="outline"
                className="bg-white text-blue-600 hover:bg-blue-50 border-blue-200 h-7 text-xs px-2"
              >
                <Tags className="h-3 w-3 mr-1" />
                Tags {selectedTagsCount > 0 && `(${selectedTagsCount})`}
              </Button>
              <Button
                onClick={onShowCustomFieldsModal}
                size="sm"
                variant="outline"
                className="bg-white text-blue-600 hover:bg-blue-50 border-blue-200 h-7 text-xs px-2"
              >
                <FileText className="h-3 w-3 mr-1" />
                Custom Fields
              </Button>
            </div>
          </div>
        </div>
        <div className="p-3 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Cell: IP Address Check */}
            <div className="space-y-1">
              <Label htmlFor="ip_address" className="text-[11px] font-medium">
                IP Address(es) <span className="text-red-500">*</span>
                <span className="text-muted-foreground font-normal ml-1">(comma-separated for multiple)</span>
              </Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    id="ip_address"
                    placeholder="192.168.1.1, 192.168.1.2, 192.168.1.3"
                    value={formData.ip_address}
                    onChange={e => onIPChange(e.target.value)}
                    className={`h-7 text-xs border-2 bg-white ${
                      ipValidation.isValid
                        ? 'border-green-500 bg-green-50'
                        : formData.ip_address && !ipValidation.isValid
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-300 hover:border-gray-400 focus:border-blue-500'
                    }`}
                  />
                  {formData.ip_address && (
                    <p className={`text-[10px] mt-0.5 ${ipValidation.isValid ? 'text-green-600' : 'text-red-600'}`}>
                      {ipValidation.message}
                    </p>
                  )}
                </div>
                <Button
                  onClick={onCheckIP}
                  disabled={!ipValidation.isValid || isValidatingIP}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-3 whitespace-nowrap"
                >
                  {isValidatingIP ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500 mr-1" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <Search className="h-3 w-3 mr-1" />
                      Check IP
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Right Cell: Device Name Check */}
            <div className="space-y-1">
              <Label htmlFor="device_search" className="text-[11px] font-medium">
                Device Name Search (optional)
              </Label>
              <div className="flex gap-2">
                <Input
                  id="device_search"
                  placeholder="Enter device name"
                  value={deviceSearchQuery}
                  onChange={e => onDeviceSearchQueryChange(e.target.value)}
                  className="h-7 text-xs border-2 border-gray-300 hover:border-gray-400 focus:border-blue-500 bg-white flex-1"
                />
                <Button
                  onClick={onSearchDevice}
                  disabled={!deviceSearchQuery.trim() || isSearchingDevice}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-3 whitespace-nowrap"
                >
                  {isSearchingDevice ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500 mr-1" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="h-3 w-3 mr-1" />
                      Search
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Panel 2: Device Properties */}
      <div className="rounded-xl border shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-1.5 px-3">
          <div className="flex items-center space-x-1.5">
            <div>
              <h3 className="text-xs font-semibold">Device Properties</h3>
              <p className="text-blue-100 text-[10px]">Configure device settings and network properties</p>
            </div>
          </div>
        </div>
        <div className="p-3 bg-white">
          {/* Device Properties Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Location Selector */}
            <LocationSelector
              locations={locations}
              selectedLocationId={formData.location_id}
              value={locationSearchValue}
              onChange={onLocationSelect}
            />

        <div className="space-y-1">
          <Label className="text-[11px] font-medium">
            Namespace <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.namespace_id}
            onValueChange={value => onFormDataChange('namespace_id', value)}
          >
            <SelectTrigger className="h-8 text-sm border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
              <SelectValue placeholder="Select namespace..." />
            </SelectTrigger>
            <SelectContent>
              {namespaces.map(ns => (
                <SelectItem key={ns.id} value={ns.id}>
                  {ns.display || ns.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] font-medium">
            Device Role <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.role_id}
            onValueChange={value => onFormDataChange('role_id', value)}
          >
            <SelectTrigger className="h-8 text-sm border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
              <SelectValue placeholder="Select device role..." />
            </SelectTrigger>
            <SelectContent>
              {deviceRoles.map(role => (
                <SelectItem key={role.id} value={role.id}>
                  {role.display || role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] font-medium">Platform</Label>
          <Select
            value={formData.platform_id}
            onValueChange={value => onFormDataChange('platform_id', value)}
          >
            <SelectTrigger className="h-8 text-sm border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
              <SelectValue placeholder="Select platform..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="detect">Auto-detect</SelectItem>
              {platforms.map(platform => (
                <SelectItem key={platform.id} value={platform.id}>
                  {platform.display || platform.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] font-medium">
            Device Status <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.status_id}
            onValueChange={value => onFormDataChange('status_id', value)}
          >
            <SelectTrigger className="h-8 text-sm border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
              <SelectValue placeholder="Select device status..." />
            </SelectTrigger>
            <SelectContent>
              {deviceStatuses.map(status => (
                <SelectItem key={status.id} value={status.id}>
                  {status.display || status.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] font-medium">
            Secret Group <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.secret_groups_id}
            onValueChange={value => onFormDataChange('secret_groups_id', value)}
          >
            <SelectTrigger className="h-8 text-sm border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
              <SelectValue placeholder="Select secret group..." />
            </SelectTrigger>
            <SelectContent>
              {secretGroups.map(group => (
                <SelectItem key={group.id} value={group.id}>
                  {group.display || group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] font-medium">
            Interface Status <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.interface_status_id}
            onValueChange={value => onFormDataChange('interface_status_id', value)}
          >
            <SelectTrigger className="h-8 text-sm border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
              <SelectValue placeholder="Select interface status..." />
            </SelectTrigger>
            <SelectContent>
              {interfaceStatuses.map(status => (
                <SelectItem key={status.id} value={status.id}>
                  {status.display || status.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] font-medium">
            IP Address Status <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.ip_address_status_id}
            onValueChange={value => onFormDataChange('ip_address_status_id', value)}
          >
            <SelectTrigger className="h-8 text-sm border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
              <SelectValue placeholder="Select IP address status..." />
            </SelectTrigger>
            <SelectContent>
              {ipAddressStatuses.map(status => (
                <SelectItem key={status.id} value={status.id}>
                  {status.display || status.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] font-medium">
            Prefix Status <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.prefix_status_id}
            onValueChange={value => onFormDataChange('prefix_status_id', value)}
          >
            <SelectTrigger className="h-8 text-sm border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
              <SelectValue placeholder="Select prefix status..." />
            </SelectTrigger>
            <SelectContent>
              {prefixStatuses.map(status => (
                <SelectItem key={status.id} value={status.id}>
                  {status.display || status.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
          </div> {/* Close grid */}
        </div> {/* Close p-3 bg-white */}
      </div> {/* Close Panel 2: Device Properties */}

      {/* Panel 3: Connection & Sync Settings */}
      <div className="rounded-xl border shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-1.5 px-3">
          <div className="flex items-center space-x-1.5">
            <div>
              <h3 className="text-xs font-semibold">Connection & Sync Settings</h3>
              <p className="text-blue-100 text-[10px]">Configure connection parameters and sync options</p>
            </div>
          </div>
        </div>
        <div className="p-3 bg-white">
          {/* Connection Settings - All in one row */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1 w-24">
              <Label className="text-[11px] font-medium">SSH Port</Label>
              <Input
                type="number"
                value={formData.port}
                onChange={e => onFormDataChange('port', parseInt(e.target.value, 10))}
                className="h-8 text-sm border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
              />
            </div>

            <div className="space-y-1 w-28">
              <Label className="text-[11px] font-medium">Timeout (sec)</Label>
              <Input
                type="number"
                value={formData.timeout}
                onChange={e => onFormDataChange('timeout', parseInt(e.target.value, 10))}
                className="h-8 text-sm border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
              />
            </div>

            {/* Sync Options inline */}
            {[
              { id: 'cables', label: 'Cables' },
              { id: 'software', label: 'Software' },
              { id: 'vlans', label: 'VLANs' },
              { id: 'vrfs', label: 'VRFs' }
            ].map(option => (
              <div key={option.id} className="flex items-center space-x-2 h-8">
                <Checkbox
                  id={`sync-${option.id}`}
                  checked={formData.sync_options.includes(option.id)}
                  onCheckedChange={(checked) => onSyncOptionChange(option.id, checked as boolean)}
                />
                <Label htmlFor={`sync-${option.id}`} className="text-sm font-medium cursor-pointer">
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
