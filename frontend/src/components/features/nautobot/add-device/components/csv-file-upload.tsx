'use client'

import { useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, XCircle } from 'lucide-react'

interface CSVFileUploadProps {
  csvFile: File | null
  isParsing: boolean
  isImporting: boolean
  parseError: string
  onFileSelect: (file: File) => void
}

export function CSVFileUpload({
  csvFile,
  isParsing,
  isImporting,
  parseError,
  onFileSelect,
}: CSVFileUploadProps) {
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        onFileSelect(file)
      }
    },
    [onFileSelect]
  )

  return (
    <div className="space-y-3">
      {/* File Input */}
      <div className="space-y-3">
        <Label htmlFor="csv-file" className="text-sm font-medium">
          Select CSV File
        </Label>
        <div className="flex items-center gap-3">
          <Input
            id="csv-file"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={isParsing || isImporting}
            className="flex-1"
          />
          {csvFile && (
            <span className="text-sm text-muted-foreground">
              {(csvFile.size / 1024).toFixed(1)} KB
            </span>
          )}
        </div>
      </div>

      {/* Parsing Status */}
      {isParsing && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Parsing CSV file...</span>
        </div>
      )}

      {/* Parse Error */}
      {parseError && (
        <Alert className="status-error">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{parseError}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
