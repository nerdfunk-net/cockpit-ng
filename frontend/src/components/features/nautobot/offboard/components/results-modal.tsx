import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, AlertCircle, Minus } from 'lucide-react'
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
            <Minus className="h-5 w-5 text-red-500" />
            <span>Offboarding Results</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {summary.totalDevices}
              </div>
              <div className="text-sm text-blue-600">Total Devices</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {summary.successfulDevices}
              </div>
              <div className="text-sm text-green-600">Successful</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {summary.failedDevices}
              </div>
              <div className="text-sm text-red-600">Failed</div>
            </div>
          </div>

          {/* Detailed Results */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Detailed Results</h3>

            {summary.results.map(result => (
              <div
                key={result.device_id}
                className={`border rounded-lg p-4 ${result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                  }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {result.success ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    )}
                    <span className="font-medium">
                      {result.device_name || result.device_id}
                    </span>
                  </div>
                  <Badge
                    className={`${result.success
                      ? 'bg-green-500 hover:bg-green-600'
                      : 'bg-red-500 hover:bg-red-600'
                      } text-white`}
                  >
                    {result.success ? 'Success' : 'Failed'}
                  </Badge>
                </div>

                <div className="text-sm mb-3">
                  <strong>Summary:</strong> {result.summary}
                </div>

                {result.removed_items.length > 0 && (
                  <div className="mb-3">
                    <strong className="text-sm text-green-700">Items Removed:</strong>
                    <ul className="list-disc list-inside mt-1 text-sm text-green-600">
                      {result.removed_items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.skipped_items.length > 0 && (
                  <div className="mb-3">
                    <strong className="text-sm text-yellow-700">Items Skipped:</strong>
                    <ul className="list-disc list-inside mt-1 text-sm text-yellow-600">
                      {result.skipped_items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.errors.length > 0 && (
                  <div className="mb-3">
                    <strong className="text-sm text-red-700">Errors:</strong>
                    <ul className="list-disc list-inside mt-1 text-sm text-red-600">
                      {result.errors.map((error) => (
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
            <Button
              onClick={onClose}
              variant="outline"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
