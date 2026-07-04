import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/status-badge'
import type { Device, DiffResult } from '../types'
import { formatValue } from '../utils/diff-helpers'

interface DiffModalProps {
  isOpen: boolean
  device: Device | null
  diffResult: DiffResult | null
  loading: boolean
  configComparison: Array<{
    key: string
    nautobotValue: unknown
    checkmkValue: unknown
    isDifferent: boolean
    nautobotMissing: boolean
    checkmkMissing: boolean
    isIgnored: boolean
  }>
  onClose: () => void
}

export function DiffModal({
  isOpen,
  device,
  diffResult,
  loading,
  configComparison,
  onClose,
}: DiffModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-[95vw] w-[95vw] max-h-[90vh] overflow-hidden flex flex-col"
        style={{ resize: 'both', minWidth: '800px', minHeight: '500px' }}
      >
        <DialogHeader>
          <DialogTitle>Device Comparison - {device?.name}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-sm text-muted-foreground">Loading diff...</p>
              </div>
            </div>
          ) : diffResult ? (
            <div className="space-y-4">
              {/* Header with status */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-sm text-muted-foreground">
                    Generated: {new Date(diffResult.timestamp).toLocaleString()}
                  </div>
                  {(() => {
                    const matchedRule = diffResult.differences.normalized_config.internal?.matched_rule
                    if (!matchedRule) return null
                    return (
                      <Badge variant="outline" className="text-muted-foreground font-mono text-xs">
                        Priority Rule: {matchedRule.filename}{matchedRule.is_default ? ' (default)' : ''}
                      </Badge>
                    )
                  })()}
                </div>
                <StatusBadge
                  variant={
                    diffResult.differences.result === 'equal'
                      ? 'success'
                      : diffResult.differences.result === 'host_not_found'
                        ? 'error'
                        : 'warning'
                  }
                >
                  {diffResult.differences.result === 'equal'
                    ? '✓ Configs Match'
                    : diffResult.differences.result === 'host_not_found'
                      ? '❌ Host Not Found in CheckMK'
                      : '⚠ Differences Found'}
                </StatusBadge>
              </div>

              {/* Handle host not found case */}
              {diffResult.differences.result === 'host_not_found' ? (
                <div className="bg-error rounded-lg p-6 border border-error-border">
                  <div className="text-center">
                    <div className="text-error-foreground text-lg mb-3">
                      🚫 Host Not Found
                    </div>
                    <p className="text-error-foreground mb-4">
                      {diffResult.differences.diff}
                    </p>

                    <div className="bg-card rounded-lg p-4 border border-error-border text-left">
                      <h4 className="font-semibold mb-2 text-error-foreground">
                        Expected Configuration (Nautobot)
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div>
                          <strong>Folder:</strong>{' '}
                          <code className="bg-error/60 px-2 py-1 rounded">
                            {diffResult.differences.normalized_config.folder}
                          </code>
                        </div>
                        <div>
                          <strong>Attributes:</strong>
                        </div>
                        <pre className="bg-error/60 p-3 rounded text-xs font-mono overflow-auto max-h-40">
                          {JSON.stringify(
                            diffResult.differences.normalized_config.attributes,
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    </div>

                    <p className="text-error-foreground text-sm mt-4">
                      This device exists in Nautobot but has not been synchronized to
                      CheckMK yet. Use the Sync button to create this host in CheckMK.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Folder Comparison */}
                  <div className="bg-muted rounded-lg p-4">
                    <h4 className="font-semibold mb-3">Folder Configuration</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs font-medium text-info-foreground mb-1">
                          Nautobot (Expected)
                        </div>
                        <div className="bg-info p-2 rounded text-sm font-mono">
                          {diffResult.differences.normalized_config.folder}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          CheckMK (Actual)
                        </div>
                        <div className="bg-card p-2 rounded text-sm font-mono border">
                          {diffResult.differences.checkmk_config?.folder ||
                            '(not found)'}
                        </div>
                      </div>
                    </div>
                    {diffResult.differences.normalized_config.folder !==
                      diffResult.differences.checkmk_config?.folder && (
                      <div className="mt-2 text-xs text-warning-foreground">
                        ⚠ Folder paths differ
                      </div>
                    )}
                  </div>

                  {/* Attributes Comparison */}
                  <div className="bg-card border rounded-lg">
                    <div className="bg-muted px-4 py-3 border-b">
                      <h4 className="font-semibold">Attributes Comparison</h4>
                      <div className="text-xs text-muted-foreground mt-1">
                        Side-by-side comparison of device attributes
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left p-3 font-medium text-muted-foreground w-48">
                              Attribute
                            </th>
                            <th className="text-left p-3 font-medium text-info-foreground w-1/3">
                              Nautobot (Expected)
                            </th>
                            <th className="text-left p-3 font-medium text-muted-foreground w-1/3">
                              CheckMK (Actual)
                            </th>
                            <th className="text-left p-3 font-medium text-muted-foreground w-32">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {configComparison.map(
                            ({
                              key,
                              nautobotValue,
                              checkmkValue,
                              isDifferent,
                              nautobotMissing,
                              checkmkMissing,
                              isIgnored,
                            }) => (
                              <tr
                                key={key}
                                className={`border-b transition-colors ${
                                  isIgnored
                                    ? 'bg-warning hover:bg-warning/70 border-warning-border'
                                    : nautobotMissing || checkmkMissing || isDifferent
                                      ? 'bg-error hover:bg-error/70 border-error-border'
                                      : 'bg-success hover:bg-success/70 border-success-border'
                                }`}
                              >
                                <td className="p-3 font-mono text-sm font-medium w-48">
                                  {key}
                                </td>
                                <td
                                  className={`p-3 text-sm w-1/3 ${nautobotMissing ? 'text-muted-foreground italic' : ''}`}
                                >
                                  <div className="bg-info p-2 rounded font-mono text-xs overflow-auto max-h-32">
                                    <pre className="whitespace-pre-wrap break-words">
                                      {formatValue(nautobotValue)}
                                    </pre>
                                  </div>
                                </td>
                                <td
                                  className={`p-3 text-sm w-1/3 ${checkmkMissing ? 'text-muted-foreground italic' : ''}`}
                                >
                                  <div className="bg-card border p-2 rounded font-mono text-xs overflow-auto max-h-32">
                                    <pre className="whitespace-pre-wrap break-words">
                                      {formatValue(checkmkValue)}
                                    </pre>
                                  </div>
                                </td>
                                <td className="p-3 text-xs">
                                  {isIgnored ? (
                                    <StatusBadge variant="warning">Ignored</StatusBadge>
                                  ) : nautobotMissing ? (
                                    <StatusBadge variant="error">
                                      Only in CheckMK
                                    </StatusBadge>
                                  ) : checkmkMissing ? (
                                    <StatusBadge variant="error">
                                      Missing in CheckMK
                                    </StatusBadge>
                                  ) : isDifferent ? (
                                    <StatusBadge variant="error">Different</StatusBadge>
                                  ) : (
                                    <StatusBadge variant="success">Match</StatusBadge>
                                  )}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* CheckMK Additional Info */}
                  {diffResult.differences.checkmk_config &&
                    (diffResult.differences.checkmk_config.is_cluster ||
                      diffResult.differences.checkmk_config.is_offline ||
                      diffResult.differences.checkmk_config.cluster_nodes) && (
                      <div className="bg-muted rounded-lg p-4">
                        <h4 className="font-semibold mb-2 text-foreground">
                          CheckMK Additional Information
                        </h4>
                        <div className="space-y-1 text-sm">
                          <div>
                            Is Cluster:{' '}
                            {diffResult.differences.checkmk_config.is_cluster
                              ? 'Yes'
                              : 'No'}
                          </div>
                          <div>
                            Is Offline:{' '}
                            {diffResult.differences.checkmk_config.is_offline
                              ? 'Yes'
                              : 'No'}
                          </div>
                          {diffResult.differences.checkmk_config.cluster_nodes && (
                            <div>
                              Cluster Nodes:{' '}
                              {JSON.stringify(
                                diffResult.differences.checkmk_config.cluster_nodes
                              )}
                            </div>
                          )}
                        </div>
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
