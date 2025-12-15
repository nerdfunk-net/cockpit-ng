/**
 * Dialog for previewing export data before downloading
 */

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Eye, Copy, Check, Loader2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import type { DeviceInfo } from '@/components/shared/device-selector'
import { useApi } from '@/hooks/use-api'

interface PreviewExportDialogProps {
  show: boolean
  onClose: () => void
  devices: DeviceInfo[]
  properties: string[]
  format: 'yaml' | 'csv'
  csvOptions?: {
    delimiter: string
    quoteChar: string
    includeHeaders: boolean
  }
}

export function PreviewExportDialog({
  show,
  onClose,
  devices,
  properties,
  format,
  csvOptions,
}: PreviewExportDialogProps) {
  const { apiCall } = useApi()
  const [copied, setCopied] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [previewDevices, setPreviewDevices] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  // Fetch full device data when dialog opens
  useEffect(() => {
    if (show && devices.length > 0) {
      fetchPreviewData()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, devices, properties])

  const fetchPreviewData = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const deviceIds = devices.map(d => d.id)
      const response = await apiCall<{
        success: boolean
        preview_content: string
        total_devices: number
        previewed_devices: number
        message?: string
      }>('api/celery/preview-export-devices', {
        method: 'POST',
        body: JSON.stringify({
          device_ids: deviceIds,
          properties: properties,
          max_devices: 5,
          export_format: format,
          csv_options: csvOptions ? {
            ...csvOptions,
            includeHeaders: csvOptions.includeHeaders?.toString() ?? 'true',
          } : undefined,
        }),
      })

      if (response.success) {
        setPreviewDevices([{ preview_content: response.preview_content }])
      } else {
        setError(response.message || 'Failed to fetch preview data')
      }
    } catch (err) {
      console.error('Error fetching preview data:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch preview data')
    } finally {
      setIsLoading(false)
    }
  }

  const generatePreview = (): string => {
    // Return the backend-generated preview content
    if (previewDevices.length > 0 && previewDevices[0].preview_content) {
      return previewDevices[0].preview_content
    }
    return ''
  }

  const handleCopy = () => {
    const preview = generatePreview()
    navigator.clipboard.writeText(preview)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const preview = isLoading || error ? '' : generatePreview()
  const lineCount = preview.split('\n').length
  const charCount = preview.length

  return (
    <Dialog open={show} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-green-600" />
            Export Preview
          </DialogTitle>
          <DialogDescription>
            Preview of the first 5 devices in {format.toUpperCase()} format.
            Full device data will be fetched from Nautobot during actual export.
          </DialogDescription>
        </DialogHeader>

        {/* Loading/Error States */}
        {isLoading && (
          <div className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-green-600" />
            <p className="text-sm text-gray-600">Fetching full device data from Nautobot...</p>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded">
            <p className="text-sm text-red-800">
              <strong>Error:</strong> {error}
            </p>
          </div>
        )}

        {!isLoading && !error && previewDevices.length > 0 && (
          <>
            {/* Success Notice */}
            <div className="p-3 bg-green-50 border-l-4 border-green-500 rounded">
              <p className="text-sm text-green-800">
                <strong>✓ Real Data Preview:</strong> Showing complete device data fetched directly from Nautobot using the same GraphQL query as the export.
                All properties including <code className="bg-green-100 px-1 py-0.5 rounded text-xs">serial</code>, <code className="bg-green-100 px-1 py-0.5 rounded text-xs">asset_tag</code>, <code className="bg-green-100 px-1 py-0.5 rounded text-xs">_custom_field_data</code>, etc. are shown with actual values.
              </p>
            </div>
          </>
        )}

        {!isLoading && !error && previewDevices.length > 0 && (
          <>
            {/* Preview Stats */}
            <div className="flex items-center gap-4 p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-white border-green-300 text-green-700">
              {devices.length} device{devices.length !== 1 ? 's' : ''}
            </Badge>
            <Badge variant="outline" className="bg-white border-green-300 text-green-700">
              {properties.length} propert{properties.length !== 1 ? 'ies' : 'y'}
            </Badge>
            <Badge variant="outline" className="bg-white border-green-300 text-green-700">
              {format.toUpperCase()}
            </Badge>
          </div>
          <div className="ml-auto text-xs text-green-700">
            {lineCount} lines · {charCount.toLocaleString()} characters
          </div>
        </div>

        {/* Format-specific info */}
        {format === 'csv' && csvOptions && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-medium text-blue-800 mb-2">CSV Options:</p>
            <div className="grid grid-cols-3 gap-4 text-xs text-blue-700">
              <div>
                <span className="font-medium">Delimiter:</span>{' '}
                <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200">
                  {csvOptions.delimiter || '(empty)'}
                </code>
              </div>
              <div>
                <span className="font-medium">Quote:</span>{' '}
                <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200">
                  {csvOptions.quoteChar || '(empty)'}
                </code>
              </div>
              <div>
                <span className="font-medium">Headers:</span>{' '}
                <Badge variant={csvOptions.includeHeaders ? 'default' : 'secondary'} className="text-xs">
                  {csvOptions.includeHeaders ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Preview Content */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-800 text-gray-100 px-4 py-2 flex items-center justify-between">
            <span className="text-sm font-medium">Preview (First 5 devices)</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="text-gray-100 hover:bg-gray-700 hover:text-white"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <div className="bg-gray-900 p-4 overflow-auto max-h-[400px]">
            <pre className="text-sm font-mono text-gray-100 whitespace-pre">
              {preview}
            </pre>
          </div>
        </div>

            {devices.length > 5 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> This preview shows only the first 5 devices.
                  The full export will contain all <strong>{devices.length}</strong> selected devices.
                </p>
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
