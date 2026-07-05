import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Minus } from 'lucide-react'
import { StatusIcon } from '@/components/shared/status-icon'
import { StatusBadge } from '@/components/shared/status-badge'
import type { OffboardSummary } from '@/types/features/nautobot/offboard'

interface ResultsModalProps {
  isOpen: boolean
  summary: OffboardSummary | null
  onClose: () => void
}

export function ResultsModal({ isOpen, summary, onClose }: ResultsModalProps) {
  if (!summary) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Minus className="h-5 w-5 text-destructive" />
            <span>Offboarding Results</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-info p-4 rounded-lg">
              <div className="text-2xl font-bold text-info-foreground">
                {summary.totalDevices}
              </div>
              <div className="text-sm text-info-foreground">Total Devices</div>
            </div>
            <div className="bg-success p-4 rounded-lg">
              <div className="text-2xl font-bold text-success-foreground">
                {summary.successfulDevices}
              </div>
              <div className="text-sm text-success-foreground">Successful</div>
            </div>
            <div className="bg-error p-4 rounded-lg">
              <div className="text-2xl font-bold text-error-foreground">
                {summary.failedDevices}
              </div>
              <div className="text-sm text-error-foreground">Failed</div>
            </div>
          </div>

          {/* Detailed Results */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Detailed Results</h3>

            {summary.results.map(result => (
              <div
                key={result.device_id}
                className={`border rounded-lg p-4 ${
                  result.success
                    ? 'border-success-border bg-success'
                    : 'border-error-border bg-error'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <StatusIcon variant={result.success ? 'success' : 'error'} />
                    <span className="font-medium">
                      {result.device_name || result.device_id}
                    </span>
                  </div>
                  <StatusBadge variant={result.success ? 'success' : 'error'}>
                    {result.success ? 'Success' : 'Failed'}
                  </StatusBadge>
                </div>

                <div className="text-sm mb-3">
                  <strong>Summary:</strong> {result.summary}
                </div>

                {result.removed_items.length > 0 && (
                  <div className="mb-3">
                    <strong className="text-sm text-success-foreground">
                      Items Removed:
                    </strong>
                    <ul className="list-disc list-inside mt-1 text-sm text-success-foreground">
                      {result.removed_items.map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.skipped_items.length > 0 && (
                  <div className="mb-3">
                    <strong className="text-sm text-warning-foreground">
                      Items Skipped:
                    </strong>
                    <ul className="list-disc list-inside mt-1 text-sm text-warning-foreground">
                      {result.skipped_items.map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.errors.length > 0 && (
                  <div className="mb-3">
                    <strong className="text-sm text-error-foreground">Errors:</strong>
                    <ul className="list-disc list-inside mt-1 text-sm text-error-foreground">
                      {result.errors.map(error => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Close Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
