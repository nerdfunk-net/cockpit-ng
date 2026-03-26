'use client'

import { Key } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CsvFieldMappingPanel } from './csv-field-mapping-panel'
import type { ObjectType } from '../types'

interface CsvConfigureStepProps {
  objectType: ObjectType
  headers: string[]
  /** Which CSV column is used to look up objects in Nautobot */
  primaryKeyColumn: string
  onPrimaryKeyColumnChange: (col: string) => void
  /** CSV column → Nautobot field name (null = not used) */
  fieldMapping: Record<string, string | null>
  onFieldMappingChange: (mapping: Record<string, string | null>) => void
  /** How to handle the tags field when present */
  tagsMode: 'replace' | 'merge'
  onTagsModeChange: (mode: 'replace' | 'merge') => void
}

function PrimaryKeySelector({
  headers,
  primaryKeyColumn,
  onPrimaryKeyColumnChange,
}: {
  headers: string[]
  primaryKeyColumn: string
  onPrimaryKeyColumnChange: (col: string) => void
}) {
  return (
    <div className="border rounded-md p-4 space-y-3 bg-amber-50 border-amber-200">
      <div className="flex items-center gap-2">
        <Key className="h-4 w-4 text-amber-600 flex-shrink-0" />
        <Label className="text-sm font-medium text-amber-900">Identify objects by</Label>
      </div>
      <p className="text-xs text-amber-700">
        Select which CSV column is used to look up existing objects in Nautobot.
        Use <code className="bg-amber-100 px-1 rounded">id</code> for exact UUID match, or a
        name / address column for lookup by value.
      </p>
      <Select value={primaryKeyColumn} onValueChange={onPrimaryKeyColumnChange}>
        <SelectTrigger className="w-64 bg-white border-amber-300">
          <SelectValue placeholder="Select a column…" />
        </SelectTrigger>
        <SelectContent>
          {headers.map(h => (
            <SelectItem key={h} value={h}>
              <code className="text-xs font-mono">{h}</code>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function CsvConfigureStep({
  objectType,
  headers,
  primaryKeyColumn,
  onPrimaryKeyColumnChange,
  fieldMapping,
  onFieldMappingChange,
  tagsMode,
  onTagsModeChange,
}: CsvConfigureStepProps) {
  const hasTagsColumn = Object.values(fieldMapping).includes('tags')

  return (
    <div className="space-y-4">
      {/* 1. Primary key selector */}
      <PrimaryKeySelector
        headers={headers}
        primaryKeyColumn={primaryKeyColumn}
        onPrimaryKeyColumnChange={onPrimaryKeyColumnChange}
      />

      {/* 2. Field mapping table */}
      <CsvFieldMappingPanel
        objectType={objectType}
        headers={headers}
        fieldMapping={fieldMapping}
        onFieldMappingChange={onFieldMappingChange}
      />

      {/* 3. Tags mode — only shown when a column is mapped to 'tags' */}
      {hasTagsColumn && (
        <div className="border rounded-md p-4 space-y-3">
          <Label className="text-sm font-medium">Tags Handling</Label>
          <p className="text-xs text-muted-foreground">
            Choose how the mapped tags column is applied to existing objects.
          </p>
          <RadioGroup
            value={tagsMode}
            onValueChange={v => onTagsModeChange(v as 'replace' | 'merge')}
            className="space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="replace" id="tags-replace" />
              <Label htmlFor="tags-replace" className="text-sm font-normal cursor-pointer">
                <span className="font-medium">Replace</span> — overwrite all existing tags
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="merge" id="tags-merge" />
              <Label htmlFor="tags-merge" className="text-sm font-normal cursor-pointer">
                <span className="font-medium">Merge</span> — add to existing tags (no duplicates)
              </Label>
            </div>
          </RadioGroup>
        </div>
      )}
    </div>
  )
}
