'use client'

import { useRef } from 'react'
import { Upload, FileSpreadsheet, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { CSVConfig, ParsedCSVData } from '../../shared/csv/types'

interface ImportPositionsStepUploadProps {
  csvFile: File | null
  csvConfig: CSVConfig
  parsedData: ParsedCSVData
  isParsing: boolean
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onConfigChange: (updates: Partial<CSVConfig>) => void
  onParseCSV: () => void
  onClear: () => void
}

export function ImportPositionsStepUpload({
  csvFile,
  csvConfig,
  parsedData,
  isParsing,
  onFileChange,
  onConfigChange,
  onParseCSV,
  onClear,
}: ImportPositionsStepUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-6">
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
              className="h-7 w-7 p-0 text-info-foreground hover:text-info-foreground/80"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div
            className="border-2 border-dashed border-border rounded-md p-8 text-center cursor-pointer hover:border-primary hover:bg-info transition-colors"
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
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary">{parsedData.headers.length} columns</Badge>
          <Badge variant="secondary">{parsedData.rowCount} rows</Badge>
          <Badge className="bg-success text-success-foreground border-success-border">
            Ready
          </Badge>
        </div>
      )}

      {/* Hint when file selected but not parsed */}
      {csvFile && parsedData.rowCount === 0 && !isParsing && (
        <Alert>
          <AlertDescription className="text-sm">
            Click <strong>Parse CSV</strong> to analyze the file.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
