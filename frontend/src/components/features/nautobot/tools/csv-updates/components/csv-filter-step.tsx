'use client'

import { useMemo } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DEVICE_NAME_FIELD_KEY, NAUTOBOT_UPDATE_FIELDS } from '../constants'
import type { FilterRow, ObjectType } from '../types'

interface CsvFilterStepProps {
  objectType: ObjectType
  fieldMapping: Record<string, string | null>
  primaryKeyColumn: string
  filteredRows: FilterRow[]
  rowFilter: string
  onRowFilterChange: (value: string) => void
  isRowSelected: (rowId: string) => boolean
  toggleRowSelected: (rowId: string) => void
  toggleSelectAllVisible: () => void
  primaryIpEnabled: boolean
  primaryIpByDevice: Record<string, string | null>
  onSetPrimaryIp: (deviceName: string, rowId: string) => void
}

export function CsvFilterStep({
  objectType,
  fieldMapping,
  primaryKeyColumn,
  filteredRows,
  rowFilter,
  onRowFilterChange,
  isRowSelected,
  toggleRowSelected,
  toggleSelectAllVisible,
  primaryIpEnabled,
  primaryIpByDevice,
  onSetPrimaryIp,
}: CsvFilterStepProps) {
  const showPrimaryIpColumn = objectType === 'devices' && primaryIpEnabled

  const identifierFieldKey = useMemo(
    () => (objectType === 'devices' ? DEVICE_NAME_FIELD_KEY : fieldMapping[primaryKeyColumn]),
    [objectType, fieldMapping, primaryKeyColumn]
  )

  const extraColumns = useMemo(() => {
    const availableFields = NAUTOBOT_UPDATE_FIELDS[objectType] ?? []
    const mappedKeys = new Set(
      Object.values(fieldMapping).filter(
        (value): value is string => Boolean(value) && value !== identifierFieldKey
      )
    )
    return availableFields.filter(field => mappedKeys.has(field.key))
  }, [objectType, fieldMapping, identifierFieldKey])

  const allVisibleSelected = useMemo(
    () => filteredRows.length > 0 && filteredRows.every(row => isRowSelected(row.id)),
    [filteredRows, isRowSelected]
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Checkbox
          checked={allVisibleSelected}
          onCheckedChange={toggleSelectAllVisible}
          aria-label="Select all visible rows"
        />
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Filter rows…"
            value={rowFilter}
            onChange={e => onRowFilterChange(e.target.value)}
          />
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">No data available</p>
          <p className="text-sm mt-1">
            No rows matched the current mapping/filter. Go back and check the mapping.
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Name</TableHead>
                {extraColumns.map(field => (
                  <TableHead key={field.key}>{field.label}</TableHead>
                ))}
                {showPrimaryIpColumn && <TableHead>Use as Primary IP</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map(row => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Checkbox
                      checked={isRowSelected(row.id)}
                      onCheckedChange={() => toggleRowSelected(row.id)}
                      aria-label={`Select ${row.displayName || row.id}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{row.displayName || '—'}</TableCell>
                  {extraColumns.map(field => (
                    <TableCell key={field.key} className="text-muted-foreground">
                      {row.fields[field.key] || '—'}
                    </TableCell>
                  ))}
                  {showPrimaryIpColumn && (
                    <TableCell>
                      <input
                        type="radio"
                        className="h-4 w-4 accent-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                        name={`primary-ip-${row.displayName}`}
                        disabled={!row.hasIpAddress}
                        checked={primaryIpByDevice[row.displayName] === row.id}
                        onChange={() => onSetPrimaryIp(row.displayName, row.id)}
                        aria-label={`Use ${row.fields.interface_ip_address ?? ''} as primary IP for ${row.displayName}`}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
