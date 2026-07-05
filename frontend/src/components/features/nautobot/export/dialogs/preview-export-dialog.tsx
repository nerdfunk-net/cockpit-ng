/**
 * Dialog for previewing export data before downloading
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusAlert } from '@/components/shared/status-alert'
import { Eye, Copy, Check, Loader2 } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
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
  const [previewDevices, setPreviewDevices] = useState<unknown[]>([])
  const [error, setError] = useState<string | null>(null)

  const fetchPreviewData = useCallback(async () => {
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
          csv_options: csvOptions
            ? {
                ...csvOptions,
                includeHeaders: csvOptions.includeHeaders?.toString() ?? 'true',
              }
            : undefined,
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
  }, [apiCall, devices, properties, format, csvOptions])

  useEffect(() => {
    if (show && devices.length > 0) {
      void fetchPreviewData()
    }
  }, [show, devices.length, fetchPreviewData])

  const generatePreview = (): string => {
    // Return the backend-generated preview content
    if (previewDevices.length > 0) {
      const device = previewDevices[0] as { preview_content?: string }
      if (device.preview_content) {
        return device.preview_content
      }
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
            <Eye className="h-5 w-5 text-success-foreground" />
            Export Preview
          </DialogTitle>
          <DialogDescription>
            Preview of the first 5 devices in {format.toUpperCase()} format. Full device
            data will be fetched from Nautobot during actual export.
          </DialogDescription>
        </DialogHeader>

        {/* Loading/Error States */}
        {isLoading && (
          <div className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-success-foreground" />
            <p className="text-sm text-muted-foreground">
              Fetching full device data from Nautobot...
            </p>
          </div>
        )}

        {error && (
          <StatusAlert variant="error">
            <strong>Error:</strong> {error}
          </StatusAlert>
        )}

        {!isLoading && !error && previewDevices.length > 0 && (
          <>
            {/* Success Notice */}
            <StatusAlert variant="success">
              <strong>✓ Real Data Preview:</strong> Showing complete device data
              fetched directly from Nautobot using the same GraphQL query as the
              export. All properties including{' '}
              <code className="bg-success-border/30 px-1 py-0.5 rounded text-xs">
                serial
              </code>
              ,{' '}
              <code className="bg-success-border/30 px-1 py-0.5 rounded text-xs">
                asset_tag
              </code>
              ,{' '}
              <code className="bg-success-border/30 px-1 py-0.5 rounded text-xs">
                _custom_field_data
              </code>
              , etc. are shown with actual values.
            </StatusAlert>
          </>
        )}

        {!isLoading && !error && previewDevices.length > 0 && (
          <>
            {/* Preview Stats */}
            <div className="flex items-center gap-4 p-3 bg-success border border-success-border rounded-lg">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="bg-card border-success-border text-success-foreground"
                >
                  {devices.length} device{devices.length !== 1 ? 's' : ''}
                </Badge>
                <Badge
                  variant="outline"
                  className="bg-card border-success-border text-success-foreground"
                >
                  {properties.length} propert{properties.length !== 1 ? 'ies' : 'y'}
                </Badge>
                <Badge
                  variant="outline"
                  className="bg-card border-success-border text-success-foreground"
                >
                  {format.toUpperCase()}
                </Badge>
              </div>
              <div className="ml-auto text-xs text-success-foreground">
                {lineCount} lines · {charCount.toLocaleString()} characters
              </div>
            </div>

            {/* Format-specific info */}
            {format === 'csv' && csvOptions && (
              <div className="p-3 bg-info border border-info-border rounded-lg">
                <p className="text-sm font-medium text-info-foreground mb-2">
                  CSV Options:
                </p>
                <div className="grid grid-cols-3 gap-4 text-xs text-info-foreground">
                  <div>
                    <span className="font-medium">Delimiter:</span>{' '}
                    <code className="bg-card px-1.5 py-0.5 rounded border border-info-border">
                      {csvOptions.delimiter || '(empty)'}
                    </code>
                  </div>
                  <div>
                    <span className="font-medium">Quote:</span>{' '}
                    <code className="bg-card px-1.5 py-0.5 rounded border border-info-border">
                      {csvOptions.quoteChar || '(empty)'}
                    </code>
                  </div>
                  <div>
                    <span className="font-medium">Headers:</span>{' '}
                    <Badge
                      variant={csvOptions.includeHeaders ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {csvOptions.includeHeaders ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {/* Preview Content — terminal/console-style output, left hardcoded per repo precedent */}
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
              <StatusAlert variant="warning">
                <strong>Note:</strong> This preview shows only the first 5 devices. The
                full export will contain all <strong>{devices.length}</strong> selected
                devices.
              </StatusAlert>
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
