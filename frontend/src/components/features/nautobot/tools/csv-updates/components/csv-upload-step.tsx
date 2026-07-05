'use client'

import { useRef } from 'react'
import { Upload, FileSpreadsheet, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusBadge } from '@/components/shared/status-badge'
import type { ObjectType, CSVConfig, ParsedCSVData, ValidationResult } from '../types'
import { OBJECT_TYPE_LABELS } from '../constants'

interface CsvUploadStepProps {
  objectType: ObjectType
  onObjectTypeChange: (type: ObjectType) => void
  csvConfig: CSVConfig
  onConfigChange: (updates: Partial<CSVConfig>) => void
  csvFile: File | null
  parsedData: ParsedCSVData
  validationResults: ValidationResult[]
  validationSummary: {
    errorCount: number
    warningCount: number
    successCount: number
    hasErrors: boolean
    isValid: boolean
  }
  isParsing: boolean
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onParseCSV: () => void
  onClear: () => void
}

const OBJECT_TYPE_OPTIONS: ObjectType[] = [
  'devices',
  'ip-prefixes',
  'ip-addresses',
  'locations',
]

export function CsvUploadStep({
  objectType,
  onObjectTypeChange,
  csvConfig,
  onConfigChange,
  csvFile,
  parsedData,
  validationResults,
  validationSummary,
  isParsing,
  onFileChange,
  onParseCSV,
  onClear,
}: CsvUploadStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-6">
      {/* Object Type */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Object Type</Label>
        <Select
          value={objectType}
          onValueChange={v => onObjectTypeChange(v as ObjectType)}
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OBJECT_TYPE_OPTIONS.map(type => (
              <SelectItem key={type} value={type}>
                {OBJECT_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* File Upload */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">CSV File</Label>
        {csvFile ? (
          <div className="flex items-center gap-3 p-3 border rounded-md bg-info border-info-border">
            <FileSpreadsheet className="h-5 w-5 text-info-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-info-foreground truncate">
                {csvFile.name}
              </p>
              <p className="text-xs text-info-foreground">
                {(csvFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-7 w-7 p-0 text-info-foreground hover:opacity-80"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div
            className="border-2 border-dashed border-border rounded-md p-8 text-center cursor-pointer hover:border-info-border hover:bg-info transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Click to select a CSV file</p>
            <p className="text-xs text-muted-foreground mt-1">Accepts .csv files</p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={onFileChange}
        />
      </div>

      {/* CSV Config */}
      <div className="flex items-end gap-4">
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">Delimiter</Label>
          <Input
            className="h-8 text-sm w-20"
            value={csvConfig.delimiter}
            onChange={e => onConfigChange({ delimiter: e.target.value })}
            placeholder=","
            maxLength={5}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">Quote Character</Label>
          <Input
            className="h-8 text-sm w-20"
            value={csvConfig.quoteChar}
            onChange={e => onConfigChange({ quoteChar: e.target.value })}
            placeholder='"'
            maxLength={1}
          />
        </div>
        {csvFile && (
          <Button onClick={onParseCSV} disabled={isParsing} className="h-8">
            {isParsing ? 'Parsing...' : 'Parse CSV'}
          </Button>
        )}
      </div>

      {/* Parse Results */}
      {parsedData.rowCount > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">{parsedData.headers.length} columns</Badge>
            <Badge variant="secondary">{parsedData.rowCount} rows</Badge>
            {validationSummary.errorCount > 0 && (
              <Badge variant="destructive">{validationSummary.errorCount} errors</Badge>
            )}
            {validationSummary.warningCount > 0 && (
              <StatusBadge variant="warning">
                {validationSummary.warningCount} warnings
              </StatusBadge>
            )}
            {validationSummary.isValid && (
              <StatusBadge variant="success">Valid</StatusBadge>
            )}
          </div>

          {validationResults.length > 0 && (
            <div className="border rounded-md max-h-40 overflow-y-auto">
              {validationResults.map(result => (
                <div
                  key={`${result.type}-${result.rowNumber ?? ''}-${result.message}`}
                  className={`px-3 py-1.5 text-xs border-b last:border-0 ${
                    result.type === 'error'
                      ? 'bg-error text-error-foreground'
                      : result.type === 'warning'
                        ? 'bg-warning text-warning-foreground'
                        : 'bg-success text-success-foreground'
                  }`}
                >
                  {result.rowNumber ? `Row ${result.rowNumber}: ` : ''}
                  {result.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Hint when file selected but not parsed */}
      {csvFile && parsedData.rowCount === 0 && !isParsing && (
        <Alert>
          <AlertDescription className="text-sm">
            Click <strong>Parse CSV</strong> to analyze the file and check for errors.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
