'use client'

import { useMemo } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import type { ObjectType } from '../types'

interface LegacyMappingPanelProps {
  objectType: ObjectType
  csvHeaders: string[]
  legacyMapping: Record<string, string>
  onLegacyMappingChange: (mapping: Record<string, string>) => void
}

// Nautobot field options for IP addresses
const NAUTOBOT_IP_ADDRESS_FIELDS = [
  { value: 'none', label: 'Not Used' },
  { value: 'address', label: 'address (IP Address)', required: true },
  { value: 'host', label: 'host (Hostname)' },
  { value: 'dns_name', label: 'dns_name (DNS Name)' },
  { value: 'description', label: 'description (Description/Comments)' },
  { value: 'status', label: 'status (Status)' },
  { value: 'role', label: 'role (Role)' },
  { value: 'namespace', label: 'namespace (Namespace)' },
]

export function LegacyMappingPanel({
  objectType,
  csvHeaders,
  legacyMapping,
  onLegacyMappingChange,
}: LegacyMappingPanelProps) {
  // Check if 'address' field is mapped
  const isAddressMapped = useMemo(() => {
    return Object.values(legacyMapping).includes('address')
  }, [legacyMapping])

  // Get list of already mapped fields (excluding 'none')
  const mappedFields = useMemo(() => {
    return new Set(Object.values(legacyMapping).filter(field => field !== 'none'))
  }, [legacyMapping])

  // Only support IP addresses for now
  if (objectType !== 'ip-addresses') {
    return null
  }

  const handleMappingChange = (csvColumn: string, nautobotField: string) => {
    const newMapping = { ...legacyMapping }
    
    // If selecting 'none', remove the mapping
    if (nautobotField === 'none') {
      delete newMapping[csvColumn]
    } else {
      newMapping[csvColumn] = nautobotField
    }
    
    onLegacyMappingChange(newMapping)
  }

  // Check if a field is available for selection (not already mapped by another column)
  const isFieldAvailable = (field: string, currentCsvColumn: string): boolean => {
    if (field === 'none') return true
    
    // A field is available if:
    // 1. It's not mapped by any column, OR
    // 2. It's mapped by the current column
    const mappedByCurrentColumn = legacyMapping[currentCsvColumn] === field
    return !mappedFields.has(field) || mappedByCurrentColumn
  }

  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      <div className="bg-gradient-to-r from-amber-400/80 to-amber-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Legacy CSV Format Mapping</span>
        </div>
      </div>
      <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
        <Alert className="border-amber-500 bg-amber-50">
          <AlertDescription className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-900 mb-1">Legacy CSV format detected</p>
              <p className="text-amber-800">
                This CSV file does not match the standard Nautobot format. Please map your CSV columns 
                to Nautobot fields below. The <strong>address</strong> field must be mapped.
              </p>
            </div>
          </AlertDescription>
        </Alert>

        {!isAddressMapped && (
          <Alert className="border-red-500 bg-red-50">
            <AlertDescription className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-red-800">
                <strong>Required:</strong> You must map at least one CSV column to the <strong>address</strong> field.
              </span>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4 pb-2 border-b-2 border-gray-300 font-semibold text-sm">
            <div>CSV Column</div>
            <div>Nautobot Field</div>
          </div>

          {csvHeaders.map((header) => {
            const currentMapping = legacyMapping[header] || 'none'
            
            return (
              <div key={header} className="grid grid-cols-2 gap-4 items-center">
                <Label htmlFor={`mapping-${header}`} className="text-sm font-medium truncate" title={header}>
                  {header}
                </Label>
                <Select
                  value={currentMapping}
                  onValueChange={(value) => handleMappingChange(header, value)}
                >
                  <SelectTrigger 
                    id={`mapping-${header}`} 
                    className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NAUTOBOT_IP_ADDRESS_FIELDS.map((field) => {
                      const isAvailable = isFieldAvailable(field.value, header)
                      const isRequired = field.required && field.value === 'address'
                      
                      return (
                        <SelectItem 
                          key={field.value} 
                          value={field.value}
                          disabled={!isAvailable}
                        >
                          {field.label}
                          {isRequired && <span className="text-red-500 ml-1">*</span>}
                          {!isAvailable && <span className="text-muted-foreground ml-1">(already mapped)</span>}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            )
          })}
        </div>

        {mappedFields.size > 0 && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-medium text-blue-900 mb-1">Current Mapping:</p>
            <ul className="text-sm text-blue-800 space-y-1">
              {Object.entries(legacyMapping)
                .filter(([_, field]) => field !== 'none')
                .map(([csvCol, nautobotField]) => (
                  <li key={csvCol}>
                    <strong>{csvCol}</strong> → <strong>{nautobotField}</strong>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
