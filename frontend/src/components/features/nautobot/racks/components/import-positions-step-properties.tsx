'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  Search,
  Pencil,
  FlaskConical,
  ArrowRight,
  AlertTriangle,
  Trash2,
  Database,
  MapPin,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useLocationTypesQuery, buildLocationTypeOptions } from '../hooks/use-location-types-query'
import type { MatchingStrategy, NameTransform, NameTransformMode } from '../types'

/**
 * Client-side mirror of the name transform logic.
 * Returns { result, error } — error is set when the pattern is invalid regex.
 */
function applyTransformClient(
  name: string,
  transform: NameTransform
): { result: string; error: string | null } {
  const pattern = transform.pattern.trim()
  if (!pattern) return { result: name, error: null }
  try {
    if (transform.mode === 'regex') {
      const rx = new RegExp(pattern)
      const m = rx.exec(name)
      if (m) {
        return { result: m[1] !== undefined ? m[1] : m[0], error: null }
      }
      return { result: name, error: null }
    }
    // replace mode
    const rx = new RegExp(pattern, 'g')
    return { result: name.replace(rx, transform.replacement), error: null }
  } catch (e) {
    return { result: name, error: e instanceof Error ? e.message : String(e) }
  }
}

const MATCHING_STRATEGY_OPTIONS: {
  value: MatchingStrategy
  label: string
  description: string
}[] = [
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

const EMPTY_LOCATION_TYPES: unknown[] = []

interface ImportPositionsStepPropertiesProps {
  clearRackBeforeImport: boolean
  onClearRackBeforeImportChange: (value: boolean) => void
  useMappingFromDb: boolean
  onUseMappingFromDbChange: (value: boolean) => void
  loadDevicesUpToLocationTypeId: string | null
  onLoadDevicesUpToChange: (id: string | null) => void
  matchingStrategy: MatchingStrategy
  onMatchingStrategyChange: (strategy: MatchingStrategy) => void
  nameTransform: NameTransform | null
  onNameTransformChange: (t: NameTransform | null) => void
  csvNameValues: string[]
}

export function ImportPositionsStepProperties({
  clearRackBeforeImport,
  onClearRackBeforeImportChange,
  useMappingFromDb,
  onUseMappingFromDbChange,
  loadDevicesUpToLocationTypeId,
  onLoadDevicesUpToChange,
  matchingStrategy,
  onMatchingStrategyChange,
  nameTransform,
  onNameTransformChange,
  csvNameValues,
}: ImportPositionsStepPropertiesProps) {
  const [tryModalOpen, setTryModalOpen] = useState(false)
  const { data: locationTypes = EMPTY_LOCATION_TYPES } = useLocationTypesQuery()
  const locationTypeOptions = useMemo(() => buildLocationTypeOptions(locationTypes), [locationTypes])

  const tryResults = useMemo(() => {
    if (!tryModalOpen || !nameTransform?.pattern) return []
    return csvNameValues.map(name => ({
      original: name,
      ...applyTransformClient(name, nameTransform),
    }))
  }, [tryModalOpen, nameTransform, csvNameValues])

  const handleNameTransformModeChange = useCallback(
    (mode: NameTransformMode) => {
      onNameTransformChange({
        mode,
        pattern: nameTransform?.pattern ?? '',
        replacement: '',
      })
    },
    [nameTransform, onNameTransformChange]
  )

  const handleNameTransformPatternChange = useCallback(
    (pattern: string) => {
      if (!pattern) {
        onNameTransformChange(null)
        return
      }
      onNameTransformChange({
        mode: nameTransform?.mode ?? 'regex',
        pattern,
        replacement: nameTransform?.replacement ?? '',
      })
    },
    [nameTransform, onNameTransformChange]
  )

  const handleNameTransformReplacementChange = useCallback(
    (replacement: string) => {
      onNameTransformChange({
        mode: nameTransform?.mode ?? 'replace',
        pattern: nameTransform?.pattern ?? '',
        replacement,
      })
    },
    [nameTransform, onNameTransformChange]
  )

  return (
    <div className="space-y-4">
      {/* Matching Strategy */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Search className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-800">Matching Strategy</h3>
        </div>
        <p className="text-xs text-gray-500">
          How to find the device in Nautobot using the (transformed) name from the CSV.
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

      {/* Load devices up to */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <MapPin className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-800">Load devices up to</h3>
        </div>
        <p className="text-xs text-gray-500">
          Widen the device search to include all devices at this level of the location hierarchy or
          below. Use this when a device&apos;s Nautobot location is a parent of the rack&apos;s
          location.
        </p>
        <Select
          value={loadDevicesUpToLocationTypeId ?? '__none__'}
          onValueChange={v => onLoadDevicesUpToChange(v === '__none__' ? null : v)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__" className="text-xs text-gray-500">
              Rack location only
            </SelectItem>
            {locationTypeOptions.map(opt => (
              <SelectItem key={opt.id} value={opt.id} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Customize Name */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Pencil className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-800">Customize Name</h3>
        </div>
        <p className="text-xs text-gray-500">
          Transform the CSV name value before it is used to look up the device in Nautobot.
          Leave <span className="font-medium text-gray-700">Pattern</span> empty to skip
          transformation.
        </p>

        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 items-center">
          <Label className="text-xs text-gray-600 whitespace-nowrap">Mode</Label>
          <Select
            value={nameTransform?.mode ?? 'regex'}
            onValueChange={v => handleNameTransformModeChange(v as NameTransformMode)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="regex" className="text-xs">
                Regular Expression
              </SelectItem>
              <SelectItem value="replace" className="text-xs">
                Replace
              </SelectItem>
            </SelectContent>
          </Select>

          <Label className="text-xs text-gray-600 whitespace-nowrap">Pattern</Label>
          <Input
            value={nameTransform?.pattern ?? ''}
            onChange={e => handleNameTransformPatternChange(e.target.value)}
            placeholder={
              (nameTransform?.mode ?? 'regex') === 'regex'
                ? 'e.g. ^.*(?=-\\d+$)'
                : 'e.g. -\\d+$'
            }
            className="h-8 text-xs font-mono"
          />

          {nameTransform?.mode === 'replace' && (
            <>
              <Label className="text-xs text-gray-600 whitespace-nowrap">Replacement</Label>
              <Input
                value={nameTransform.replacement}
                onChange={e => handleNameTransformReplacementChange(e.target.value)}
                placeholder="Leave empty to delete the match"
                className="h-8 text-xs font-mono"
              />
            </>
          )}
        </div>

        {nameTransform?.pattern && (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-blue-600">
              {nameTransform.mode === 'regex'
                ? 'The first match (or captured group) will replace the original name.'
                : `Matches of the pattern will be replaced with "${
                    nameTransform.replacement || '(empty)'
                  }".`}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs gap-1 shrink-0"
              disabled={csvNameValues.length === 0}
              title={
                csvNameValues.length === 0 ? 'No CSV data loaded' : 'Preview transform results'
              }
              onClick={() => setTryModalOpen(true)}
            >
              <FlaskConical className="h-3.5 w-3.5" />
              Try
            </Button>
          </div>
        )}
      </div>

      {/* Try-out modal */}
      <Dialog open={tryModalOpen} onOpenChange={setTryModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <FlaskConical className="h-4 w-4 text-blue-500" />
              Name Transform Preview
            </DialogTitle>
          </DialogHeader>

          <div className="text-xs text-gray-500 mb-3">
            Mode:{' '}
            <span className="font-medium text-gray-700">
              {nameTransform?.mode === 'regex' ? 'Regular Expression' : 'Replace'}
            </span>
            {' · '}Pattern:{' '}
            <code className="font-mono bg-gray-100 px-1 rounded">{nameTransform?.pattern}</code>
            {nameTransform?.mode === 'replace' && (
              <>
                {' · '}Replacement:{' '}
                <code className="font-mono bg-gray-100 px-1 rounded">
                  {nameTransform.replacement || '(empty)'}
                </code>
              </>
            )}
          </div>

          {tryResults.some(r => r.error) && (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 mb-3">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="font-medium">Invalid pattern:</span>{' '}
                {tryResults.find(r => r.error)?.error}
              </span>
            </div>
          )}

          <div className="max-h-96 overflow-y-auto rounded-md border border-gray-200">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 w-1/2">
                    Original (CSV)
                  </th>
                  <th className="w-5" />
                  <th className="text-left px-3 py-2 font-medium text-gray-600 w-1/2">
                    Result (used for lookup)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tryResults.map(row => {
                  const changed = row.result !== row.original && !row.error
                  return (
                    <tr key={row.original} className={changed ? 'bg-blue-50/40' : ''}>
                      <td className="px-3 py-1.5 font-mono text-gray-700">{row.original}</td>
                      <td className="text-center text-gray-400">
                        <ArrowRight className="h-3 w-3 inline" />
                      </td>
                      <td
                        className={`px-3 py-1.5 font-mono ${
                          row.error
                            ? 'text-red-500 italic'
                            : changed
                              ? 'text-blue-700 font-medium'
                              : 'text-gray-400'
                        }`}
                      >
                        {row.error ? 'error' : row.result}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-400 mt-1">
            {tryResults.filter(r => r.result !== r.original && !r.error).length} of{' '}
            {tryResults.length} names will be transformed.
          </p>
        </DialogContent>
      </Dialog>

      {/* Clear rack before import */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
        <div className="flex items-start gap-3">
          <Checkbox
            id="clear-rack"
            checked={clearRackBeforeImport}
            onCheckedChange={checked => onClearRackBeforeImportChange(checked === true)}
            className="mt-0.5"
          />
          <div className="space-y-1">
            <Label
              htmlFor="clear-rack"
              className="text-sm font-medium cursor-pointer flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4 text-gray-500" />
              Clear rack before import
            </Label>
            <p className="text-xs text-muted-foreground">
              When enabled, all devices are removed from the rack before the CSV data is applied.
              When disabled, CSV assignments are overlaid on top of the existing rack layout.
            </p>
          </div>
        </div>
      </div>

      {/* Use Mapping from DB */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
        <div className="flex items-start gap-3">
          <Checkbox
            id="use-mapping-db"
            checked={useMappingFromDb}
            onCheckedChange={checked => onUseMappingFromDbChange(checked === true)}
            className="mt-0.5"
          />
          <div className="space-y-1">
            <Label
              htmlFor="use-mapping-db"
              className="text-sm font-medium cursor-pointer flex items-center gap-2"
            >
              <Database className="h-4 w-4 text-gray-500" />
              Use Mapping from DB
            </Label>
            <p className="text-xs text-muted-foreground">
              When enabled, previously saved name mappings are applied automatically to
              resolve CSV device names that cannot be found directly in Nautobot.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
