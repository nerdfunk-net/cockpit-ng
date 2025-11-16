'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import type { ParsedCSVRow, BulkOnboardingResult } from '../types'

interface CSVUploadModalProps {
  open: boolean
  onClose: () => void
  csvFile: File | null
  parsedData: ParsedCSVRow[]
  isParsing: boolean
  isUploading: boolean
  bulkResults: BulkOnboardingResult[]
  parseError: string
  onFileSelect: (file: File) => void
  onUpload: (data: ParsedCSVRow[]) => void
}

export function CSVUploadModal({
  open,
  onClose,
  csvFile,
  parsedData,
  isParsing,
  isUploading,
  bulkResults,
  parseError,
  onFileSelect,
  onUpload
}: CSVUploadModalProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onFileSelect(file)
    }
  }

  const successCount = bulkResults.filter(r => r.status === 'success').length
  const errorCount = bulkResults.filter(r => r.status === 'error').length

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FileSpreadsheet className="h-5 w-5" />
            <span>Bulk Device Onboarding via CSV</span>
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file with device information to onboard multiple devices at once.
            Required columns: ip_address, location, namespace, role, status
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="csv-file">Select CSV File</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={isUploading || isParsing}
              className="cursor-pointer"
            />
            {csvFile && (
              <p className="text-sm text-slate-600">
                Selected: {csvFile.name} ({(csvFile.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>

          {/* Parse Error */}
          {parseError && (
            <Alert className="border-red-200 bg-red-50">
              <XCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">{parseError}</AlertDescription>
            </Alert>
          )}

          {/* Parsing Indicator */}
          {isParsing && (
            <div className="flex items-center space-x-2 text-blue-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Parsing CSV file...</span>
            </div>
          )}

          {/* Parsed Data Preview */}
          {parsedData.length > 0 && bulkResults.length === 0 && (
            <div className="space-y-2">
              <Label>Parsed Data ({parsedData.length} rows)</Label>
              <div className="border rounded-md max-h-60 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Namespace</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((row) => (
                      <TableRow key={row.ip_address}>
                        <TableCell className="font-mono text-sm">{row.ip_address}</TableCell>
                        <TableCell>{row.location}</TableCell>
                        <TableCell>{row.namespace}</TableCell>
                        <TableCell>{row.role}</TableCell>
                        <TableCell>{row.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Upload Results */}
          {bulkResults.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Upload Results</Label>
                <div className="flex items-center space-x-3">
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Success: {successCount}
                  </Badge>
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    Failed: {errorCount}
                  </Badge>
                </div>
              </div>
              <div className="border rounded-md max-h-60 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Job ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulkResults.map((result) => (
                      <TableRow key={result.ip_address}>
                        <TableCell className="font-mono text-sm">{result.ip_address}</TableCell>
                        <TableCell>
                          {result.status === 'success' ? (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Success
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              Failed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{result.message}</TableCell>
                        <TableCell className="font-mono text-xs">{result.job_id || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Uploading Indicator */}
          {isUploading && (
            <div className="flex items-center space-x-2 text-blue-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>
                Uploading devices... ({bulkResults.length}/{parsedData.length})
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isUploading}>
            {bulkResults.length > 0 ? 'Close' : 'Cancel'}
          </Button>
          {parsedData.length > 0 && bulkResults.length === 0 && (
            <Button onClick={() => onUpload(parsedData)} disabled={isUploading || isParsing}>
              <Upload className="h-4 w-4 mr-2" />
              Upload {parsedData.length} Device{parsedData.length > 1 ? 's' : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
