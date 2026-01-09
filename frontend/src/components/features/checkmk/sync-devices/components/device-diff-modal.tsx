import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import type { Device } from '../types/sync-devices.types'
import { renderConfigComparison, formatValue } from '../utils/sync-devices.utils'

interface DeviceDiffModalProps {
  device: Device | null
  isOpen: boolean
  onClose: () => void
}

export function DeviceDiffModal({ device, isOpen, onClose }: DeviceDiffModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) onClose()
    }}>
      <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] overflow-hidden flex flex-col" style={{ resize: 'both', minWidth: '800px', minHeight: '500px' }}>
        <DialogHeader>
          <DialogTitle>
            Device Comparison - {device?.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto">
          {device ? (
            <div className="space-y-4">
              {/* Header with status */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Generated: {device.processed_at ? new Date(device.processed_at).toLocaleString() : 'Now'}
                </div>
                <Badge 
                  variant={device.checkmk_status === 'equal' ? 'default' : 'secondary'}
                  className={
                    device.checkmk_status === 'equal' ? 'bg-green-100 text-green-800' : 
                    device.checkmk_status === 'missing' || device.checkmk_status === 'host_not_found' ? 'bg-red-100 text-red-800' :
                    'bg-orange-100 text-orange-800'
                  }
                >
                  {device.checkmk_status === 'equal' ? '✓ Configs Match' : 
                   device.checkmk_status === 'missing' || device.checkmk_status === 'host_not_found' ? '❌ Host Not Found in CheckMK' :
                   '⚠ Differences Found'}
                </Badge>
              </div>

              {/* Handle host not found case */}
              {(device.checkmk_status === 'missing' || device.checkmk_status === 'host_not_found') ? (
                <div className="bg-red-50 rounded-lg p-6 border border-red-200">
                  <div className="text-center">
                    <div className="text-red-600 text-lg mb-3">🚫 Host Not Found</div>
                    <p className="text-red-800 mb-4">{device.error_message || 'This device exists in Nautobot but has not been synchronized to CheckMK yet.'}</p>
                    
                    <div className="bg-white rounded-lg p-4 border border-red-200 text-left">
                      <h4 className="font-semibold mb-2 text-red-800">Expected Configuration (Nautobot)</h4>
                      <div className="space-y-2 text-sm">
                        {device.normalized_config && (
                          <>
                            <div><strong>Folder:</strong> <code className="bg-red-100 px-2 py-1 rounded">{device.normalized_config.folder || 'N/A'}</code></div>
                            <div><strong>Attributes:</strong></div>
                            <pre className="bg-red-100 p-3 rounded text-xs font-mono overflow-auto max-h-40">
                              {JSON.stringify(device.normalized_config.attributes || {}, null, 2)}
                            </pre>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-red-700 text-sm mt-4">
                      Use the Add button to create this host in CheckMK.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Folder Comparison */}
                  {device.normalized_config && device.checkmk_config && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-semibold mb-3">Folder Configuration</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs font-medium text-blue-600 mb-1">Nautobot (Expected)</div>
                          <div className="bg-blue-50 p-2 rounded text-sm font-mono">
                            {device.normalized_config?.folder || 'N/A'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-purple-600 mb-1">CheckMK (Actual)</div>
                          <div className="bg-purple-50 p-2 rounded text-sm font-mono">
                            {device.checkmk_config?.folder || '(not found)'}
                          </div>
                        </div>
                      </div>
                      {device.normalized_config?.folder !== device.checkmk_config?.folder && (
                        <div className="mt-2 text-xs text-orange-600">⚠ Folder paths differ</div>
                      )}
                    </div>
                  )}

                  {/* Attributes Comparison */}
                  {device.normalized_config && device.checkmk_config && (
                    <div className="bg-white border rounded-lg">
                      <div className="bg-gray-50 px-4 py-3 border-b">
                        <h4 className="font-semibold">Attributes Comparison</h4>
                        <div className="text-xs text-gray-600 mt-1">Side-by-side comparison of device attributes</div>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b bg-gray-25">
                              <th className="text-left p-3 font-medium text-gray-700 w-48">Attribute</th>
                              <th className="text-left p-3 font-medium text-blue-600 w-1/3">Nautobot (Expected)</th>
                              <th className="text-left p-3 font-medium text-purple-600 w-1/3">CheckMK (Actual)</th>
                              <th className="text-left p-3 font-medium text-gray-700 w-32">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {renderConfigComparison(
                              device.normalized_config,
                              device.checkmk_config,
                              device.ignored_attributes || []
                            ).map(({ key, nautobotValue, checkmkValue, isDifferent, nautobotMissing, checkmkMissing, isIgnored }) => (
                              <tr 
                                key={key} 
                                className={`border-b transition-colors ${
                                  isIgnored
                                    ? 'bg-yellow-50 hover:bg-yellow-100 border-yellow-200'
                                    : nautobotMissing || checkmkMissing || isDifferent 
                                      ? 'bg-red-50 hover:bg-red-100 border-red-200' 
                                      : 'bg-green-50 hover:bg-green-100 border-green-200'
                                }`}
                              >
                                <td className="p-3 font-mono text-sm font-medium w-48">{key}</td>
                                <td className={`p-3 text-sm w-1/3 ${nautobotMissing ? 'text-gray-400 italic' : ''}`}>
                                  <div className="bg-blue-50 p-2 rounded font-mono text-xs overflow-auto max-h-32">
                                    <pre className="whitespace-pre-wrap break-words">
                                      {formatValue(nautobotValue)}
                                    </pre>
                                  </div>
                                </td>
                                <td className={`p-3 text-sm w-1/3 ${checkmkMissing ? 'text-gray-400 italic' : ''}`}>
                                  <div className="bg-purple-50 p-2 rounded font-mono text-xs overflow-auto max-h-32">
                                    <pre className="whitespace-pre-wrap break-words">
                                      {formatValue(checkmkValue)}
                                    </pre>
                                  </div>
                                </td>
                                <td className="p-3 text-xs">
                                  {isIgnored ? (
                                    <Badge variant="outline" className="text-yellow-700 border-yellow-400 bg-yellow-100">Ignored</Badge>
                                  ) : nautobotMissing ? (
                                    <Badge variant="outline" className="text-red-700 border-red-400 bg-red-100">Only in CheckMK</Badge>
                                  ) : checkmkMissing ? (
                                    <Badge variant="outline" className="text-red-700 border-red-400 bg-red-100">Missing in CheckMK</Badge>
                                  ) : isDifferent ? (
                                    <Badge variant="outline" className="text-red-700 border-red-400 bg-red-100">Different</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-green-700 border-green-400 bg-green-100">Equal</Badge>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Fallback: Show raw data if structured comparison is not available */}
                  {(!device.normalized_config || !device.checkmk_config) && (
                    <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                      <h4 className="font-semibold mb-2 text-yellow-800">Raw Comparison Data</h4>
                      <div className="space-y-2 text-sm">
                        <div>
                          <strong>Status:</strong> {device.checkmk_status}
                        </div>
                        {device.result_data && (
                          <div>
                            <strong>Result Data:</strong>
                            <pre className="bg-white p-3 rounded text-xs font-mono overflow-auto max-h-40 mt-1">
                              {JSON.stringify(device.result_data, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* CheckMK Additional Info */}
                  {device.checkmk_config && (
                    device.checkmk_config.is_cluster || 
                    device.checkmk_config.is_offline || 
                    device.checkmk_config.cluster_nodes
                  ) && (
                    <div className="bg-purple-50 rounded-lg p-4">
                      <h4 className="font-semibold mb-2 text-purple-800">CheckMK Additional Information</h4>
                      <div className="space-y-1 text-sm">
                        <div>Is Cluster: {device.checkmk_config.is_cluster ? 'Yes' : 'No'}</div>
                        <div>Is Offline: {device.checkmk_config.is_offline ? 'Yes' : 'No'}</div>
                        {device.checkmk_config.cluster_nodes && (
                          <div>Cluster Nodes: {JSON.stringify(device.checkmk_config.cluster_nodes)}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Raw diff text fallback */}
                  {device.diff && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-semibold mb-2 text-gray-800">Raw Differences</h4>
                      <pre className="bg-white p-3 rounded text-xs font-mono overflow-auto max-h-40 border">
                        {device.diff}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No diff data available
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
