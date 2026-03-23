'use client'

import { useCallback, useMemo } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info } from 'lucide-react'
import { useSearchableDropdown } from '../hooks/use-searchable-dropdown'
import { SearchableDropdownInput } from './searchable-dropdown-input'
import { buildLocationHierarchy } from '../utils'
import type { LocationItem, NautobotDropdownsResponse } from '../types'
import type { FormDefaults } from '../hooks/use-csv-import'

const FORM_VALUE_PREFIX = '__form__'
const NO_DEFAULT = '__none__'

interface CsvImportDefaultsStepProps {
  unmappedFields: readonly string[]
  defaults: Record<string, string>
  onDefaultsChange: (defaults: Record<string, string>) => void
  formDefaults: FormDefaults
  dropdownData: NautobotDropdownsResponse
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
    case 'device_type': return formDefaults.deviceTypeName || null
    case 'role': return formDefaults.roleName || null
    case 'status': return formDefaults.statusName || null
    case 'location': return formDefaults.locationName || null
    case 'platform': return formDefaults.platformName || null
    default: return null
  }
}

function getFormValue(field: string, formDefaults: FormDefaults): string | null {
  switch (field) {
    case 'device_type': return formDefaults.deviceType || null
    case 'role': return formDefaults.role || null
    case 'status': return formDefaults.status || null
    case 'location': return formDefaults.location || null
    case 'platform': return formDefaults.platform || null
    default: return null
  }
}

// Location field needs its own component because it uses hooks
interface LocationDefaultFieldProps {
  items: LocationItem[]
  value: string
  formDefaults: FormDefaults
  onChange: (value: string) => void
}

function LocationDefaultField({ items, value, formDefaults, onChange }: LocationDefaultFieldProps) {
  const hierarchicalItems = useMemo(
    () => buildLocationHierarchy(items),
    [items]
  )

  const filterPredicate = useCallback(
    (item: LocationItem, query: string) =>
      (item.hierarchicalPath ?? item.name).toLowerCase().includes(query),
    []
  )

  const formValueDisplay = getFormValueDisplay('location', formDefaults)
  const formValue = getFormValue('location', formDefaults)

  // If the current value is a form value marker, use the actual form value for the dropdown
  const effectiveValue = value === `${FORM_VALUE_PREFIX}location` && formValue
    ? formValue
    : value

  const locationDropdown = useSearchableDropdown({
    items: hierarchicalItems,
    selectedId: effectiveValue || '',
    onSelect: onChange,
    getDisplayText: (item) => item.hierarchicalPath ?? item.name,
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
        renderItem={(item) => <span>{item.hierarchicalPath ?? item.name}</span>}
        getItemKey={(item) => item.id}
      />
    </div>
  )
}

export function CsvImportDefaultsStep({
  unmappedFields,
  defaults,
  onDefaultsChange,
  formDefaults,
  dropdownData,
}: CsvImportDefaultsStepProps) {
  const handleChange = (key: string, value: string) => {
    const next = { ...defaults }
    if (!value || value === NO_DEFAULT) {
      delete next[key]
    } else {
      next[key] = value
    }
    onDefaultsChange(next)
  }

  if (unmappedFields.length === 0) {
    return (
      <Alert className="status-info">
        <Info className="h-4 w-4" />
        <AlertDescription>
          All mandatory fields are mapped from CSV columns. No defaults needed.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <Alert className="status-info">
        <Info className="h-4 w-4" />
        <AlertDescription>
          The following mandatory fields are not mapped from CSV columns. Set default values here.
          You can use the current form values or select specific values.
        </AlertDescription>
      </Alert>

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
                onChange={(val) => handleChange(field, val)}
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
                onValueChange={(val) => handleChange(field, val === NO_DEFAULT ? '' : val)}
              >
                <SelectTrigger className="h-8 text-sm bg-white border-gray-300 shadow-sm">
                  <SelectValue placeholder={`Select default ${config.label.toLowerCase()}...`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_DEFAULT}>
                    <span className="text-gray-400">-- No default (required in CSV) --</span>
                  </SelectItem>
                  {config.items.map((item) => {
                    const itemObj = item as { id: string; name?: string; display?: string; model?: string }
                    const label = itemObj.display || itemObj.name || itemObj.model || itemObj.id
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
    </div>
  )
}
