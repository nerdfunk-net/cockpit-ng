'use client'

import { Key } from 'lucide-react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CsvFieldMappingPanel } from '../../shared/csv/components/csv-field-mapping-panel'
import { RACK_IMPORT_FIELDS } from '../constants'

const NOT_USED_SENTINEL = '--not-used--'

interface ImportPositionsStepMappingProps {
  headers: string[]
  deviceNameColumn: string | null
  onDeviceNameColumnChange: (col: string | null) => void
  fieldMapping: Record<string, string | null>
  onFieldMappingChange: (mapping: Record<string, string | null>) => void
}

export function ImportPositionsStepMapping({
  headers,
  deviceNameColumn,
  onDeviceNameColumnChange,
  fieldMapping,
  onFieldMappingChange,
}: ImportPositionsStepMappingProps) {
  return (
    <div className="space-y-4">
      {/* Device Name Column */}
      <div className="border rounded-md p-4 space-y-3 bg-warning border-warning-border">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-warning-foreground flex-shrink-0" />
          <Label className="text-sm font-medium text-warning-foreground">
            Device Name Column
          </Label>
        </div>
        <p className="text-xs text-warning-foreground">
          Select which CSV column contains the device name used to look up the device in
          Nautobot.
        </p>
        <Select
          value={deviceNameColumn ?? NOT_USED_SENTINEL}
          onValueChange={v =>
            onDeviceNameColumnChange(v === NOT_USED_SENTINEL ? null : v)
          }
        >
          <SelectTrigger className="w-64 bg-card border-warning-border">
            <SelectValue placeholder="Select a column…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              value={NOT_USED_SENTINEL}
              className="text-muted-foreground italic text-xs"
            >
              Not selected
            </SelectItem>
            {headers.map(h => (
              <SelectItem key={h} value={h}>
                <code className="text-xs font-mono">{h}</code>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Field Mapping */}
      <CsvFieldMappingPanel
        fields={[...RACK_IMPORT_FIELDS]}
        headers={headers}
        fieldMapping={fieldMapping}
        onFieldMappingChange={onFieldMappingChange}
      />
    </div>
  )
}
