"use client"

import { Download, FileText, CheckCircle2, Database } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ExportDevicesJobResult, formatBytes } from "../../types/job-results"
import { useAuthStore } from "@/lib/auth-store"

interface ExportDevicesResultViewProps {
  result: ExportDevicesJobResult
  taskId?: string
}

export function ExportDevicesResultView({ result, taskId }: ExportDevicesResultViewProps) {
  const token = useAuthStore(state => state.token)

  const handleDownload = async () => {
    if (!taskId) {
      alert("Task ID not available")
      return
    }

    if (!token) {
      alert("Not authenticated")
      return
    }

    try {
      const response = await fetch(`/api/proxy/api/celery/tasks/export-devices/${taskId}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to download file')
      }

      // Get filename from response headers or use the one from result
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = result.filename
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/)
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1]
        }
      }

      // Download the file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Download error:', error)
      alert(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Export Summary
          </CardTitle>
          <CardDescription>Device export completed successfully</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Exported Devices</p>
              <p className="text-2xl font-bold text-gray-900">{result.exported_devices}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Requested Devices</p>
              <p className="text-2xl font-bold text-gray-900">{result.requested_devices}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Properties</p>
              <p className="text-2xl font-bold text-gray-900">{result.properties_count}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">File Size</p>
              <p className="text-2xl font-bold text-gray-900">{formatBytes(result.file_size_bytes)}</p>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-gray-600 mb-2">
              <strong>Message:</strong> {result.message}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* File Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500" />
            Export File Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Filename</p>
              <p className="text-sm text-gray-900 font-mono">{result.filename}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Format</p>
              <p className="text-sm text-gray-900 uppercase font-semibold">{result.export_format}</p>
            </div>
          </div>

          <div className="pt-4 border-t">
            <Button onClick={handleDownload} className="w-full gap-2">
              <Download className="h-4 w-4" />
              Download {result.export_format.toUpperCase()} File
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Export Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-purple-500" />
            Export Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium text-gray-600">Total Devices Exported:</span>
              <span className="text-gray-900">{result.exported_devices} / {result.requested_devices}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium text-gray-600">Export Format:</span>
              <span className="text-gray-900 uppercase">{result.export_format}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium text-gray-600">Properties Included:</span>
              <span className="text-gray-900">{result.properties_count}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="font-medium text-gray-600">File Size:</span>
              <span className="text-gray-900">{formatBytes(result.file_size_bytes)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
