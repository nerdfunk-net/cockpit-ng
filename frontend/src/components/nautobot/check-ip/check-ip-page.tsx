'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Search, 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Info,
  Download
} from 'lucide-react'
import { useApi } from '@/hooks/use-api'

interface StatusMessage {
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}

interface CheckResult {
  ip_address: string
  device_name: string
  status: 'match' | 'name_mismatch' | 'ip_not_found' | 'error'
  nautobot_device_name?: string
  error?: string
}

interface TaskStatus {
  task_id: string
  status: 'PENDING' | 'PROGRESS' | 'SUCCESS' | 'FAILURE' | 'REVOKED'
  result?: {
    success: boolean
    message?: string
    error?: string
    total_devices?: number
    processed_devices?: number
    results?: CheckResult[]
  }
  progress?: {
    current: number
    total: number
    message?: string
  }
}

export function CheckIPPage() {
  const { apiCall } = useApi()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // State
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [delimiter, setDelimiter] = useState<string>(';') // Default to semicolon
  const [quoteChar, setQuoteChar] = useState<string>('"')
  const [isUploading, setIsUploading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null)
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [results, setResults] = useState<CheckResult[]>([])
  const [showAll, setShowAll] = useState(false) // Toggle for showing all results vs differences only

  // Load current settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await apiCall<{ data?: { csv_delimiter?: string; csv_quote_char?: string } }>('settings/nautobot')
        if (settings?.data) {
          // Use settings from database, or keep current defaults if not set
          if (settings.data.csv_delimiter) {
            setDelimiter(settings.data.csv_delimiter)
          }
          if (settings.data.csv_quote_char) {
            setQuoteChar(settings.data.csv_quote_char)
          }
        }
      } catch (error) {
        console.error('Failed to load CSV settings:', error)
        // Keep the default values (semicolon and double quote)
      }
    }
    loadSettings()
  }, [apiCall])

  // Handle file selection
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === 'text/csv') {
      setCsvFile(file)
      setStatusMessage({ type: 'success', message: `Selected file: ${file.name}` })
    } else {
      setCsvFile(null)
      setStatusMessage({ type: 'error', message: 'Please select a valid CSV file' })
    }
  }, [])

  // Poll task status
  const pollTaskStatus = useCallback(async (taskId: string) => {
    try {
      const status = await apiCall<TaskStatus>(`celery/tasks/${taskId}`)
      setTaskStatus(status)
      
      if (status.status === 'SUCCESS') {
        if (status.result?.success === false) {
          // Task completed but with an error result
          setStatusMessage({ 
            type: 'error', 
            message: status.result?.error || 'Task completed with error' 
          })
        } else if (status.result?.results) {
          // Task completed successfully with results
          setResults(status.result.results)
        }
        setIsPolling(false)
      } else if (status.status === 'FAILURE') {
        setStatusMessage({ 
          type: 'error', 
          message: `Task failed: ${status.result?.error || 'Unknown error'}` 
        })
        setIsPolling(false)
      }
      
      return status.status !== 'PENDING' && status.status !== 'PROGRESS'
    } catch (error) {
      console.error('Error polling task status:', error)
      setStatusMessage({ 
        type: 'error', 
        message: `Error checking task status: ${error instanceof Error ? error.message : 'Unknown error'}` 
      })
      setIsPolling(false)
      return true
    }
  }, [apiCall])

  // Start polling
  const startPolling = useCallback((taskId: string) => {
    setIsPolling(true)
    
    const poll = async () => {
      const isComplete = await pollTaskStatus(taskId)
      if (!isComplete && isPolling) {
        setTimeout(poll, 2000) // Poll every 2 seconds
      }
    }
    
    poll()
  }, [pollTaskStatus, isPolling])

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    if (!csvFile) {
      setStatusMessage({ type: 'error', message: 'Please select a CSV file first' })
      return
    }

    setIsUploading(true)
    setStatusMessage({ type: 'info', message: 'Uploading CSV file and starting check...' })

    try {
      const formData = new FormData()
      formData.append('csv_file', csvFile)
      // Ensure we don't send undefined or null values
      const finalDelimiter = delimiter || ';'
      const finalQuoteChar = quoteChar || '"'
      formData.append('delimiter', finalDelimiter)
      formData.append('quote_char', finalQuoteChar)

      const response = await apiCall<{ task_id: string; message: string }>('celery/tasks/check-ip', {
        method: 'POST',
        body: formData,
        headers: {
          // Don't set Content-Type, let browser set it with boundary for multipart/form-data
        }
      })

      if (response.task_id) {
        setStatusMessage({ type: 'success', message: 'Check started! Processing devices...' })
        startPolling(response.task_id)
      } else {
        setStatusMessage({ type: 'error', message: 'Failed to start check task' })
      }
    } catch (error) {
      console.error('Error uploading CSV:', error)
      setStatusMessage({ 
        type: 'error', 
        message: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      })
    } finally {
      setIsUploading(false)
    }
  }, [csvFile, delimiter, quoteChar, apiCall, startPolling])

  // Reset form
  const handleReset = useCallback(() => {
    setCsvFile(null)
    setTaskStatus(null)
    setResults([])
    setStatusMessage(null)
    setIsPolling(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  // Export results
  const handleExportResults = useCallback(() => {
    if (results.length === 0) return

    const csv = [
      'IP Address,Device Name,Status,Nautobot Device Name,Error',
      ...results.map(r => `"${r.ip_address}","${r.device_name}","${r.status}","${r.nautobot_device_name || ''}","${r.error || ''}"`)
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `check-ip-results-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [results])

  // Get status icon for result
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'match':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'name_mismatch':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'ip_not_found':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Info className="h-4 w-4 text-blue-500" />
    }
  }

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'match':
        return 'bg-green-100 text-green-700 border-green-300'
      case 'name_mismatch':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300'
      case 'ip_not_found':
        return 'bg-red-100 text-red-700 border-red-300'
      case 'error':
        return 'bg-red-100 text-red-700 border-red-300'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300'
    }
  }

  const getProgressValue = () => {
    if (taskStatus?.status === 'SUCCESS') return 100
    if (taskStatus?.status === 'FAILURE') return 0
    if (taskStatus?.progress) {
      return Math.round((taskStatus.progress.current / taskStatus.progress.total) * 100)
    }
    return 0
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Search className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Check IP</h1>
            <p className="text-gray-600 mt-1">Compare CSV device list with Nautobot devices</p>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {statusMessage && (
        <Alert className={`${
          statusMessage.type === 'error' ? 'border-red-500 bg-red-50' :
          statusMessage.type === 'success' ? 'border-green-500 bg-green-50' :
          statusMessage.type === 'warning' ? 'border-yellow-500 bg-yellow-50' :
          'border-blue-500 bg-blue-50'
        }`}>
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 mt-0.5">
              {statusMessage.type === 'success' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
              {statusMessage.type === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
              {statusMessage.type === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
              {statusMessage.type === 'info' && <Info className="h-4 w-4 text-blue-500" />}
            </div>
            <AlertDescription className="font-mono text-xs">
              {statusMessage.message}
            </AlertDescription>
          </div>
        </Alert>
      )}

      {/* Upload Section */}
      <Card className="shadow-lg border-0 overflow-hidden p-0">
        <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-4">
          <CardTitle className="flex items-center space-x-2 text-sm font-medium">
            <Upload className="h-4 w-4" />
            <span>Upload CSV File</span>
          </CardTitle>
          <CardDescription className="text-white/90 text-xs mt-1">
            Select a CSV file with device information to compare with Nautobot.
            Required columns: ip_address, name
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
          {/* CSV Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-md">
            <div className="space-y-2">
              <Label htmlFor="delimiter">CSV Delimiter</Label>
              <Input
                id="delimiter"
                value={delimiter}
                onChange={(e) => setDelimiter(e.target.value)}
                placeholder=","
                disabled={isUploading || isPolling}
                className="w-20"
                maxLength={1}
              />
              <p className="text-xs text-muted-foreground">
                Character that separates values (e.g., &quot;,&quot; or &quot;;&quot;)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quoteChar">Quote Character</Label>
              <Input
                id="quoteChar"
                value={quoteChar}
                onChange={(e) => setQuoteChar(e.target.value)}
                placeholder={'"'}
                disabled={isUploading || isPolling}
                className="w-20"
                maxLength={1}
              />
              <p className="text-xs text-muted-foreground">
                Character that quotes text values (e.g., &quot; or &apos;)
              </p>
            </div>
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              disabled={isUploading || isPolling}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              disabled={isUploading || isPolling}
              className="w-full sm:w-auto"
            >
              <FileText className="h-4 w-4 mr-2" />
              {csvFile ? 'Change File' : 'Select CSV File'}
            </Button>
            {csvFile && (
              <p className="text-sm text-muted-foreground mt-2">
                Selected: {csvFile.name} ({(csvFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSubmit}
              disabled={!csvFile || isUploading || isPolling}
              className="flex-1 sm:flex-none"
            >
              {isUploading || isPolling ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  {isUploading ? 'Uploading...' : 'Checking...'}
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Start Check
                </>
              )}
            </Button>
            <Button
              onClick={handleReset}
              variant="outline"
              disabled={isUploading || isPolling}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Progress Section */}
      {taskStatus && (isPolling || taskStatus.status === 'SUCCESS') && (
        <Card className="shadow-lg border-0 overflow-hidden p-0">
          <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-4">
            <CardTitle className="flex items-center space-x-2 text-sm font-medium">
              <Info className="h-4 w-4" />
              <span>Progress</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
            <Progress value={getProgressValue()} className="h-2" />
            <div className="text-sm text-muted-foreground">
              {taskStatus.progress ? (
                <p>
                  Processed {taskStatus.progress.current} of {taskStatus.progress.total} devices
                  {taskStatus.progress.message && ` - ${taskStatus.progress.message}`}
                </p>
              ) : (
                <p>Processing devices...</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Statistics */}
      {results.length > 0 && (
        <Card className="shadow-lg border-0 overflow-hidden p-0">
          <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-4">
            <CardTitle className="flex items-center space-x-2 text-sm font-medium">
              <Info className="h-4 w-4" />
              <span>Summary</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Devices</p>
                <p className="text-2xl font-bold">{results.length}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Matches</p>
                <p className="text-2xl font-bold text-green-600">
                  {results.filter(r => r.status === 'match').length}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Mismatches</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {results.filter(r => r.status === 'name_mismatch').length}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Not Found</p>
                <p className="text-2xl font-bold text-red-600">
                  {results.filter(r => r.status === 'ip_not_found').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Section */}
      {results.length > 0 && (
        <Card className="shadow-lg border-0 overflow-hidden p-0">
          <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Results</span>
                </CardTitle>
                <CardDescription className="text-white/90 text-xs mt-1">
                  {showAll 
                    ? `Showing all ${results.length} devices`
                    : `Showing ${results.filter(r => r.status !== 'match').length} differences (${results.length} total)`
                  }
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => setShowAll(!showAll)} 
                  variant={showAll ? "secondary" : "outline"}
                  size="sm"
                  className="bg-white text-gray-900 hover:bg-gray-100 border-white"
                >
                  {showAll ? 'Show Differences Only' : 'Show All'}
                </Button>
                <Button 
                  onClick={handleExportResults} 
                  variant="outline" 
                  size="sm"
                  className="bg-white text-gray-900 hover:bg-gray-100 border-white"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Results
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50">
            <div className="space-y-2">
              {(showAll ? results : results.filter(r => r.status !== 'match')).map((result) => (
                <div key={`${result.ip_address}-${result.device_name}`} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(result.status)}
                    <div>
                      <p className="font-medium">{result.device_name}</p>
                      <p className="text-sm text-muted-foreground">{result.ip_address}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(result.status)} variant="outline">
                      {result.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                    {result.nautobot_device_name && result.nautobot_device_name !== result.device_name && (
                      <span className="text-sm text-muted-foreground">
                        → {result.nautobot_device_name}
                      </span>
                    )}
                    {result.error && (
                      <span className="text-sm text-red-600">
                        {result.error}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}