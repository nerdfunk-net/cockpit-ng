'use client'

import { useState } from 'react'
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
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, XCircle, HelpCircle, AlertCircle } from 'lucide-react'
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
  onUpload: () => void
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
  const [showHelp, setShowHelp] = useState(false)

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
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center space-x-2">
              <FileSpreadsheet className="h-5 w-5" />
              <span>Bulk Device Onboarding via CSV</span>
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHelp(true)}
              className="h-8 w-8 p-0"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </div>
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
            <Button onClick={onUpload} disabled={isUploading || isParsing}>
              <Upload className="h-4 w-4 mr-2" />
              Upload {parsedData.length} Device{parsedData.length > 1 ? 's' : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Help Dialog */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              CSV File Format Guide
            </DialogTitle>
            <DialogDescription>
              Learn how to format your CSV file for device onboarding
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">File Format</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>First row must contain column headers</li>
                <li>Delimiter: comma (,)</li>
                <li>Each row represents one device to onboard</li>
                <li>Empty or malformed rows will be skipped</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Required Columns</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><code className="bg-muted px-1 py-0.5 rounded">ip_address</code> - Device IP address (IPv4 format)</li>
                <li><code className="bg-muted px-1 py-0.5 rounded">location</code> - Location name or ID</li>
                <li><code className="bg-muted px-1 py-0.5 rounded">namespace</code> - Namespace name or ID</li>
                <li><code className="bg-muted px-1 py-0.5 rounded">role</code> - Device role name or ID</li>
                <li><code className="bg-muted px-1 py-0.5 rounded">status</code> - Device status name or ID</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Optional Columns</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
                <li><code className="bg-muted px-1 py-0.5 rounded">platform</code> - Platform name or ID (e.g., cisco_ios, juniper_junos)</li>
                <li><code className="bg-muted px-1 py-0.5 rounded">port</code> - SSH port number (default: 22)</li>
                <li><code className="bg-muted px-1 py-0.5 rounded">timeout</code> - Connection timeout in seconds (default: 30)</li>
                <li><code className="bg-muted px-1 py-0.5 rounded">interface_status</code> - Default interface status</li>
                <li><code className="bg-muted px-1 py-0.5 rounded">ip_address_status</code> - Default IP address status</li>
                <li><code className="bg-muted px-1 py-0.5 rounded">prefix_status</code> - Default prefix status</li>
                <li><code className="bg-muted px-1 py-0.5 rounded">secret_groups</code> - Secret group name or ID</li>
                <li><code className="bg-muted px-1 py-0.5 rounded">tags</code> - Tag names separated by semicolon or pipe (e.g., <code className="bg-muted px-1 py-0.5 rounded">tag1;tag2;tag3</code>)</li>
                <li><code className="bg-muted px-1 py-0.5 rounded">cf_*</code> - Custom fields with prefix <code className="bg-muted px-1 py-0.5 rounded">cf_</code> (e.g., <code className="bg-muted px-1 py-0.5 rounded">cf_net</code> for custom field &quot;net&quot;)</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Example CSV</h4>
              <div className="bg-muted p-3 rounded-md overflow-x-auto">
                <pre className="text-xs font-mono whitespace-pre">
{`ip_address,location,namespace,role,status,platform,tags,cf_environment
192.168.1.1,datacenter-1,global,access-switch,active,cisco_ios,production;core,prod
192.168.1.2,datacenter-1,global,core-router,active,cisco_ios,production,prod
10.0.0.1,branch-office,global,firewall,active,paloalto_panos,branch|security,dev`}
                </pre>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex gap-2">
                <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-800">
                  <p className="font-semibold mb-1">Important Notes:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>All devices will be onboarded asynchronously using background jobs</li>
                    <li>You can track onboarding progress using the Job ID returned for each device</li>
                    <li>Ensure the IP addresses are reachable and credentials are configured in Nautobot</li>
                    <li>Location, namespace, role, and status must exist in Nautobot before importing</li>
                    <li>Tags: Use semicolon (;) or pipe (|) to separate multiple tags within the tags column</li>
                    <li>Custom fields: Column names starting with <code className="bg-muted px-1 py-0.5 rounded">cf_</code> are treated as custom fields</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowHelp(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
