'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { Progress } from '@/components/ui/progress'
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, XCircle, HelpCircle, AlertCircle } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import type { ParsedCSVRow } from '../types'

interface DeviceResult {
  ip_address: string
  status: 'success' | 'error'
  message: string
  device_id?: string
  device_name?: string
  job_id?: string
  stage?: string
}

interface TaskProgress {
  stage?: string
  status?: string
  progress?: number
  device_count?: number
  processed?: number
  successful?: number
  failed?: number
  current_device?: number
  current_ip?: string
  devices?: DeviceResult[]
}

interface TaskStatus {
  task_id: string
  status: 'PENDING' | 'PROGRESS' | 'SUCCESS' | 'FAILURE' | 'REVOKED'
  result?: {
    success: boolean
    partial_success?: boolean
    message?: string
    error?: string
    device_count?: number
    successful_devices?: number
    failed_devices?: number
    devices?: DeviceResult[]
    stage?: string
  }
  error?: string
  progress?: TaskProgress
}

interface CSVUploadModalProps {
  open: boolean
  onClose: () => void
  csvFile: File | null
  parsedData: ParsedCSVRow[]
  isParsing: boolean
  isSubmitting: boolean
  taskId: string | null
  submitError: string
  parseError: string
  csvDelimiter: string
  csvQuoteChar: string
  parallelJobs: number
  onFileSelect: (file: File) => void
  onUpload: () => Promise<string | null>
  onDelimiterChange: (delimiter: string) => void
  onQuoteCharChange: (quoteChar: string) => void
  onParallelJobsChange: (jobs: number) => void
  onReparse: () => void
}

export function CSVUploadModal({
  open,
  onClose,
  csvFile,
  parsedData,
  isParsing,
  isSubmitting,
  taskId,
  submitError,
  parseError,
  csvDelimiter,
  csvQuoteChar,
  parallelJobs,
  onFileSelect,
  onUpload,
  onDelimiterChange,
  onQuoteCharChange,
  onParallelJobsChange,
  onReparse
}: CSVUploadModalProps) {
  const { apiCall } = useApi()
  const [showHelp, setShowHelp] = useState(false)
  const [showOptionalSettings, setShowOptionalSettings] = useState(false)
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null)
  const [_isPolling, setIsPolling] = useState(false)

  // Poll for task status when we have a taskId (or multiple task IDs)
  const pollTaskStatus = useCallback(async () => {
    if (!taskId) return

    try {
      // Handle multiple task IDs (comma-separated)
      const taskIds = taskId.split(',').map(id => id.trim())
      
      if (taskIds.length === 1) {
        // Single task - use original logic
        const status = await apiCall<TaskStatus>(`celery/tasks/${taskId}`, {
          method: 'GET'
        })

        setTaskStatus(status)

        // Stop polling if task is complete
        if (['SUCCESS', 'FAILURE', 'REVOKED'].includes(status.status)) {
          setIsPolling(false)
        }
      } else {
        // Multiple tasks - fetch all and aggregate
        const statuses = await Promise.all(
          taskIds.map(id => 
            apiCall<TaskStatus>(`celery/tasks/${id}`, { method: 'GET' })
              .catch(err => {
                console.error(`Error fetching task ${id}:`, err)
                return null
              })
          )
        )

        // Filter out failed fetches
        const validStatuses = statuses.filter(s => s !== null) as TaskStatus[]
        
        if (validStatuses.length === 0) {
          setIsPolling(false)
          return
        }

        // Aggregate results
        const allComplete = validStatuses.every(s => 
          ['SUCCESS', 'FAILURE', 'REVOKED'].includes(s.status)
        )
        const anyFailed = validStatuses.some(s => s.status === 'FAILURE')
        const allSuccess = validStatuses.every(s => s.status === 'SUCCESS')

        // Combine device results from all tasks
        const allDevices: DeviceResult[] = []
        let totalSuccessful = 0
        let totalFailed = 0

        validStatuses.forEach(status => {
          const devices = status.result?.devices || status.progress?.devices || []
          allDevices.push(...devices)
          totalSuccessful += status.result?.successful_devices ?? status.progress?.successful ?? 0
          totalFailed += status.result?.failed_devices ?? status.progress?.failed ?? 0
        })

        // Create aggregated status
        const aggregatedStatus: TaskStatus = {
          task_id: taskId,
          status: allComplete ? (anyFailed ? 'FAILURE' : 'SUCCESS') : 'PROGRESS',
          result: allComplete ? {
            success: allSuccess,
            message: `Completed ${validStatuses.length} parallel jobs`,
            device_count: allDevices.length,
            successful_devices: totalSuccessful,
            failed_devices: totalFailed,
            devices: allDevices,
          } : undefined,
          progress: !allComplete ? {
            status: `Processing ${validStatuses.length} parallel jobs...`,
            device_count: allDevices.length,
            successful: totalSuccessful,
            failed: totalFailed,
            devices: allDevices,
          } : undefined,
        }

        setTaskStatus(aggregatedStatus)

        if (allComplete) {
          setIsPolling(false)
        }
      }
    } catch (error) {
      console.error('Error polling task status:', error)
      setIsPolling(false)
    }
  }, [taskId, apiCall])

  // Start polling when taskId is set
  useEffect(() => {
    if (!taskId) {
      setTaskStatus(null)
      setIsPolling(false)
      return
    }

    setIsPolling(true)
    const initialPoll = setTimeout(() => pollTaskStatus(), 0)

    const interval = setInterval(() => {
      pollTaskStatus()
    }, 2000)

    return () => {
      clearTimeout(initialPoll)
      clearInterval(interval)
    }
  }, [taskId, pollTaskStatus])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onFileSelect(file)
    }
  }

  const handleUpload = async () => {
    await onUpload()
  }

  const getProgressValue = (): number => {
    if (taskStatus?.status === 'SUCCESS') return 100
    if (taskStatus?.status === 'FAILURE') return 0
    if (taskStatus?.progress?.progress) return taskStatus.progress.progress
    return 0
  }

  const getStatusMessage = (): string => {
    if (!taskStatus) return 'Initializing...'

    if (taskStatus.status === 'SUCCESS' && taskStatus.result) {
      return taskStatus.result.message || 'Bulk onboarding completed!'
    }

    if (taskStatus.status === 'FAILURE') {
      return taskStatus.error || taskStatus.result?.error || 'Bulk onboarding failed'
    }

    if (taskStatus.status === 'PROGRESS' && taskStatus.progress) {
      return taskStatus.progress.status || 'Processing...'
    }

    if (taskStatus.status === 'PENDING') {
      return 'Task queued, waiting to start...'
    }

    return 'Processing...'
  }

  // Get device results from either progress or final result
  const deviceResults = taskStatus?.result?.devices || taskStatus?.progress?.devices || []
  const successCount = taskStatus?.result?.successful_devices ?? taskStatus?.progress?.successful ?? deviceResults.filter(r => r.status === 'success').length
  const errorCount = taskStatus?.result?.failed_devices ?? taskStatus?.progress?.failed ?? deviceResults.filter(r => r.status === 'error').length

  const isTaskRunning = taskId && ['PENDING', 'PROGRESS'].includes(taskStatus?.status || '')
  const isTaskComplete = taskId && ['SUCCESS', 'FAILURE', 'REVOKED'].includes(taskStatus?.status || '')

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-7xl w-[95vw] max-h-[90vh] overflow-y-auto">
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
            Only required column: ip_address (other fields use app defaults if not provided)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload - only show if no task is running */}
          {!taskId && (
            <div className="space-y-2">
              <Label htmlFor="csv-file">Select CSV File</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={isSubmitting || isParsing}
                className="cursor-pointer"
              />
              {csvFile && (
                <p className="text-sm text-slate-600">
                  Selected: {csvFile.name} ({(csvFile.size / 1024).toFixed(2)} KB)
                </p>
              )}
            </div>
          )}

          {/* Optional CSV Settings - only show if no task is running */}
          {!taskId && (
            <div className="border rounded-lg overflow-hidden">
              <div 
                className="bg-blue-50 border-b border-blue-200 px-4 py-3 cursor-pointer hover:bg-blue-100 transition-colors"
                onClick={() => setShowOptionalSettings(!showOptionalSettings)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">
                      CSV Format and Jobs Settings (Optional)
                    </span>
                  </div>
                  <span className="text-xs text-blue-700">
                    {showOptionalSettings ? 'Click to hide' : 'Click to configure'}
                  </span>
                </div>
              </div>
              
              {showOptionalSettings && (
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="csv-delimiter" className="text-sm">
                        Delimiter
                      </Label>
                      <Input
                        id="csv-delimiter"
                        value={csvDelimiter}
                        onChange={(e) => onDelimiterChange(e.target.value)}
                        disabled={isSubmitting || isParsing}
                        placeholder=","
                        maxLength={1}
                        className="font-mono"
                      />
                      <p className="text-xs text-muted-foreground">
                        Character separating values (default: comma)
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="csv-quote" className="text-sm">
                        Quote Character
                      </Label>
                      <Input
                        id="csv-quote"
                        value={csvQuoteChar}
                        onChange={(e) => onQuoteCharChange(e.target.value)}
                        disabled={isSubmitting || isParsing}
                        placeholder='"'
                        maxLength={1}
                        className="font-mono"
                      />
                      <p className="text-xs text-muted-foreground">
                        Character for quoting values (default: double quote)
                      </p>
                    </div>
                    
                    {csvFile && (
                      <div className="col-span-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={onReparse}
                          disabled={isSubmitting || isParsing}
                          className="w-full"
                        >
                          Re-parse with New Settings
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Parallel Jobs Control */}
                  <div className="border-t pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="parallel-jobs" className="text-sm font-medium">
                        Parallel Jobs
                      </Label>
                      <Input
                        id="parallel-jobs"
                        type="number"
                        min={1}
                        max={parsedData.length || 100}
                        value={parallelJobs}
                        onChange={(e) => onParallelJobsChange(Math.max(1, parseInt(e.target.value) || 1))}
                        disabled={isSubmitting || isParsing}
                        className="w-32"
                      />
                      <p className="text-xs text-muted-foreground">
                        Number of parallel jobs to create. Higher values speed up onboarding but require more Celery workers.
                        {parsedData.length > 0 && (
                          <> With {parsedData.length} devices and {parallelJobs} job{parallelJobs > 1 ? 's' : ''}, 
                          each job will process ~{Math.ceil(parsedData.length / parallelJobs)} device{Math.ceil(parsedData.length / parallelJobs) > 1 ? 's' : ''}.</>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Parse Error */}
          {parseError && (
            <Alert className="border-red-200 bg-red-50">
              <XCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">{parseError}</AlertDescription>
            </Alert>
          )}

          {/* Submit Error */}
          {submitError && (
            <Alert className="border-red-200 bg-red-50">
              <XCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">{submitError}</AlertDescription>
            </Alert>
          )}

          {/* Parsing Indicator */}
          {isParsing && (
            <div className="flex items-center space-x-2 text-blue-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Parsing CSV file...</span>
            </div>
          )}

          {/* Parsed Data Preview - show before submitting */}
          {parsedData.length > 0 && !taskId && (
            <div className="space-y-2">
              <Label>Parsed Data ({parsedData.length} devices)</Label>
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
                        <TableCell>{row.location || <span className="text-muted-foreground italic">default</span>}</TableCell>
                        <TableCell>{row.namespace || <span className="text-muted-foreground italic">default</span>}</TableCell>
                        <TableCell>{row.role || <span className="text-muted-foreground italic">default</span>}</TableCell>
                        <TableCell>{row.status || <span className="text-muted-foreground italic">default</span>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Task Progress Section */}
          {taskId && (
            <div className="space-y-4">
              {/* Progress Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isTaskRunning && <Loader2 className="h-5 w-5 animate-spin text-blue-500" />}
                  {taskStatus?.status === 'SUCCESS' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                  {taskStatus?.status === 'FAILURE' && <XCircle className="h-5 w-5 text-red-500" />}
                  <span className="font-medium">{getStatusMessage()}</span>
                </div>
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

              {/* Progress Bar */}
              <Progress value={getProgressValue()} className="h-2" />

              {/* Task ID for reference */}
              <p className="text-xs text-muted-foreground">
                Task ID: <code className="bg-muted px-1 rounded">{taskId}</code>
                {' — '}Track this job in <span className="font-medium">Jobs / View</span>
              </p>

              {/* Device Results Table */}
              {deviceResults.length > 0 && (
                <div className="space-y-2">
                  <Label>Device Results</Label>
                  <div className="border rounded-md max-h-60 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>IP Address</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Device Name</TableHead>
                          <TableHead>Message</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deviceResults.map((result) => (
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
                            <TableCell className="text-sm">{result.device_name || '-'}</TableCell>
                            <TableCell className="text-sm max-w-xs truncate" title={result.message}>
                              {result.message}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submitting Indicator */}
          {isSubmitting && !taskId && (
            <div className="flex items-center space-x-2 text-blue-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Submitting bulk onboarding task...</span>
            </div>
          )}
        </div>

        <DialogFooter>
          {/* When task is running, show both Close (to dismiss) and Cancel (to stop task) */}
          {isTaskRunning && (
            <>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button variant="destructive" onClick={onClose} disabled={isSubmitting}>
                Cancel Task
              </Button>
            </>
          )}
          {/* When task is complete, show Close button */}
          {isTaskComplete && (
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
          {/* Before task starts, show Cancel and Upload buttons */}
          {!taskId && (
            <>
              <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              {parsedData.length > 0 && (
                <Button onClick={handleUpload} disabled={isSubmitting || isParsing}>
                  <Upload className="h-4 w-4 mr-2" />
                  Onboard {parsedData.length} Device{parsedData.length > 1 ? 's' : ''}
                </Button>
              )}
            </>
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
                <li>Delimiter: configurable (default comma, can be changed in Optional Settings)</li>
                <li>Quote character: configurable (default double quote, can be changed in Optional Settings)</li>
                <li>Each row represents one device to onboard</li>
                <li>Empty or malformed rows will be skipped</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Required Column</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><code className="bg-muted px-1 py-0.5 rounded">ip_address</code> - Device IP address (IPv4 format)</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-1">
                All other fields will use your app&apos;s default Nautobot settings if not provided in the CSV.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Optional Columns</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
                <li><code className="bg-muted px-1 py-0.5 rounded">location</code> - Location name or ID</li>
                <li><code className="bg-muted px-1 py-0.5 rounded">namespace</code> - Namespace name or ID</li>
                <li><code className="bg-muted px-1 py-0.5 rounded">role</code> - Device role name or ID</li>
                <li><code className="bg-muted px-1 py-0.5 rounded">status</code> - Device status name or ID</li>
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
                    <li>All devices are processed in a single background job (Celery task)</li>
                    <li>You can track progress in real-time and view the job in <strong>Jobs / View</strong></li>
                    <li>Ensure the IP addresses are reachable and credentials are configured in Nautobot</li>
                    <li>Location, namespace, role, and status must exist in Nautobot (or use defaults)</li>
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
