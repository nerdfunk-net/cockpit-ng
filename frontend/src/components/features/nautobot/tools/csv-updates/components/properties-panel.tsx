import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info } from 'lucide-react'
import type { ObjectType } from '../types'

interface PropertiesPanelProps {
  objectType: ObjectType
  headers: string[]
  hasIdColumn: boolean
  ignoreUuid: boolean
  onIgnoreUuidChange: (ignore: boolean) => void
  ignoredColumns: Set<string>
  onIgnoredColumnsChange: (columns: Set<string>) => void
}

// Columns that should never be used for updates (read-only or identifiers)
const ALWAYS_IGNORED_COLUMNS: Record<ObjectType, string[]> = {
  'ip-prefixes': [
    'display',
    'id',
    'object_type',
    'natural_slug',
    'ip_version',
    'date_allocated',
    'parent__namespace__name',
    'parent__network',
    'parent__prefix_length',
    'created',
    'last_updated',
    'url',
    // Network-derived fields
    'network',
    'broadcast',
    'prefix_length',
  ],
  'devices': [
    'display',
    'id',
    'object_type',
    'natural_slug',
    'created',
    'last_updated',
    'url',
  ],
  'ip-addresses': [
    'display',
    'id',
    'object_type',
    'natural_slug',
    'ip_version',
    'created',
    'last_updated',
    'url',
  ],
  'locations': [
    'display',
    'id',
    'object_type',
    'natural_slug',
    'created',
    'last_updated',
    'url',
  ],
}

// Columns used for lookup (should not be updated)
const LOOKUP_COLUMNS: Record<ObjectType, string[]> = {
  'ip-prefixes': ['prefix', 'namespace__name', 'namespace'],
  'devices': ['name', 'ip_address'],
  'ip-addresses': ['address', 'parent__namespace__name'],
  'locations': ['name', 'parent__name'],
}

export function PropertiesPanel({
  objectType,
  headers,
  hasIdColumn,
  ignoreUuid,
  onIgnoreUuidChange,
  ignoredColumns,
  onIgnoredColumnsChange,
}: PropertiesPanelProps) {
  const alwaysIgnored = ALWAYS_IGNORED_COLUMNS[objectType] || []
  const lookupColumns = LOOKUP_COLUMNS[objectType] || []

  // Categorize columns
  const updateableHeaders = headers.filter(
    h => !alwaysIgnored.includes(h) && !lookupColumns.includes(h)
  )

  const handleColumnToggle = (column: string, isIgnored: boolean) => {
    const newIgnored = new Set(ignoredColumns)
    if (isIgnored) {
      newIgnored.add(column)
    } else {
      newIgnored.delete(column)
    }
    onIgnoredColumnsChange(newIgnored)
  }

  const selectedCount = updateableHeaders.length - ignoredColumns.size
  const totalUpdateable = updateableHeaders.length

  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Update Properties</span>
        </div>
        <span className="text-xs text-white/80">
          {selectedCount} of {totalUpdateable} columns selected
        </span>
      </div>
      <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-6">
        {/* UUID Handling - Only for IP Prefixes with ID column */}
        {objectType === 'ip-prefixes' && hasIdColumn && (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="space-y-2 flex-1">
                <Label className="text-sm font-medium">UUID Handling</Label>
                <p className="text-xs text-muted-foreground">
                  Your CSV contains an &quot;id&quot; column with UUIDs. Choose how to identify prefixes:
                </p>
              </div>
            </div>

            <RadioGroup
              value={ignoreUuid ? 'ignore' : 'use'}
              onValueChange={(value) => onIgnoreUuidChange(value === 'ignore')}
              className="space-y-2 ml-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="ignore" id="ignore-uuid" />
                <Label htmlFor="ignore-uuid" className="text-sm font-normal cursor-pointer">
                  <span className="font-medium">Ignore UUID</span> - Use prefix + namespace to find entries
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    Recommended for CSV files from other Nautobot instances
                  </span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="use" id="use-uuid" />
                <Label htmlFor="use-uuid" className="text-sm font-normal cursor-pointer">
                  <span className="font-medium">Use UUID</span> - Directly update by ID
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    Only if UUIDs match your Nautobot instance
                  </span>
                </Label>
              </div>
            </RadioGroup>
          </div>
        )}

        {/* Column Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Columns to Update</Label>
          <p className="text-xs text-muted-foreground">
            Select which columns should be used to update {objectType}. Uncheck columns you want to ignore.
          </p>

          {updateableHeaders.length === 0 ? (
            <Alert>
              <AlertDescription>
                No updateable columns found in CSV. All columns are either read-only or used for lookup.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="border rounded-md bg-white">
              <div className="max-h-64 overflow-y-auto p-3 space-y-2">
                {updateableHeaders.map((header) => {
                  const isIgnored = ignoredColumns.has(header)
                  return (
                    <div key={header} className="flex items-start space-x-2">
                      <Checkbox
                        id={`column-${header}`}
                        checked={!isIgnored}
                        onCheckedChange={(checked) =>
                          handleColumnToggle(header, !checked)
                        }
                        className="mt-0.5"
                      />
                      <Label
                        htmlFor={`column-${header}`}
                        className="text-sm font-normal cursor-pointer flex-1"
                      >
                        <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                          {header}
                        </span>
                      </Label>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Info about ignored columns */}
          {(alwaysIgnored.length > 0 || lookupColumns.length > 0) && (
            <Alert className="bg-blue-50 border-blue-200">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-xs">
                <strong>Auto-ignored columns:</strong>
                <div className="mt-1 space-y-1">
                  {lookupColumns.length > 0 && (
                    <div>
                      <span className="font-medium">Lookup fields:</span>{' '}
                      <span className="font-mono">{lookupColumns.join(', ')}</span>
                    </div>
                  )}
                  {alwaysIgnored.length > 0 && (
                    <div>
                      <span className="font-medium">Read-only fields:</span>{' '}
                      <span className="font-mono">
                        {alwaysIgnored.slice(0, 5).join(', ')}
                        {alwaysIgnored.length > 5 && ` +${alwaysIgnored.length - 5} more`}
                      </span>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  )
}
