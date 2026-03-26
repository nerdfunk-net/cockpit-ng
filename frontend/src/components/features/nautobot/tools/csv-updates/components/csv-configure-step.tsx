'use client'

import { Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { MappingPanel } from './mapping-panel'
import { PropertiesPanel } from './properties-panel'
import { LegacyMappingPanel } from './legacy-mapping-panel'
import { getRequiredHeaders } from '../utils/csv-parser'
import type { ObjectType } from '../types'

interface CsvConfigureStepProps {
  objectType: ObjectType
  headers: string[]
  ignoreUuid: boolean
  onIgnoreUuidChange: (v: boolean) => void
  ignoredColumns: Set<string>
  onIgnoredColumnsChange: (cols: Set<string>) => void
  tagsMode: 'replace' | 'merge'
  onTagsModeChange: (mode: 'replace' | 'merge') => void
  columnMapping: Record<string, string>
  onColumnMappingChange: (mapping: Record<string, string>) => void
  isLegacyFormat: boolean
  legacyMapping: Record<string, string>
  onLegacyMappingChange: (mapping: Record<string, string>) => void
}

const REQUIRED_HEADERS_DESCRIPTIONS: Record<string, string> = {
  name: 'Device name (used to identify the device)',
  id: 'Nautobot UUID (optional, used if available)',
  device_type__model: 'Device type model name',
  location__name: 'Location name',
  location_type__name: 'Location type name',
  'namespace__name': 'Namespace name',
  'parent__namespace__name': 'Parent namespace name',
  prefix: 'IP prefix (e.g. 192.168.1.0/24)',
  address: 'IP address (e.g. 192.168.1.1/24)',
}

export function CsvConfigureStep({
  objectType,
  headers,
  ignoreUuid,
  onIgnoreUuidChange,
  ignoredColumns,
  onIgnoredColumnsChange,
  tagsMode,
  onTagsModeChange,
  columnMapping,
  onColumnMappingChange,
  isLegacyFormat,
  legacyMapping,
  onLegacyMappingChange,
}: CsvConfigureStepProps) {
  const hasIdColumn = headers.includes('id')
  const hasTagsColumn = headers.includes('tags')
  const requiredHeaders = getRequiredHeaders(objectType)

  // Devices and Locations: just show info about expected headers
  if (objectType === 'devices' || objectType === 'locations') {
    return (
      <div className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            No additional configuration needed for <strong>{objectType}</strong>. Objects are
            identified by the <code className="bg-slate-100 px-1 rounded">name</code> or{' '}
            <code className="bg-slate-100 px-1 rounded">id</code> column. All other columns
            will be used to update matching objects.
          </AlertDescription>
        </Alert>

        <div className="border rounded-md p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">Expected CSV headers</p>
          <div className="flex flex-wrap gap-2">
            {requiredHeaders.map(h => (
              <div key={h} className="flex items-center gap-1.5">
                <Badge
                  variant={headers.includes(h) ? 'default' : 'outline'}
                  className={
                    headers.includes(h)
                      ? 'bg-green-100 text-green-800 border-green-300'
                      : 'border-red-300 text-red-700'
                  }
                >
                  {h}
                </Badge>
                {REQUIRED_HEADERS_DESCRIPTIONS[h] && (
                  <span className="text-xs text-gray-500">
                    — {REQUIRED_HEADERS_DESCRIPTIONS[h]}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <PropertiesPanel
          objectType={objectType}
          headers={headers}
          hasIdColumn={hasIdColumn}
          ignoreUuid={ignoreUuid}
          onIgnoreUuidChange={onIgnoreUuidChange}
          ignoredColumns={ignoredColumns}
          onIgnoredColumnsChange={onIgnoredColumnsChange}
          hasTagsColumn={hasTagsColumn}
          tagsMode={tagsMode}
          onTagsModeChange={onTagsModeChange}
        />
      </div>
    )
  }

  // IP Addresses: show legacy mapping panel if legacy format, otherwise PropertiesPanel
  if (objectType === 'ip-addresses') {
    return (
      <div className="space-y-4">
        {isLegacyFormat ? (
          <LegacyMappingPanel
            objectType={objectType}
            csvHeaders={headers}
            legacyMapping={legacyMapping}
            onLegacyMappingChange={onLegacyMappingChange}
          />
        ) : (
          <PropertiesPanel
            objectType={objectType}
            headers={headers}
            hasIdColumn={hasIdColumn}
            ignoreUuid={ignoreUuid}
            onIgnoreUuidChange={onIgnoreUuidChange}
            ignoredColumns={ignoredColumns}
            onIgnoredColumnsChange={onIgnoredColumnsChange}
            hasTagsColumn={hasTagsColumn}
            tagsMode={tagsMode}
            onTagsModeChange={onTagsModeChange}
          />
        )}
      </div>
    )
  }

  // IP Prefixes: MappingPanel + PropertiesPanel
  return (
    <div className="space-y-4">
      <MappingPanel
        objectType={objectType}
        csvHeaders={headers}
        columnMapping={columnMapping}
        onColumnMappingChange={onColumnMappingChange}
      />
      <PropertiesPanel
        objectType={objectType}
        headers={headers}
        hasIdColumn={hasIdColumn}
        ignoreUuid={ignoreUuid}
        onIgnoreUuidChange={onIgnoreUuidChange}
        ignoredColumns={ignoredColumns}
        onIgnoredColumnsChange={onIgnoredColumnsChange}
        hasTagsColumn={hasTagsColumn}
        tagsMode={tagsMode}
        onTagsModeChange={onTagsModeChange}
      />
    </div>
  )
}
