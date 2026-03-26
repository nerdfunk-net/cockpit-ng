'use client'

import { useCallback } from 'react'
import { Plus, Minus, Settings2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { NAUTOBOT_UPDATE_FIELDS } from '../constants'
import type { MatchingStrategy, DefaultProperty, ObjectType } from '../types'

const MATCHING_STRATEGY_OPTIONS: { value: MatchingStrategy; label: string; description: string }[] =
  [
    {
      value: 'exact',
      label: 'Exact match',
      description: 'Device name must match exactly (e.g. "lab-003.local")',
    },
    {
      value: 'contains',
      label: 'Contains',
      description: 'Match any device whose name contains the given value (e.g. "lab-003")',
    },
    {
      value: 'starts_with',
      label: 'Starts with',
      description: 'Match any device whose name starts with the given value (e.g. "lab-003")',
    },
  ]

interface CsvPropertiesStepProps {
  objectType: ObjectType
  primaryKeyColumn: string
  matchingStrategy: MatchingStrategy
  onMatchingStrategyChange: (strategy: MatchingStrategy) => void
  defaultProperties: DefaultProperty[]
  onDefaultPropertiesChange: (props: DefaultProperty[]) => void
}

export function CsvPropertiesStep({
  objectType,
  primaryKeyColumn,
  matchingStrategy,
  onMatchingStrategyChange,
  defaultProperties,
  onDefaultPropertiesChange,
}: CsvPropertiesStepProps) {
  const availableFields = NAUTOBOT_UPDATE_FIELDS[objectType] ?? []

  const showMatchingStrategy = primaryKeyColumn === 'name'

  const handleAddProperty = useCallback(() => {
    onDefaultPropertiesChange([...defaultProperties, { field: '', value: '' }])
  }, [defaultProperties, onDefaultPropertiesChange])

  const handleRemoveProperty = useCallback(
    (index: number) => {
      onDefaultPropertiesChange(defaultProperties.filter((_, i) => i !== index))
    },
    [defaultProperties, onDefaultPropertiesChange]
  )

  const handlePropertyFieldChange = useCallback(
    (index: number, field: string) => {
      onDefaultPropertiesChange(
        defaultProperties.map((p, i) => (i === index ? { ...p, field } : p))
      )
    },
    [defaultProperties, onDefaultPropertiesChange]
  )

  const handlePropertyValueChange = useCallback(
    (index: number, value: string) => {
      onDefaultPropertiesChange(
        defaultProperties.map((p, i) => (i === index ? { ...p, value } : p))
      )
    },
    [defaultProperties, onDefaultPropertiesChange]
  )

  return (
    <div className="space-y-6">
      {/* Matching Strategy */}
      {showMatchingStrategy && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Search className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-gray-800">Matching Strategy</h3>
          </div>
          <p className="text-xs text-gray-500">
            How to find the device in Nautobot when the primary key is{' '}
            <span className="font-medium text-gray-700">name</span>.
          </p>

          <div className="space-y-2">
            {MATCHING_STRATEGY_OPTIONS.map(option => (
              <label
                key={option.value}
                className={`flex items-start gap-3 cursor-pointer rounded-md border p-3 transition-colors ${
                  matchingStrategy === option.value
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="matching-strategy"
                  value={option.value}
                  checked={matchingStrategy === option.value}
                  onChange={() => onMatchingStrategyChange(option.value)}
                  className="mt-0.5 accent-blue-600"
                />
                <div>
                  <span className="text-sm font-medium text-gray-800">{option.label}</span>
                  <p className="text-xs text-gray-500 mt-0.5">{option.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Default Properties */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-gray-800">Default Properties</h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddProperty}
            className="h-7 px-2 text-xs gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>
        <p className="text-xs text-gray-500">
          Set default values for fields that are not included in your CSV. These values are
          applied to every row during the import.
        </p>

        {defaultProperties.length === 0 ? (
          <div className="text-xs text-gray-400 italic py-2 text-center">
            No default properties configured. Click <strong>Add</strong> to define one.
          </div>
        ) : (
          <div className="space-y-2">
            {/* Header row */}
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-1">
              <Label className="text-xs text-gray-500">Field</Label>
              <Label className="text-xs text-gray-500">Default value</Label>
              <span className="w-7" />
            </div>

            {defaultProperties.map((prop, index) => (
              <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                <Select
                  value={prop.field}
                  onValueChange={value => handlePropertyFieldChange(index, value)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select field…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFields.map(f => (
                      <SelectItem key={f.key} value={f.key} className="text-xs">
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  value={prop.value}
                  onChange={e => handlePropertyValueChange(index, e.target.value)}
                  placeholder="Value…"
                  className="h-8 text-xs"
                />

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveProperty(index)}
                  className="h-7 w-7 text-gray-400 hover:text-red-500"
                  title="Remove"
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info box when matching strategy is not shown */}
      {!showMatchingStrategy && (
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          <span className="font-medium">Note:</span> Matching Strategy is only configurable
          when <span className="font-medium">name</span> is selected as the primary key
          column. Currently using{' '}
          <span className="font-medium">{primaryKeyColumn || 'no primary key'}</span>.
        </div>
      )}
    </div>
  )
}
