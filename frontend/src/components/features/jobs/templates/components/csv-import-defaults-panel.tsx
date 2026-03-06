'use client'

import { useCallback, useMemo, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, ChevronRight, Settings2 } from 'lucide-react'
import type { CsvImportNautobotData, NautobotItem } from '../hooks/use-csv-import-nautobot-query'
import { useSearchableDropdown } from '@/components/features/nautobot/add-device/hooks/use-searchable-dropdown'
import { SearchableDropdownInput } from '@/components/features/nautobot/add-device/components/searchable-dropdown-input'
import { buildLocationHierarchy } from '@/components/features/nautobot/add-device/utils'
import type { LocationItem } from '@/components/features/nautobot/add-device/types'

// Static enums — no API needed
const IP_ADDRESS_TYPES = [
  { value: 'host', label: 'Host' },
  { value: 'dhcp', label: 'DHCP' },
  { value: 'slaac', label: 'SLAAC' },
]

const IP_PREFIX_TYPES = [
  { value: 'network', label: 'Network' },
  { value: 'pool', label: 'Pool' },
  { value: 'container', label: 'Container' },
]

interface FieldConfig {
  key: string
  label: string
  required: boolean
  /** 'select' (default) renders a dropdown; 'text' renders a plain text input */
  type?: 'select' | 'text'
  items?: NautobotItem[]
  staticOptions?: { value: string; label: string }[]
  placeholder?: string
}

function getFieldConfigs(
  importType: string,
  data: CsvImportNautobotData
): FieldConfig[] {
  if (importType === 'devices') {
    return [
      { key: 'location', label: 'Location', required: true, items: data.locations },
      { key: 'device_type', label: 'Device Type', required: true, items: data.deviceTypes },
      { key: 'status', label: 'Status', required: true, items: data.deviceStatuses },
      { key: 'role', label: 'Role', required: true, items: data.deviceRoles },
      { key: 'platform', label: 'Platform', required: false, items: data.platforms },
      // Interface defaults — applied when the CSV row has no interface_* columns
      // (or as fallback when those columns are empty)
      {
        key: 'interface_name',
        label: 'Default Interface Name',
        required: false,
        type: 'text' as const,
        placeholder: 'e.g. Loopback0',
      },
      {
        key: 'interface_type',
        label: 'Default Interface Type',
        required: false,
        items: data.interfaceTypes,
      },
      {
        key: 'interface_status',
        label: 'Default Interface Status',
        required: false,
        items: data.interfaceStatuses,
      },
      {
        key: 'interface_namespace',
        label: 'Default IP Namespace',
        required: false,
        items: data.namespaces,
      },
    ]
  }
  if (importType === 'ip-addresses') {
    return [
      { key: 'namespace', label: 'Namespace', required: true, items: data.namespaces },
      { key: 'type', label: 'Type', required: true, staticOptions: IP_ADDRESS_TYPES },
      { key: 'status', label: 'Status', required: true, items: data.ipAddressStatuses },
      { key: 'role', label: 'Role', required: false, items: data.ipAddressRoles },
    ]
  }
  if (importType === 'ip-prefixes') {
    return [
      { key: 'namespace', label: 'Namespace', required: true, items: data.namespaces },
      { key: 'type', label: 'Type', required: true, staticOptions: IP_PREFIX_TYPES },
      { key: 'status', label: 'Status', required: true, items: data.prefixStatuses },
      { key: 'role', label: 'Role', required: false, items: data.prefixRoles },
    ]
  }
  return []
}

// Sub-component that houses the searchable-dropdown hook for location fields.
// Hooks cannot be called inside a .map(), so this wrapper component isolates them.
interface LocationFieldProps {
  items: NautobotItem[]
  value: string
  disabled: boolean
  onChange: (id: string) => void
}

function LocationField({ items, value, disabled, onChange }: LocationFieldProps) {
  const hierarchicalItems = useMemo(
    () => buildLocationHierarchy(items as LocationItem[]),
    [items]
  )

  const filterPredicate = useCallback(
    (item: LocationItem, query: string) =>
      (item.hierarchicalPath ?? item.name).toLowerCase().includes(query),
    []
  )

  const locationDropdown = useSearchableDropdown({
    items: hierarchicalItems,
    selectedId: value,
    onSelect: onChange,
    getDisplayText: (item) => item.hierarchicalPath ?? item.name,
    filterPredicate,
  })

  return (
    <SearchableDropdownInput
      id="csv-import-location"
      label="Location"
      placeholder="Search location..."
      required
      disabled={disabled}
      inputClassName="h-8 text-sm bg-white border-gray-300 shadow-sm"
      dropdownState={locationDropdown}
      renderItem={(item) => <span>{item.hierarchicalPath ?? item.name}</span>}
      getItemKey={(item) => item.id}
    />
  )
}

interface CsvImportDefaultsPanelProps {
  importType: string
  defaults: Record<string, string>
  onDefaultsChange: (defaults: Record<string, string>) => void
  nautobotData: CsvImportNautobotData
  isLoading: boolean
}

export function CsvImportDefaultsPanel({
  importType,
  defaults,
  onDefaultsChange,
  nautobotData,
  isLoading,
}: CsvImportDefaultsPanelProps) {
  const [open, setOpen] = useState(true)
  const fieldConfigs = useMemo(
    () => getFieldConfigs(importType, nautobotData),
    [importType, nautobotData]
  )

  if (!importType || fieldConfigs.length === 0) return null

  const handleChange = (key: string, value: string) => {
    const next = { ...defaults }
    if (!value) {
      delete next[key]
    } else {
      next[key] = value
    }
    onDefaultsChange(next)
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <CollapsibleTrigger asChild>
          <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg cursor-pointer select-none">
            <div className="flex items-center space-x-2">
              <Settings2 className="h-4 w-4" />
              <span className="text-sm font-medium">Default Values</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-blue-100">
                Used when CSV rows are missing these fields — CSV data always takes priority
              </span>
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
            <div className="grid grid-cols-2 gap-4">
          {fieldConfigs.map((field) => {
            const currentValue = defaults[field.key] ?? ''

            // Location gets a searchable filter input instead of a plain select
            if (field.key === 'location' && field.items) {
              return (
                <LocationField
                  key={field.key}
                  items={field.items}
                  value={currentValue}
                  disabled={isLoading}
                  onChange={(id) => handleChange(field.key, id)}
                />
              )
            }

            if (field.type === 'text') {
              return (
                <div key={field.key} className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">
                    {field.label}
                    {field.required && <span className="text-blue-500 ml-1">*</span>}
                  </Label>
                  <Input
                    className="h-8 text-sm bg-white border-gray-300 shadow-sm"
                    value={currentValue}
                    placeholder={field.placeholder ?? `Default ${field.label.toLowerCase()}...`}
                    disabled={isLoading}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                  />
                </div>
              )
            }

            // Build options with a stable `id` for the React key, separate from the stored value.
            // Some Nautobot types (e.g. device types) expose `display` instead of `name`.
            const options = field.staticOptions
              ? field.staticOptions.map((o, i) => ({ id: String(i), value: o.value, label: o.label }))
              : (field.items ?? []).map((item) => {
                  const label = item.display ?? item.name ?? item.id
                  return { id: item.id, value: item.id, label }
                })

            return (
              <div key={field.key} className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">
                  {field.label}
                  {field.required && (
                    <span className="text-blue-500 ml-1">*</span>
                  )}
                </Label>
                <Select
                  value={currentValue || '__none__'}
                  onValueChange={(val) => handleChange(field.key, val === '__none__' ? '' : val)}
                  disabled={isLoading}
                >
                  <SelectTrigger className="h-8 text-sm bg-white border-gray-300 shadow-sm">
                    <SelectValue placeholder={isLoading ? 'Loading...' : `Select default ${field.label.toLowerCase()}...`} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="text-gray-400">
                        {field.required ? '— No default (required in CSV) —' : '— No default —'}
                      </span>
                    </SelectItem>
                    {options.map((opt) => (
                      <SelectItem key={opt.id} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )
          })}
        </div>
      </div>
      </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
