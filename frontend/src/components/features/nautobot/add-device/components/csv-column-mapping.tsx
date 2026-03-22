'use client'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CSVParseResult, NAUTOBOT_DEVICE_FIELDS, NAUTOBOT_INTERFACE_FIELDS } from '../types'

interface CSVColumnMappingProps {
  parseResult: CSVParseResult
  columnMappings: Record<string, string>
  onUpdateMapping: (csvColumn: string, nautobotField: string) => void
  onApplyMappings: () => void
}

const ALL_NAUTOBOT_FIELDS = [
  ...NAUTOBOT_DEVICE_FIELDS.map((f) => ({ ...f, key: f.key, isInterface: false })),
  ...NAUTOBOT_INTERFACE_FIELDS.map((f) => ({ ...f, key: `interface_${f.key}`, isInterface: true })),
]

function getMappingLabel(value: string): string {
  if (value === 'unmapped') return '-- Unmapped --'
  if (value.startsWith('cf_')) return `[Custom] ${value.substring(3)}`
  const field = ALL_NAUTOBOT_FIELDS.find((f) => f.key === value)
  if (field) {
    return field.isInterface ? `[Interface] ${field.label}` : field.label
  }
  return value
}

export function CSVColumnMapping({
  parseResult,
  columnMappings,
  onUpdateMapping,
  onApplyMappings,
}: CSVColumnMappingProps) {
  return (
    <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">Column Mapping</h4>
        <Button size="sm" variant="outline" onClick={onApplyMappings}>
          Apply & Re-parse
        </Button>
      </div>
      <div className="max-h-60 overflow-y-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-2 font-medium">CSV Column</th>
              <th className="text-left py-2 px-2 font-medium">Nautobot Property</th>
            </tr>
          </thead>
          <tbody>
            {parseResult.headers.map((header) => (
              <tr key={header} className="border-b last:border-b-0">
                <td className="py-2 px-2">
                  <span className="font-mono bg-muted px-2 py-1 rounded">{header}</span>
                </td>
                <td className="py-2 px-2">
                  <Select
                    value={columnMappings[header] || 'unmapped'}
                    onValueChange={(value) => onUpdateMapping(header, value)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue>
                        {getMappingLabel(columnMappings[header] || 'unmapped')}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unmapped">-- Unmapped --</SelectItem>
                      {header.startsWith('cf_') && (
                        <SelectItem value={header}>
                          {`[Custom] ${header.substring(3)}`}
                        </SelectItem>
                      )}
                      {ALL_NAUTOBOT_FIELDS.map((field) => (
                        <SelectItem key={field.key} value={field.key}>
                          {field.isInterface ? `[Interface] ${field.label}` : field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
