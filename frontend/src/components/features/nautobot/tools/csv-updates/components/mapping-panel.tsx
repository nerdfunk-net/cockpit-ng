import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type { ObjectType } from '../types'

interface MappingPanelProps {
  objectType: ObjectType
  csvHeaders: string[]
  columnMapping: Record<string, string>
  onColumnMappingChange: (mapping: Record<string, string>) => void
}

// Define required lookup fields for each object type
const LOOKUP_FIELDS: Record<ObjectType, { field: string; label: string; required: boolean }[]> = {
  'ip-prefixes': [
    { field: 'prefix', label: 'Prefix', required: true },
    { field: 'namespace', label: 'Namespace', required: true },
  ],
  'devices': [
    { field: 'name', label: 'Name', required: true },
    { field: 'ip_address', label: 'IP Address', required: false },
  ],
  'ip-addresses': [
    { field: 'address', label: 'Address', required: true },
    { field: 'parent__namespace__name', label: 'Parent Namespace Name', required: false },
  ],
  'locations': [
    { field: 'name', label: 'Name', required: true },
    { field: 'parent__name', label: 'Parent Name', required: false },
  ],
}

export function MappingPanel({
  objectType,
  csvHeaders,
  columnMapping,
  onColumnMappingChange,
}: MappingPanelProps) {
  const [isOpen, setIsOpen] = useState(false)

  const lookupFields = LOOKUP_FIELDS[objectType] || []

  // Validation: Check if all required fields are mapped
  const missingRequiredFields = lookupFields
    .filter(field => field.required && !columnMapping[field.field])
    .map(field => field.label)

  const hasErrors = missingRequiredFields.length > 0

  const handleMappingChange = (lookupField: string, csvColumn: string) => {
    const newMapping = { ...columnMapping }
    if (csvColumn === '__none__') {
      delete newMapping[lookupField]
    } else {
      newMapping[lookupField] = csvColumn
    }
    onColumnMappingChange(newMapping)
  }

  const mappedCount = Object.keys(columnMapping).length
  const totalFields = lookupFields.length

  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white rounded-t-lg">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full py-2 px-4 flex items-center justify-between hover:bg-white/10 text-white rounded-t-lg"
            >
              <div className="flex items-center space-x-2">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <span className="text-sm font-medium">Lookup Field Mapping</span>
                {hasErrors && <AlertTriangle className="h-4 w-4 text-yellow-300" />}
              </div>
              <span className="text-xs text-white/80">
                {mappedCount} of {totalFields} fields mapped
              </span>
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-6">
            {/* Info */}
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="space-y-2 flex-1">
                <p className="text-xs text-muted-foreground">
                  Map CSV columns to lookup fields used for identifying and updating {objectType}.
                  These fields are used to find existing objects in Nautobot.
                </p>
              </div>
            </div>

            {/* Validation Errors */}
            {hasErrors && (
              <Alert className="border-yellow-500 bg-yellow-50">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-xs">
                  <strong>Required fields missing:</strong> {missingRequiredFields.join(', ')}
                  <div className="mt-1">Please map all required lookup fields before processing updates.</div>
                </AlertDescription>
              </Alert>
            )}

            {/* Mapping Fields */}
            <div className="space-y-4">
              {lookupFields.map(({ field, label, required }) => (
                <div key={field} className="space-y-2">
                  <Label htmlFor={`mapping-${field}`} className="text-xs font-medium">
                    {label}
                    {required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  <Select
                    value={columnMapping[field] || '__none__'}
                    onValueChange={(value) => handleMappingChange(field, value)}
                  >
                    <SelectTrigger
                      id={`mapping-${field}`}
                      className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
                    >
                      <SelectValue placeholder="Select CSV column..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        <span className="text-muted-foreground">-- Not mapped --</span>
                      </SelectItem>
                      {csvHeaders.map((header) => (
                        <SelectItem key={header} value={header}>
                          <span className="font-mono text-xs">{header}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {columnMapping[field] && (
                    <p className="text-xs text-muted-foreground">
                      Mapped to: <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{columnMapping[field]}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Summary */}
            <Alert className="bg-blue-50 border-blue-200">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-xs">
                <strong>How it works:</strong> The mapped CSV columns will be used to identify existing {objectType} in Nautobot.
                For example, if you map &quot;Prefix&quot; to CSV column &quot;network&quot;, the system will use the &quot;network&quot; column
                values to find and update the corresponding prefixes.
              </AlertDescription>
            </Alert>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
