'use client'

import { useCallback, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info } from 'lucide-react'
import { useSearchableDropdown } from '../hooks/use-searchable-dropdown'
import { SearchableDropdownInput } from './searchable-dropdown-input'
import { buildLocationHierarchy } from '../utils'
import type { LocationItem, NautobotDropdownsResponse } from '../types'
import type { FormDefaults, PrefixConfig } from '../hooks/use-csv-import'

const PREFIX_LENGTH_OPTIONS = Array.from({ length: 32 }, (_, i) => `/${i + 1}`)

const FORM_VALUE_PREFIX = '__form__'
const NO_DEFAULT = '__none__'

interface CsvImportDefaultsStepProps {
  unmappedFields: readonly string[]
  unmappedInterfaceFields: readonly string[]
  defaults: Record<string, string>
  onDefaultsChange: (defaults: Record<string, string>) => void
  formDefaults: FormDefaults
  dropdownData: NautobotDropdownsResponse
  prefixConfig: PrefixConfig
  onPrefixConfigChange: (config: PrefixConfig) => void
  applyFormTags: boolean
  onApplyFormTagsChange: (val: boolean) => void
  applyFormCustomFields: boolean
  onApplyFormCustomFieldsChange: (val: boolean) => void
}

// Map field keys to dropdown data keys and labels
function getFieldConfig(field: string, dropdownData: NautobotDropdownsResponse) {
  switch (field) {
    case 'device_type':
      return {
        label: 'Device Type',
        items: dropdownData.deviceTypes.map(dt => ({
          id: dt.id,
          name: dt.display || dt.model,
        })),
      }
    case 'role':
      return {
        label: 'Role',
        items: dropdownData.roles.map(r => ({
          id: r.id,
          name: r.display || r.name,
        })),
      }
    case 'status':
      return {
        label: 'Status',
        items: dropdownData.statuses.map(s => ({
          id: s.id,
          name: s.display || s.name,
        })),
      }
    case 'location':
      return {
        label: 'Location',
        items: dropdownData.locations,
        isLocation: true,
      }
    case 'platform':
      return {
        label: 'Platform',
        items: dropdownData.platforms.map(p => ({
          id: p.id,
          name: p.display || p.name,
        })),
      }
    default:
      return null
  }
}

function getFormValueDisplay(field: string, formDefaults: FormDefaults): string | null {
  switch (field) {
    case 'device_type':
      return formDefaults.deviceTypeName || null
    case 'role':
      return formDefaults.roleName || null
    case 'status':
      return formDefaults.statusName || null
    case 'location':
      return formDefaults.locationName || null
    case 'platform':
      return formDefaults.platformName || null
    default:
      return null
  }
}

function getFormValue(field: string, formDefaults: FormDefaults): string | null {
  switch (field) {
    case 'device_type':
      return formDefaults.deviceType || null
    case 'role':
      return formDefaults.role || null
    case 'status':
      return formDefaults.status || null
    case 'location':
      return formDefaults.location || null
    case 'platform':
      return formDefaults.platform || null
    default:
      return null
  }
}

// Location field needs its own component because it uses hooks
interface LocationDefaultFieldProps {
  items: LocationItem[]
  value: string
  formDefaults: FormDefaults
  onChange: (value: string) => void
}

function LocationDefaultField({
  items,
  value,
  formDefaults,
  onChange,
}: LocationDefaultFieldProps) {
  const hierarchicalItems = useMemo(() => buildLocationHierarchy(items), [items])

  const filterPredicate = useCallback(
    (item: LocationItem, query: string) =>
      (item.hierarchicalPath ?? item.name).toLowerCase().includes(query),
    []
  )

  const formValueDisplay = getFormValueDisplay('location', formDefaults)
  const formValue = getFormValue('location', formDefaults)

  // If the current value is a form value marker, use the actual form value for the dropdown
  const effectiveValue =
    value === `${FORM_VALUE_PREFIX}location` && formValue ? formValue : value

  const locationDropdown = useSearchableDropdown({
    items: hierarchicalItems,
    selectedId: effectiveValue || '',
    onSelect: onChange,
    getDisplayText: item => item.hierarchicalPath ?? item.name,
    filterPredicate,
  })

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-gray-600">
        Location <span className="text-blue-500 ml-1">*</span>
      </Label>
      {formValueDisplay && (
        <button
          type="button"
          className={`w-full text-left text-xs px-3 py-1.5 rounded border transition-colors ${
            value === `${FORM_VALUE_PREFIX}location`
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => {
            if (formValue) onChange(formValue)
          }}
        >
          Use form value: <strong>{formValueDisplay}</strong>
        </button>
      )}
      <SearchableDropdownInput
        id="csv-default-location"
        label=""
        placeholder="Search location..."
        required={false}
        disabled={false}
        inputClassName="h-8 text-sm bg-white border-gray-300 shadow-sm"
        dropdownState={locationDropdown}
        renderItem={item => <span>{item.hierarchicalPath ?? item.name}</span>}
        getItemKey={item => item.id}
      />
    </div>
  )
}

export function CsvImportDefaultsStep({
  unmappedFields,
  unmappedInterfaceFields,
  defaults,
  onDefaultsChange,
  formDefaults,
  dropdownData,
  prefixConfig,
  onPrefixConfigChange,
  applyFormTags,
  onApplyFormTagsChange,
  applyFormCustomFields,
  onApplyFormCustomFieldsChange,
}: CsvImportDefaultsStepProps) {
  const hasFormTags = (formDefaults.selectedTags?.length ?? 0) > 0
  const hasFormCustomFields =
    Object.keys(formDefaults.customFieldValues ?? {}).length > 0
  const cfCount = Object.keys(formDefaults.customFieldValues ?? {}).length
  const handleChange = (key: string, value: string) => {
    const next = { ...defaults }
    if (!value || value === NO_DEFAULT) {
      delete next[key]
    } else {
      next[key] = value
    }
    onDefaultsChange(next)
  }

  const allFieldsMapped =
    unmappedFields.length === 0 && unmappedInterfaceFields.length === 0

  return (
    <div className="space-y-4">
      {allFieldsMapped ? (
        <Alert className="status-info">
          <Info className="h-4 w-4" />
          <AlertDescription>
            All mandatory fields are mapped from CSV columns. No defaults needed.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="status-info">
          <Info className="h-4 w-4" />
          <AlertDescription>
            The following mandatory fields are not mapped from CSV columns. Set default
            values here. Click <strong>Use form value</strong> to reuse what is already
            selected in the Add Device form, or pick a different value from the
            dropdown.
          </AlertDescription>
        </Alert>
      )}

      {!allFieldsMapped && (
        <div className="grid grid-cols-2 gap-4">
          {unmappedFields.map(field => {
            const config = getFieldConfig(field, dropdownData)
            if (!config) return null

            const currentValue = defaults[field] ?? ''

            // Location gets a special searchable input
            if (config.isLocation) {
              return (
                <LocationDefaultField
                  key={field}
                  items={config.items as LocationItem[]}
                  value={currentValue}
                  formDefaults={formDefaults}
                  onChange={val => handleChange(field, val)}
                />
              )
            }

            const formValueDisplay = getFormValueDisplay(field, formDefaults)
            const formValue = getFormValue(field, formDefaults)

            return (
              <div key={field} className="space-y-2">
                <Label className="text-xs font-medium text-gray-600">
                  {config.label}
                  <span className="text-blue-500 ml-1">*</span>
                </Label>

                {/* Quick button to use form value */}
                {formValueDisplay && (
                  <button
                    type="button"
                    className={`w-full text-left text-xs px-3 py-1.5 rounded border transition-colors ${
                      currentValue === formValue
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                    onClick={() => {
                      if (formValue) handleChange(field, formValue)
                    }}
                  >
                    Use form value: <strong>{formValueDisplay}</strong>
                  </button>
                )}

                {/* Full dropdown for all values */}
                <Select
                  value={currentValue || NO_DEFAULT}
                  onValueChange={val =>
                    handleChange(field, val === NO_DEFAULT ? '' : val)
                  }
                >
                  <SelectTrigger className="h-8 text-sm bg-white border-gray-300 shadow-sm">
                    <SelectValue
                      placeholder={`Select default ${config.label.toLowerCase()}...`}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_DEFAULT}>
                      <span className="text-gray-400">
                        -- No default (required in CSV) --
                      </span>
                    </SelectItem>
                    {config.items.map(item => {
                      const itemObj = item as {
                        id: string
                        name?: string
                        display?: string
                        model?: string
                      }
                      const label =
                        itemObj.display || itemObj.name || itemObj.model || itemObj.id
                      return (
                        <SelectItem key={itemObj.id} value={itemObj.id}>
                          {label}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            )
          })}
        </div>
      )}

      {!allFieldsMapped && unmappedInterfaceFields.length > 0 && (
        <div className="space-y-4 pt-2 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Default Interface Settings
          </p>
          <Alert className="status-info py-2">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              IP addresses are mapped but no interface columns exist. Configure a
              default interface that will be created for each device.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 gap-4">
            {unmappedInterfaceFields.map(field => {
              const currentValue = defaults[field] ?? ''

              if (field === 'interface_name') {
                return (
                  <div key={field} className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600">
                      Interface Name <span className="text-blue-500 ml-1">*</span>
                    </Label>
                    <Input
                      className="h-8 text-sm bg-white border-gray-300 shadow-sm"
                      placeholder="e.g. Management0"
                      value={currentValue}
                      onChange={e => handleChange(field, e.target.value)}
                    />
                  </div>
                )
              }

              if (field === 'interface_type') {
                return (
                  <div key={field} className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600">
                      Interface Type <span className="text-blue-500 ml-1">*</span>
                    </Label>
                    <Select
                      value={currentValue || NO_DEFAULT}
                      onValueChange={val =>
                        handleChange(field, val === NO_DEFAULT ? '' : val)
                      }
                    >
                      <SelectTrigger className="h-8 text-sm bg-white border-gray-300 shadow-sm">
                        <SelectValue placeholder="Select interface type..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_DEFAULT}>
                          <span className="text-gray-400">-- Select type --</span>
                        </SelectItem>
                        {dropdownData.interfaceTypes.map(t => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.display_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )
              }

              if (field === 'interface_status') {
                return (
                  <div key={field} className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600">
                      Interface Status <span className="text-blue-500 ml-1">*</span>
                    </Label>
                    <Select
                      value={currentValue || NO_DEFAULT}
                      onValueChange={val =>
                        handleChange(field, val === NO_DEFAULT ? '' : val)
                      }
                    >
                      <SelectTrigger className="h-8 text-sm bg-white border-gray-300 shadow-sm">
                        <SelectValue placeholder="Select interface status..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_DEFAULT}>
                          <span className="text-gray-400">-- Select status --</span>
                        </SelectItem>
                        {dropdownData.interfaceStatuses.map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.display || s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )
              }

              if (field === 'interface_namespace') {
                return (
                  <div key={field} className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600">
                      IP Namespace <span className="text-blue-500 ml-1">*</span>
                    </Label>
                    <Select
                      value={currentValue || NO_DEFAULT}
                      onValueChange={val =>
                        handleChange(field, val === NO_DEFAULT ? '' : val)
                      }
                    >
                      <SelectTrigger className="h-8 text-sm bg-white border-gray-300 shadow-sm">
                        <SelectValue placeholder="Select namespace..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_DEFAULT}>
                          <span className="text-gray-400">-- Select namespace --</span>
                        </SelectItem>
                        {dropdownData.namespaces.map(n => (
                          <SelectItem key={n.id} value={n.id}>
                            {n.display || n.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )
              }

              return null
            })}
          </div>
        </div>
      )}

      {/* Prefix Configuration — always shown */}
      <div className="space-y-3 pt-2 border-t border-gray-200">
        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
          Prefix Configuration
        </p>
        <div className="flex items-center gap-3">
          <Checkbox
            id="csv-add-prefix"
            checked={prefixConfig.addPrefix}
            onCheckedChange={checked =>
              onPrefixConfigChange({ ...prefixConfig, addPrefix: checked === true })
            }
          />
          <Label
            htmlFor="csv-add-prefix"
            className="text-sm font-normal cursor-pointer"
          >
            Automatically create parent prefix if missing
          </Label>
        </div>
        {prefixConfig.addPrefix && (
          <div className="flex items-center gap-3">
            <Label className="text-xs font-medium text-gray-600 w-28 shrink-0">
              Prefix length
            </Label>
            <Select
              value={prefixConfig.defaultPrefixLength}
              onValueChange={val =>
                onPrefixConfigChange({ ...prefixConfig, defaultPrefixLength: val })
              }
            >
              <SelectTrigger className="h-8 text-sm bg-white border-gray-300 shadow-sm w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PREFIX_LENGTH_OPTIONS.map(opt => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Form Data — Tags & Custom Fields */}
      <div className="space-y-3 pt-2 border-t border-gray-200">
        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
          Form Data
        </p>
        {hasFormTags || hasFormCustomFields ? (
          <div className="space-y-2">
            {hasFormTags && (
              <div className="flex items-center gap-3">
                <Checkbox
                  id="csv-apply-tags"
                  checked={applyFormTags}
                  onCheckedChange={checked => onApplyFormTagsChange(checked === true)}
                />
                <Label
                  htmlFor="csv-apply-tags"
                  className="text-sm font-normal cursor-pointer"
                >
                  Apply Tags ({formDefaults.selectedTags!.length} selected) to all
                  imported devices
                </Label>
              </div>
            )}
            {hasFormCustomFields && (
              <div className="flex items-center gap-3">
                <Checkbox
                  id="csv-apply-cf"
                  checked={applyFormCustomFields}
                  onCheckedChange={checked =>
                    onApplyFormCustomFieldsChange(checked === true)
                  }
                />
                <Label
                  htmlFor="csv-apply-cf"
                  className="text-sm font-normal cursor-pointer"
                >
                  Apply Custom Fields ({cfCount} configured) to all imported devices
                </Label>
              </div>
            )}
          </div>
        ) : (
          <Alert className="status-info">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              You can apply tags and custom fields to all imported devices by
              configuring them in the <strong>Add Device</strong> form before starting
              the import wizard.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )
}
