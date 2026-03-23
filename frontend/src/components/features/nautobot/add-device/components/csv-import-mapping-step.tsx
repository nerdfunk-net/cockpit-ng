'use client'

import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CSV_IMPORT_NAUTOBOT_FIELDS } from '@/components/features/jobs/templates/utils/constants'

const NOT_USED = '__not_used__'

interface CsvImportMappingStepProps {
  headers: string[]
  columnMapping: Record<string, string | null>
  onMappingChange: (mapping: Record<string, string | null>) => void
}

const DEVICE_FIELDS = CSV_IMPORT_NAUTOBOT_FIELDS['devices'] || []

export function CsvImportMappingStep({
  headers,
  columnMapping,
  onMappingChange,
}: CsvImportMappingStepProps) {
  const handleFieldChange = (csvCol: string, value: string) => {
    onMappingChange({
      ...columnMapping,
      [csvCol]: value === NOT_USED ? null : value,
    })
  }

  const mappedCount = Object.values(columnMapping).filter(v => v !== null).length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Map each CSV column to a Nautobot field. Select &quot;Not Used&quot; to skip a column.
        </p>
        {mappedCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {mappedCount} mapped
          </Badge>
        )}
      </div>

      {headers.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">
          No CSV headers available. Upload a file first.
        </p>
      ) : (
        <div className="max-h-[45vh] overflow-y-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b">
                <th className="text-left py-2 px-3 text-gray-600 font-medium w-1/2">CSV Column</th>
                <th className="text-left py-2 px-3 text-gray-600 font-medium w-1/2">Nautobot Field</th>
              </tr>
            </thead>
            <tbody>
              {headers.map((header) => {
                const mapped = columnMapping[header]
                const selectValue = mapped === null
                  ? NOT_USED
                  : (mapped && mapped.trim() !== '' ? mapped : header)
                return (
                  <tr key={header} className="border-b last:border-0">
                    <td className="py-2 px-3">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {header}
                      </Badge>
                    </td>
                    <td className="py-2 px-3">
                      <Select
                        value={selectValue}
                        onValueChange={(val) => handleFieldChange(header, val)}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NOT_USED} className="text-gray-400 italic">
                            Not Used
                          </SelectItem>
                          <SelectItem value={header}>
                            {header} (auto)
                          </SelectItem>
                          {DEVICE_FIELDS
                            .filter(f => f !== header && f.trim() !== '')
                            .map((field) => (
                              <SelectItem key={field} value={field}>
                                {field}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
