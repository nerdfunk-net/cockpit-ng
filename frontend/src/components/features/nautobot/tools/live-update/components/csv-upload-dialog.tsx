'use client'

import { useCallback, useRef, useState } from 'react'
import { FileSpreadsheet, Loader2, Upload, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { StatusAlert } from '@/components/shared/status-alert'
import { parseCSVContent } from '@/components/features/nautobot/shared/csv/utils/csv-parser'
import { CSV_CONFIG } from '../constants'
import type { ParsedCsvSource } from '../types'

interface CsvUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onParsed: (source: ParsedCsvSource) => void
}

export function CsvUploadDialog({ open, onOpenChange, onParsed }: CsvUploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0]
    if (selected) {
      setFile(selected)
      setError(null)
    }
  }, [])

  const handleClose = useCallback(() => {
    setFile(null)
    setError(null)
    setIsParsing(false)
    onOpenChange(false)
  }, [onOpenChange])

  const handleParse = useCallback(async () => {
    if (!file) return

    setIsParsing(true)
    setError(null)

    try {
      const text = await file.text()
      const { headers, rows } = parseCSVContent(text, CSV_CONFIG)
      onParsed({ headers, rows })
      setFile(null)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV file')
    } finally {
      setIsParsing(false)
    }
  }, [file, onParsed, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload CSV File</DialogTitle>
          <DialogDescription>
            Select a CSV file whose first line contains column names.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {file ? (
            <div className="flex items-center gap-3 p-3 border rounded-md bg-info border-info-border">
              <FileSpreadsheet className="h-5 w-5 text-info-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-info-foreground truncate">
                  {file.name}
                </p>
                <p className="text-xs text-info-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFile(null)}
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
            onChange={handleFileChange}
          />

          {error && <StatusAlert variant="error">{error}</StatusAlert>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleParse} disabled={!file || isParsing}>
            {isParsing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isParsing ? 'Parsing…' : 'Parse CSV'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
