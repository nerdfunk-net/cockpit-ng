'use client'

import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CheckCircle2, Circle } from 'lucide-react'

const NOT_USED = '__not_used__'

interface CsvField {
  key: string
  label: string
}

interface CsvFieldMappingPanelProps {
  /** Available Nautobot fields to map to. */
  fields: CsvField[]
  headers: string[]
  fieldMapping: Record<string, string | null>
  onFieldMappingChange: (mapping: Record<string, string | null>) => void
}

export function CsvFieldMappingPanel({
  fields,
  headers,
  fieldMapping,
  onFieldMappingChange,
}: CsvFieldMappingPanelProps) {
  const getFieldLabel = (key: string): string => {
    const found = fields.find(f => f.key === key)
    return found ? found.label : key
  }

  const handleChange = (csvCol: string, value: string) => {
    onFieldMappingChange({
      ...fieldMapping,
      [csvCol]: value === NOT_USED ? null : value,
    })
  }

  const { mappedCount, unmappedCount } = useMemo(() => {
    const mapped = Object.values(fieldMapping).filter(v => v !== null).length
    return { mappedCount: mapped, unmappedCount: headers.length - mapped }
  }, [fieldMapping, headers.length])

  if (headers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No CSV headers available. Upload and parse a file first.
      </p>
    )
  }

  return (
    <div className="shadow-lg border-0 p-0 bg-card rounded-lg">
      {/* Header bar */}
      <div className="panel-header py-2 px-4 flex items-center justify-between rounded-t-lg">
        <span className="text-sm font-medium">Column → Field Mapping</span>
        <div className="flex items-center gap-2 text-xs text-panel-header-muted">
          {mappedCount > 0 && (
            <span className="bg-card/20 rounded px-1.5 py-0.5">
              {mappedCount} mapped
            </span>
          )}
          {unmappedCount > 0 && (
            <span className="bg-card/10 rounded px-1.5 py-0.5">
              {unmappedCount} not used
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="max-h-[45vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card z-10 border-b">
            <tr>
              <th className="text-left py-2 px-3 text-muted-foreground font-medium w-[45%]">
                CSV Column
              </th>
              <th className="text-left py-2 px-3 text-muted-foreground font-medium w-[55%]">
                Nautobot Field
              </th>
            </tr>
          </thead>
          <tbody>
            {headers.map(header => {
              const mapped = fieldMapping[header]
              const selectValue =
                mapped === null || mapped === undefined ? NOT_USED : mapped
              const isMapped = selectValue !== NOT_USED

              return (
                <tr key={header} className="border-b last:border-0 hover:bg-muted">
                  {/* CSV column */}
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1.5">
                      {isMapped ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-success-foreground flex-shrink-0" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
                      )}
                      <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                        {header}
                      </span>
                    </div>
                  </td>

                  {/* Nautobot field selector */}
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <Select
                        value={selectValue}
                        onValueChange={val => handleChange(header, val)}
                      >
                        <SelectTrigger className="h-7 text-xs flex-1">
                          <SelectValue>
                            {isMapped ? (
                              getFieldLabel(selectValue)
                            ) : (
                              <span className="text-muted-foreground italic">
                                Not Used
                              </span>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            value={NOT_USED}
                            className="text-muted-foreground italic text-xs"
                          >
                            Not Used
                          </SelectItem>
                          {fields.map(field => (
                            <SelectItem
                              key={field.key}
                              value={field.key}
                              className="text-xs"
                            >
                              {field.label}
                              <span className="ml-1.5 text-muted-foreground font-mono text-[10px]">
                                ({field.key})
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {isMapped && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1 py-0 h-4 text-primary border-info-border flex-shrink-0 font-mono"
                        >
                          {selectValue}
                        </Badge>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
