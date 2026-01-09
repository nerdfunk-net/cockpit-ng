import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Device } from '../types/sync-devices.types'
import { getCheckMKStatusBadge } from '../utils/sync-devices.utils'

interface DeviceDetailsModalProps {
  device: Device | null
  isOpen: boolean
  onClose: () => void
}

export function DeviceDetailsModal({ device, isOpen, onClose }: DeviceDetailsModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Device Details: {device?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Device Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><strong>Name:</strong> {device?.name}</div>
              <div><strong>Role:</strong> {device?.role}</div>
              <div><strong>Status:</strong> {device?.status}</div>
              <div><strong>Location:</strong> {device?.location}</div>
              <div><strong>CheckMK Status:</strong> {device && getCheckMKStatusBadge(device.checkmk_status)}</div>
              <div><strong>Processed At:</strong> {device?.processed_at ? new Date(device.processed_at).toLocaleString() : 'N/A'}</div>
            </div>
          </div>
          
          {device?.error_message && (
            <div>
              <h3 className="font-semibold mb-2 text-red-600">Error Message</h3>
              <div className="bg-red-50 border border-red-200 p-4 rounded text-sm text-red-800">
                {device.error_message}
              </div>
            </div>
          )}

          {device?.diff && device?.checkmk_status === 'error' && (
            <div>
              <h3 className="font-semibold mb-2 text-red-600">Error Details</h3>
              <div className="bg-red-50 border border-red-200 p-4 rounded text-sm">
                {(() => {
                  try {
                    // Try to parse as JSON for detailed error info
                    const errorData = JSON.parse(device.diff)
                    return (
                      <div className="space-y-3">
                        {errorData.error && (
                          <div>
                            <span className="font-semibold text-red-700">Error: </span>
                            <span className="text-red-800">{errorData.error}</span>
                          </div>
                        )}
                        {errorData.status_code && (
                          <div>
                            <span className="font-semibold text-red-700">Status Code: </span>
                            <span className="text-red-800">{errorData.status_code}</span>
                          </div>
                        )}
                        {errorData.detail && (
                          <div>
                            <span className="font-semibold text-red-700">Detail: </span>
                            <span className="text-red-800">{errorData.detail}</span>
                          </div>
                        )}
                        {errorData.title && (
                          <div>
                            <span className="font-semibold text-red-700">Title: </span>
                            <span className="text-red-800">{errorData.title}</span>
                          </div>
                        )}
                        {errorData.fields && (
                          <div>
                            <div className="font-semibold text-red-700 mb-2">Field Problems:</div>
                            <div className="bg-white border border-red-300 rounded p-3 space-y-2">
                              {Object.entries(errorData.fields).map(([field, errors]: [string, unknown]) => {
                                // Recursive function to render nested field errors
                                const renderErrors = (value: unknown, depth: number = 0): React.ReactElement => {
                                  if (Array.isArray(value)) {
                                    return (
                                      <ul className="list-disc list-inside text-red-600 mt-1 space-y-1">
                                        {value.map((error: string) => (
                                          <li key={error} className="text-sm">{error}</li>
                                        ))}
                                      </ul>
                                    )
                                  } else if (typeof value === 'object' && value !== null) {
                                    return (
                                      <div className={depth > 0 ? "ml-4 mt-1" : ""}>
                                        {Object.entries(value as Record<string, unknown>).map(([subField, subErrors]) => (
                                          <div key={subField} className="border-l-2 border-red-300 pl-3 mt-1">
                                            <div className="font-medium text-red-700 text-sm">{subField}:</div>
                                            {renderErrors(subErrors, depth + 1)}
                                          </div>
                                        ))}
                                      </div>
                                    )
                                  } else {
                                    return <div className="text-sm text-red-600">{String(value)}</div>
                                  }
                                }

                                return (
                                  <div key={field} className="border-l-2 border-red-400 pl-3">
                                    <div className="font-medium text-red-700">{field}:</div>
                                    {renderErrors(errors)}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  } catch {
                    // If not JSON, display as plain text
                    return <div className="text-red-800 whitespace-pre-wrap">{device.diff}</div>
                  }
                })()}
              </div>
            </div>
          )}
          
          {device?.result_data && (
            <div>
              <h3 className="font-semibold mb-2">Job Result Details</h3>
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-96">
                {JSON.stringify(device.result_data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
