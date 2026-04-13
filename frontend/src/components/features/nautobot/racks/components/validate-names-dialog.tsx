'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { CheckCircle2, XCircle, Loader2, ShieldCheck, ArrowRight, Pencil } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useApi } from '@/hooks/use-api'
import { applyNameTransform } from '../utils/name-transform'
import type { RackFaceAssignments, RackDevice, MatchingStrategy, NameTransform } from '../types'

interface NautobotDeviceListItem {
  id: string
  name: string
}

interface ValidationEntry {
  deviceId: string
  deviceName: string
  lookupName: string
  found: boolean
  matchedName?: string
}

interface ValidateNamesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  localFront: RackFaceAssignments
  localRear: RackFaceAssignments
  localUnpositioned: RackDevice[]
  selectedLocationId: string
  matchingStrategy: MatchingStrategy
  nameTransform: NameTransform | null
  /** Called with a map of deviceId → matchedName for all found entries. */
  onApplyNames: (renames: Map<string, string>) => void
}

const STRATEGY_LABELS: Record<MatchingStrategy, string> = {
  exact: 'Exact match',
  contains: 'Contains',
  starts_with: 'Starts with',
}

function applyMatchingStrategy(
  items: NautobotDeviceListItem[],
  lookupName: string,
  strategy: MatchingStrategy
): NautobotDeviceListItem | undefined {
  if (strategy === 'exact') return items.find(d => d.name === lookupName)
  if (strategy === 'contains') return items.find(d => d.name.includes(lookupName))
  return items.find(d => d.name.startsWith(lookupName))
}

export function ValidateNamesDialog({
  open,
  onOpenChange,
  localFront,
  localRear,
  localUnpositioned,
  selectedLocationId,
  matchingStrategy,
  nameTransform,
  onApplyNames,
}: ValidateNamesDialogProps) {
  const { apiCall } = useApi()
  const [results, setResults] = useState<ValidationEntry[]>([])
  const [isValidating, setIsValidating] = useState(false)

  // Collect unique devices across all rack faces and unpositioned list
  const uniqueDevices = useMemo(() => {
    const seen = new Map<string, { deviceId: string; deviceName: string }>()
    for (const slot of Object.values(localFront)) {
      if (slot && !seen.has(slot.deviceId))
        seen.set(slot.deviceId, { deviceId: slot.deviceId, deviceName: slot.deviceName })
    }
    for (const slot of Object.values(localRear)) {
      if (slot && !seen.has(slot.deviceId))
        seen.set(slot.deviceId, { deviceId: slot.deviceId, deviceName: slot.deviceName })
    }
    for (const d of localUnpositioned) {
      if (!seen.has(d.id))
        seen.set(d.id, { deviceId: d.id, deviceName: d.name })
    }
    return [...seen.values()]
  }, [localFront, localRear, localUnpositioned])

  const runValidation = useCallback(async () => {
    if (uniqueDevices.length === 0) {
      setResults([])
      return
    }
    setIsValidating(true)
    setResults([])

    try {
      const entries = await Promise.all(
        uniqueDevices.map(async ({ deviceId, deviceName }) => {
          const lookupName = applyNameTransform(deviceName, nameTransform)
          const params = new URLSearchParams({ name_ic: lookupName })
          if (selectedLocationId) params.append('location_id', selectedLocationId)

          const result = await apiCall<NautobotDeviceListItem[] | { devices?: NautobotDeviceListItem[] }>(
            `nautobot/devices?${params.toString()}`
          )
          const items = Array.isArray(result)
            ? result
            : (result as { devices?: NautobotDeviceListItem[] }).devices ?? []

          const matched = applyMatchingStrategy(items, lookupName, matchingStrategy)
          return {
            deviceId,
            deviceName,
            lookupName,
            found: !!matched,
            matchedName: matched?.name,
          } satisfies ValidationEntry
        })
      )

      // Sort: not-found first, then alphabetically within each group
      entries.sort((a, b) => {
        if (a.found !== b.found) return a.found ? 1 : -1
        return a.deviceName.localeCompare(b.deviceName)
      })

      setResults(entries)
    } finally {
      setIsValidating(false)
    }
  }, [uniqueDevices, nameTransform, matchingStrategy, selectedLocationId, apiCall])

  // Auto-run validation whenever the dialog opens
  useEffect(() => {
    if (open) runValidation()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const foundCount = results.filter(r => r.found).length
  const notFoundCount = results.filter(r => !r.found).length
  const showTransformColumn = results.some(r => r.lookupName !== r.deviceName)

  // Only entries where the matched Nautobot name differs from the current device name
  const renamedCount = results.filter(
    r => r.found && r.matchedName && r.matchedName !== r.deviceName
  ).length

  const handleApplyNames = useCallback(() => {
    const renames = new Map<string, string>()
    for (const entry of results) {
      if (entry.found && entry.matchedName) {
        renames.set(entry.deviceId, entry.matchedName)
      }
    }
    onApplyNames(renames)
    onOpenChange(false)
  }, [results, onApplyNames, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-500" />
            Validate Device Names
          </DialogTitle>
        </DialogHeader>

        {/* Settings summary */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 pb-3 border-b border-gray-100">
          <span>Matching strategy:</span>
          <Badge variant="outline" className="text-xs font-normal">
            {STRATEGY_LABELS[matchingStrategy]}
          </Badge>
          {nameTransform?.pattern ? (
            <>
              <span className="text-gray-300">·</span>
              <span>Name transform:</span>
              <Badge variant="outline" className="text-xs font-normal font-mono">
                {nameTransform.mode === 'regex' ? 'regex' : 'replace'}: {nameTransform.pattern}
              </Badge>
            </>
          ) : (
            <>
              <span className="text-gray-300">·</span>
              <span className="text-gray-400 italic">No name transform</span>
            </>
          )}
        </div>

        {/* Loading state */}
        {isValidating && (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin" />
            <span className="text-sm">Checking {uniqueDevices.length} device(s) against Nautobot…</span>
          </div>
        )}

        {/* Empty rack */}
        {!isValidating && uniqueDevices.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No devices in the current rack view to validate.
          </div>
        )}

        {/* Results table */}
        {!isValidating && results.length > 0 && (
          <>
            {/* Summary */}
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1.5 text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                {foundCount} found
              </span>
              {notFoundCount > 0 && (
                <span className="flex items-center gap-1.5 text-red-600">
                  <XCircle className="h-4 w-4" />
                  {notFoundCount} not found
                </span>
              )}
            </div>

            <div className="rounded-md border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-600 w-5" />
                    <th className="text-left px-3 py-2 font-medium text-gray-600">
                      Device name (in rack)
                    </th>
                    {showTransformColumn && (
                      <>
                        <th className="w-5" />
                        <th className="text-left px-3 py-2 font-medium text-gray-600">
                          Lookup name
                        </th>
                      </>
                    )}
                    <th className="text-left px-3 py-2 font-medium text-gray-600">
                      Nautobot match
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {results.map(entry => (
                    <tr
                      key={entry.deviceId}
                      className={entry.found ? '' : 'bg-red-50/40'}
                    >
                      <td className="px-3 py-2 text-center">
                        {entry.found ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 inline" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-red-500 inline" />
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-gray-700">
                        {entry.deviceName}
                      </td>
                      {showTransformColumn && (
                        <>
                          <td className="text-center text-gray-300">
                            {entry.lookupName !== entry.deviceName && (
                              <ArrowRight className="h-3 w-3 inline" />
                            )}
                          </td>
                          <td className="px-3 py-2 font-mono text-blue-700">
                            {entry.lookupName !== entry.deviceName ? entry.lookupName : ''}
                          </td>
                        </>
                      )}
                      <td className="px-3 py-2 font-mono">
                        {entry.found ? (
                          <span className="text-green-700">{entry.matchedName}</span>
                        ) : (
                          <span className="text-red-400 italic">not found</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Footer */}
        <DialogFooter className="flex items-center justify-between gap-2 pt-4 border-t border-gray-100 mt-2">
          <div>
            {!isValidating && foundCount > 0 && (
              <Button
                onClick={handleApplyNames}
                className="gap-2"
              >
                <Pencil className="h-4 w-4" />
                Apply Names
                {renamedCount > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {renamedCount} rename{renamedCount !== 1 ? 's' : ''}
                  </Badge>
                )}
              </Button>
            )}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
