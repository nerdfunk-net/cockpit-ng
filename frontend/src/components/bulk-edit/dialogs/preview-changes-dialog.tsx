'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import type { DeviceInfo } from '@/components/shared/device-selector'

interface DryRunResult {
  success: boolean
  devices_processed: number
  successful_updates: number
  failed_updates: number
  skipped_updates: number
  results: Array<{
    device_id: string
    device_name?: string
    success: boolean
    message: string
    changes?: Record<string, unknown>
  }>
}

interface PreviewChangesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  modifiedDevices: Map<string, Partial<DeviceInfo>>
  onConfirmSave: () => void
  onRunDryRun: () => Promise<DryRunResult>
}

export function PreviewChangesDialog({
  open,
  onOpenChange,
  modifiedDevices,
  onConfirmSave,
  onRunDryRun,
}: PreviewChangesDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handlePreview = async () => {
    setIsLoading(true)
    setError(null)
    setDryRunResult(null)

    try {
      const result = await onRunDryRun()
      setDryRunResult(result)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to preview changes'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirm = () => {
    onOpenChange(false)
    onConfirmSave()
  }

  const handleClose = () => {
    setDryRunResult(null)
    setError(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview Changes</DialogTitle>
          <DialogDescription>
            Review the changes that will be applied to {modifiedDevices.size} device(s)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Modified Devices Summary */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-2">Modified Devices</h3>
            <p className="text-sm text-gray-600">
              {modifiedDevices.size} device(s) will be updated
            </p>

            {/* Show modified fields per device */}
            <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
              {Array.from(modifiedDevices.entries()).map(([deviceId, changes]) => (
                <div key={deviceId} className="text-sm border-l-2 border-blue-500 pl-3 py-1">
                  <div className="font-medium">Device ID: {deviceId}</div>
                  <div className="text-gray-600">
                    Fields: {Object.keys(changes).join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dry Run Button */}
          {!dryRunResult && !error && (
            <Button
              onClick={handlePreview}
              disabled={isLoading}
              className="w-full"
              variant="outline"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running validation...
                </>
              ) : (
                'Validate Changes (Dry Run)'
              )}
            </Button>
          )}

          {/* Error Display */}
          {error && (
            <Alert className="border-red-500 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}

          {/* Dry Run Results */}
          {dryRunResult && (
            <div className="space-y-3">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="border rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center mb-1">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {dryRunResult.successful_updates}
                  </div>
                  <div className="text-xs text-gray-600">Will Succeed</div>
                </div>
                <div className="border rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center mb-1">
                    <XCircle className="h-5 w-5 text-red-600" />
                  </div>
                  <div className="text-2xl font-bold text-red-600">
                    {dryRunResult.failed_updates}
                  </div>
                  <div className="text-xs text-gray-600">Will Fail</div>
                </div>
                <div className="border rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center mb-1">
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div className="text-2xl font-bold text-yellow-600">
                    {dryRunResult.skipped_updates}
                  </div>
                  <div className="text-xs text-gray-600">Skipped</div>
                </div>
              </div>

              {/* Detailed Results */}
              <div className="border rounded-lg p-4 max-h-80 overflow-y-auto">
                <h4 className="font-semibold mb-3">Validation Results</h4>
                <div className="space-y-2">
                  {dryRunResult.results.map((result) => (
                    <div
                      key={result.device_id}
                      className={`flex items-start gap-2 p-2 rounded ${
                        result.success
                          ? 'bg-green-50 border border-green-200'
                          : 'bg-red-50 border border-red-200'
                      }`}
                    >
                      {result.success ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">
                          {result.device_name || result.device_id}
                        </div>
                        <div className="text-xs text-gray-600">{result.message}</div>
                        {result.changes && (
                          <div className="text-xs text-gray-500 mt-1">
                            Changes: {Object.keys(result.changes).join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Warning if there are failures */}
              {dryRunResult.failed_updates > 0 && (
                <Alert className="border-red-500 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    {dryRunResult.failed_updates} device(s) will fail to update. Review the errors
                    above before proceeding.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {dryRunResult && dryRunResult.successful_updates > 0 && (
            <Button onClick={handleConfirm}>
              Proceed with {dryRunResult.successful_updates} Update(s)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
