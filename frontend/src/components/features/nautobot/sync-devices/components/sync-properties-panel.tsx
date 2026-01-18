'use client'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Settings, RefreshCw } from 'lucide-react'
import type { SyncProperties, DropdownOption } from '../types'

interface SyncPropertiesPanelProps {
  syncProperties: SyncProperties
  onSyncPropertiesChange: (props: SyncProperties) => void
  namespaces: DropdownOption[]
  prefixStatuses: DropdownOption[]
  interfaceStatuses: DropdownOption[]
  ipAddressStatuses: DropdownOption[]
  selectedCount: number
  isFormValid: boolean
  isSubmitting: boolean
  onSync: () => void
}

const SYNC_OPTIONS = [
  { id: 'cables', label: 'Sync Cables' },
  { id: 'software', label: 'Sync Software' },
  { id: 'vlans', label: 'Sync VLANs' },
  { id: 'vrfs', label: 'Sync VRFs' },
] as const

export function SyncPropertiesPanel({
  syncProperties,
  onSyncPropertiesChange,
  namespaces,
  prefixStatuses,
  interfaceStatuses,
  ipAddressStatuses,
  selectedCount,
  isFormValid,
  isSubmitting,
  onSync,
}: SyncPropertiesPanelProps) {
  const handlePropertyChange = (key: keyof Omit<SyncProperties, 'sync_options'>, value: string) => {
    onSyncPropertiesChange({ ...syncProperties, [key]: value })
  }

  const handleSyncOptionChange = (option: string, checked: boolean) => {
    const newOptions = checked
      ? [...syncProperties.sync_options, option]
      : syncProperties.sync_options.filter((o) => o !== option)
    onSyncPropertiesChange({ ...syncProperties, sync_options: newOptions })
  }

  return (
    <div className="rounded-xl border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
        <div className="flex items-center space-x-2">
          <Settings className="h-4 w-4" />
          <div>
            <h3 className="text-sm font-semibold">Sync Properties</h3>
            <p className="text-blue-100 text-xs">Configure synchronization settings</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 bg-white space-y-3">
        {/* Namespace */}
        <div className="space-y-1">
          <Label htmlFor="namespace" className="text-xs font-medium">
            Namespace <span className="text-red-500">*</span>
          </Label>
          <Select
            value={syncProperties.namespace}
            onValueChange={(value) => handlePropertyChange('namespace', value)}
          >
            <SelectTrigger className="h-8 border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
              <SelectValue placeholder="Select namespace..." />
            </SelectTrigger>
            <SelectContent>
              {namespaces.map((ns) => (
                <SelectItem key={ns.id} value={ns.id}>
                  {ns.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Prefix Status */}
        <div className="space-y-1">
          <Label className="text-xs font-medium">
            Prefix Status <span className="text-red-500">*</span>
          </Label>
          <Select
            value={syncProperties.prefix_status}
            onValueChange={(value) => handlePropertyChange('prefix_status', value)}
          >
            <SelectTrigger className="h-8 border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
              <SelectValue placeholder="Select prefix status..." />
            </SelectTrigger>
            <SelectContent>
              {prefixStatuses.map((status) => (
                <SelectItem key={status.id} value={status.id}>
                  {status.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Interface Status */}
        <div className="space-y-1">
          <Label className="text-xs font-medium">
            Interface Status <span className="text-red-500">*</span>
          </Label>
          <Select
            value={syncProperties.interface_status}
            onValueChange={(value) => handlePropertyChange('interface_status', value)}
          >
            <SelectTrigger className="h-8 border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
              <SelectValue placeholder="Select interface status..." />
            </SelectTrigger>
            <SelectContent>
              {interfaceStatuses.map((status) => (
                <SelectItem key={status.id} value={status.id}>
                  {status.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* IP Address Status */}
        <div className="space-y-1">
          <Label className="text-xs font-medium">
            IP Address Status <span className="text-red-500">*</span>
          </Label>
          <Select
            value={syncProperties.ip_address_status}
            onValueChange={(value) => handlePropertyChange('ip_address_status', value)}
          >
            <SelectTrigger className="h-8 border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
              <SelectValue placeholder="Select IP address status..." />
            </SelectTrigger>
            <SelectContent>
              {ipAddressStatuses.map((status) => (
                <SelectItem key={status.id} value={status.id}>
                  {status.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sync Options */}
        <div className="space-y-3">
          <Label>Sync Options</Label>
          <div className="space-y-2">
            {SYNC_OPTIONS.map((option) => (
              <div key={option.id} className="flex items-center space-x-2">
                <Checkbox
                  id={option.id}
                  checked={syncProperties.sync_options.includes(option.id)}
                  onCheckedChange={(checked) =>
                    handleSyncOptionChange(option.id, checked as boolean)
                  }
                />
                <Label htmlFor={option.id} className="text-sm font-medium cursor-pointer">
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Sync Button */}
        <div className="pt-4">
          <Button
            onClick={onSync}
            disabled={!isFormValid || isSubmitting}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync {selectedCount > 0 ? `${selectedCount} ` : ''}
                Device{selectedCount !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
