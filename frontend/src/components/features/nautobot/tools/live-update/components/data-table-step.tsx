'use client'

import { useMemo } from 'react'
import { Loader2, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DEVICE_NAME_FIELD_KEY, LIVE_UPDATE_FIELDS } from '../constants'
import type { LiveUpdateRow } from '../types'

interface DataTableStepProps {
  rows: LiveUpdateRow[]
  filteredRows: LiveUpdateRow[]
  deviceFilter: string
  onDeviceFilterChange: (value: string) => void
  fieldMapping: Record<string, string | null>
  selectedDeviceCount: number
  isRowSelected: (rowId: string) => boolean
  toggleRowSelected: (rowId: string) => void
  toggleSelectAllVisible: () => void
  primaryIpByDevice: Record<string, string | null>
  setPrimaryIp: (deviceName: string, rowId: string) => void
  canGoBack: boolean
  onBack: () => void
  onUpdateDevices: () => void
  isSubmitting: boolean
}

export function DataTableStep({
  rows,
  filteredRows,
  deviceFilter,
  onDeviceFilterChange,
  fieldMapping,
  selectedDeviceCount,
  isRowSelected,
  toggleRowSelected,
  toggleSelectAllVisible,
  primaryIpByDevice,
  setPrimaryIp,
  canGoBack,
  onBack,
  onUpdateDevices,
  isSubmitting,
}: DataTableStepProps) {
  const extraColumns = useMemo(() => {
    const mappedKeys = new Set(
      Object.values(fieldMapping).filter(
        (value): value is string => Boolean(value) && value !== DEVICE_NAME_FIELD_KEY
      )
    )
    return LIVE_UPDATE_FIELDS.filter(field => mappedKeys.has(field.key))
  }, [fieldMapping])

  const allVisibleSelected = useMemo(
    () => filteredRows.length > 0 && filteredRows.every(row => isRowSelected(row.id)),
    [filteredRows, isRowSelected]
  )

  return (
    <div className="space-y-4">
      <div className="relative w-72">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Filter by device name…"
          value={deviceFilter}
          onChange={e => onDeviceFilterChange(e.target.value)}
        />
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">No data available</p>
          <p className="text-sm mt-1">
            No rows were produced from the mapped columns. Go back and check the mapping.
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={toggleSelectAllVisible}
                    aria-label="Select all visible rows"
                  />
                </TableHead>
                <TableHead>Device</TableHead>
                {extraColumns.map(field => (
                  <TableHead key={field.key}>{field.label}</TableHead>
                ))}
                <TableHead>Use as Primary IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map(row => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Checkbox
                      checked={isRowSelected(row.id)}
                      onCheckedChange={() => toggleRowSelected(row.id)}
                      aria-label={`Select ${row.deviceName || row.id}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{row.deviceName || '—'}</TableCell>
                  {extraColumns.map(field => (
                    <TableCell key={field.key} className="text-muted-foreground">
                      {row.fields[field.key] || '—'}
                    </TableCell>
                  ))}
                  <TableCell>
                    <input
                      type="radio"
                      className="h-4 w-4 accent-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                      name={`primary-ip-${row.deviceName}`}
                      disabled={!row.hasIpAddress}
                      checked={primaryIpByDevice[row.deviceName] === row.id}
                      onChange={() => setPrimaryIp(row.deviceName, row.id)}
                      aria-label={`Use ${row.fields.interface_ip_address ?? ''} as primary IP for ${row.deviceName}`}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center gap-2">
        {canGoBack && (
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
        )}
        <Button
          onClick={onUpdateDevices}
          disabled={selectedDeviceCount === 0 || isSubmitting}
        >
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Update Devices{' '}
          {selectedDeviceCount > 0
            ? `(${selectedDeviceCount} device${selectedDeviceCount !== 1 ? 's' : ''} selected)`
            : ''}
        </Button>
      </div>
    </div>
  )
}
