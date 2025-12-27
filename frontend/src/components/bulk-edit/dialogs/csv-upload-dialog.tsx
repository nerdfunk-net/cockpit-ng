'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Info, Loader2, Eye } from 'lucide-react'
import { useApi } from '@/hooks/use-api'

interface ParsedCSV {
  headers: string[]
  rows: Array<Record<string, string>>
  rowCount: number
  hasId: boolean
  hasIdentifier: boolean
  identifierField?: 'id' | 'name' | 'ip_address'
}

interface BulkUpdateModalProps {
  open: boolean
  onClose: () => void
}

export function BulkUpdateModal({ open, onClose }: BulkUpdateModalProps) {
  const { apiCall } = useApi()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // State
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<ParsedCSV | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [showProgress, setShowProgress] = useState(false)
  
  // CSV Settings
  const [csvDelimiter, setCsvDelimiter] = useState(',')
  const [csvQuoteChar, setCsvQuoteChar] = useState('"')

  // Load CSV defaults from backend on mount
  useEffect(() => {
    const loadDefaults = async () => {
      try {
        const response = await apiCall<{
          success: boolean
          data: {
            csv_delimiter?: string
            csv_quote_char?: string
          }
        }>('settings/nautobot/defaults', {
          method: 'GET'
        })

        if (response.success && response.data) {
          if (response.data.csv_delimiter) {
            setCsvDelimiter(response.data.csv_delimiter)
          }
          if (response.data.csv_quote_char) {
            setCsvQuoteChar(response.data.csv_quote_char)
          }
        }
      } catch (error) {
        console.error('Failed to load CSV defaults:', error)
        // Use hardcoded defaults on error
      }
    }

    if (open) {
      loadDefaults()
    }
  }, [open, apiCall])

  // CSV Parsing
  const parseCSV = useCallback(async (file: File) => {
    setIsParsing(true)
    setParseError(null)
    setParsedData(null)

    try {
      const text = await file.text()
      const lines = text.trim().split('\n')

      if (lines.length < 2) {
        throw new Error('CSV file must contain at least a header row and one data row')
      }

      // Helper to split CSV line respecting quotes
      const splitCSVLine = (line: string): string[] => {
        const result: string[] = []
        let current = ''
        let inQuotes = false
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i]
          
          if (char === csvQuoteChar) {
            inQuotes = !inQuotes
          } else if (char === csvDelimiter && !inQuotes) {
            result.push(current.trim())
            current = ''
          } else {
            current += char
          }
        }
        result.push(current.trim())
        return result
      }

      // Parse headers
      const headers = splitCSVLine(lines[0] || '')

      // Check for identifier field
      const hasId = headers.includes('id')
      const hasName = headers.includes('name')
      const hasIpAddress = headers.includes('ip_address')
      const hasIdentifier = hasId || hasName || hasIpAddress

      if (!hasIdentifier) {
        throw new Error(
          `CSV must contain at least one identifier column: 'id', 'name', or 'ip_address'. Found columns: ${headers.join(', ')}`
        )
      }

      const identifierField = hasId ? 'id' : hasName ? 'name' : 'ip_address'

      // Parse rows
      const rows: Array<Record<string, string>> = []
      for (let i = 1; i < lines.length; i++) {
        const values = splitCSVLine(lines[i] || '')
        if (values.length !== headers.length) {
          console.warn(`Skipping row ${i + 1}: column count mismatch`)
          continue
        }

        const row: Record<string, string> = {}
        headers.forEach((header, index) => {
          row[header] = values[index] || ''
        })
        rows.push(row)
      }

      setParsedData({
        headers,
        rows,
        rowCount: rows.length,
        hasId,
        hasIdentifier,
        identifierField,
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to parse CSV'
      setParseError(errorMsg)
      console.error('CSV parsing error:', error)
    } finally {
      setIsParsing(false)
    }
  }, [csvDelimiter, csvQuoteChar])

  // File selection handler
  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) {
        if (!file.name.endsWith('.csv')) {
          setParseError('Please select a CSV file')
          return
        }
        setCsvFile(file)
        parseCSV(file)
      }
    },
    [parseCSV]
  )

  // Submit update
  const handleUpdate = useCallback(
    async (dryRun: boolean = false) => {
      if (!csvFile || !parsedData) return

      setIsSubmitting(true)
      setParseError(null)

      try {
        // Read CSV content
        const csvContent = await csvFile.text()

        // Call the update API
        const result = await apiCall<{
          task_id: string
          job_id: string
        }>('/api/celery/tasks/update-devices-from-csv', {
          method: 'POST',
          body: JSON.stringify({
            csv_content: csvContent,
            csv_options: {
              delimiter: csvDelimiter,
              quoteChar: csvQuoteChar,
            },
            dry_run: dryRun,
          }),
        })

        setTaskId(result.task_id)
        setJobId(result.job_id)
        setShowProgress(true)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to submit update task'
        setParseError(errorMsg)
        console.error('Update task submission error:', error)
      } finally {
        setIsSubmitting(false)
      }
    },
    [csvFile, parsedData, apiCall, csvDelimiter, csvQuoteChar]
  )

  // Reset and close
  const handleClose = useCallback(() => {
    setCsvFile(null)
    setParsedData(null)
    setParseError(null)
    setTaskId(null)
    setJobId(null)
    setShowProgress(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onClose()
  }, [onClose])

  // View job in Jobs/View
  const handleViewJob = useCallback(() => {
    if (jobId) {
      window.open(`/jobs/view?job_id=${jobId}`, '_blank')
    }
  }, [jobId])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="!max-w-[880px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-blue-600" />
            Bulk Update Devices from CSV
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to update multiple devices in Nautobot. Configure the CSV format settings
            below, then upload a file with an identifier column (id, name, or ip_address) and the properties you want to update.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* CSV Settings */}
          {!parsedData && !showProgress && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border">
              <div className="space-y-2">
                <Label htmlFor="csv-delimiter">CSV Delimiter</Label>
                <Input
                  id="csv-delimiter"
                  value={csvDelimiter}
                  onChange={(e) => setCsvDelimiter(e.target.value)}
                  maxLength={1}
                  className="w-full"
                  placeholder=","
                />
                <p className="text-xs text-gray-500">Character used to separate fields (default: comma)</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="csv-quote-char">CSV Quote Character</Label>
                <Input
                  id="csv-quote-char"
                  value={csvQuoteChar}
                  onChange={(e) => setCsvQuoteChar(e.target.value)}
                  maxLength={1}
                  className="w-full"
                  placeholder='"'
                />
                <p className="text-xs text-gray-500">Character used to quote fields (default: double quote)</p>
              </div>
            </div>
          )}

          {/* File Upload */}
          {!parsedData && !showProgress && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="bulk-update-csv-upload"
                />
                <label htmlFor="bulk-update-csv-upload" className="cursor-pointer">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
                      <Upload className="h-8 w-8 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-base font-medium text-gray-900">Upload CSV File</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Click to browse or drag and drop your CSV file here
                      </p>
                    </div>
                    <div className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      Select CSV File
                    </div>
                  </div>
                </label>
              </div>

              {/* Parsing status */}
              {isParsing && (
                <Alert className="bg-blue-50 border-blue-200">
                  <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                  <AlertDescription className="text-blue-800">
                    Parsing CSV file...
                  </AlertDescription>
                </Alert>
              )}

              {/* Parse error */}
              {parseError && !isParsing && (
                <Alert className="bg-red-50 border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">{parseError}</AlertDescription>
                </Alert>
              )}

              {/* CSV Format Info */}
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 text-sm">
                  <strong>Required:</strong> CSV must have at least one identifier column: <code>id</code>,{' '}
                  <code>name</code>, or <code>primary_ip4</code>
                  <br />
                  <strong>Updates:</strong> All other columns will be used to update device properties
                  <br />
                  <strong>Example:</strong> <code>id,location,role,status</code>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Parsed Data Summary */}
          {parsedData && !showProgress && (
            <div className="space-y-4">
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  CSV parsed successfully! Found <strong>{parsedData.rowCount}</strong> devices to update.
                </AlertDescription>
              </Alert>

              {/* CSV Summary */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">File Information:</p>
                  <div className="space-y-1 text-sm">
                    <p className="text-gray-600">
                      <strong>Filename:</strong> {csvFile?.name}
                    </p>
                    <p className="text-gray-600">
                      <strong>Devices:</strong> {parsedData.rowCount}
                    </p>
                    <p className="text-gray-600">
                      <strong>Identifier:</strong>{' '}
                      <Badge variant="outline" className="font-mono">
                        {parsedData.identifierField}
                      </Badge>
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Columns to Update:</p>
                  <div className="flex flex-wrap gap-2">
                    {parsedData.headers
                      .filter(h => h !== parsedData.identifierField)
                      .map((header) => (
                        <Badge key={header} variant="secondary" className="font-mono text-xs">
                          {header}
                        </Badge>
                      ))}
                  </div>
                </div>

                {/* Preview first few rows */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Preview (first {Math.min(3, parsedData.rowCount)} rows):
                  </p>
                  <div className="bg-white rounded border text-xs overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          {parsedData.headers.map((header) => (
                            <th key={header} className="px-2 py-1 text-left font-medium border-r last:border-r-0">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsedData.rows.slice(0, 3).map((row) => (
                          <tr key={row[parsedData.identifierField] || JSON.stringify(row)} className="border-t">
                            {parsedData.headers.map((header) => (
                              <td key={`${row[parsedData.identifierField]}-${header}`} className="px-2 py-1 border-r last:border-r-0">
                                {row[header] || '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Progress View */}
          {showProgress && taskId && (
            <div className="space-y-4">
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  Update task is running in the background. You can track progress in the Jobs/View app.
                </AlertDescription>
              </Alert>

              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium">Task Details:</p>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>
                    <strong>Task ID:</strong> <code className="text-xs">{taskId}</code>
                  </p>
                  {jobId && (
                    <p>
                      <strong>Job ID:</strong> <code className="text-xs">{jobId}</code>
                    </p>
                  )}
                </div>
              </div>

              <Button onClick={handleViewJob} className="w-full" disabled={!jobId}>
                <Eye className="h-4 w-4 mr-2" />
                View Job in Jobs/View
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          {!showProgress ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isSubmitting || isParsing}>
                Cancel
              </Button>
              {parsedData && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => handleUpdate(true)}
                    disabled={isSubmitting || isParsing}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Validating...
                      </>
                    ) : (
                      'Dry Run (Validate Only)'
                    )}
                  </Button>
                  <Button onClick={() => handleUpdate(false)} disabled={isSubmitting || isParsing}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Update Devices
                      </>
                    )}
                  </Button>
                </>
              )}
            </>
          ) : (
            <Button onClick={handleClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
