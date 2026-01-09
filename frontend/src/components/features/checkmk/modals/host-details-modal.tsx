import React, { useState, useEffect, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { JsonRenderer } from '../renderers/json-renderer'
import { useApi } from '@/hooks/use-api'
import type { CheckMKHost } from '@/types/checkmk/types'

interface HostDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  host: CheckMKHost | null
}

export function HostDetailsModal({ open, onOpenChange, host }: HostDetailsModalProps) {
  const { apiCall } = useApi()
  const [hostDetails, setHostDetails] = useState<Record<string, unknown> | null>(null)
  const [loadingHostDetails, setLoadingHostDetails] = useState(false)
  const [showEffectiveAttributes, setShowEffectiveAttributes] = useState(false)

  const loadHostDetails = useCallback(async (hostName: string, effectiveAttrs: boolean) => {
    try {
      setLoadingHostDetails(true)
      const params = effectiveAttrs ? '?effective_attributes=true' : ''
      const response = await apiCall<{ success: boolean; message: string; data: Record<string, unknown> }>(`checkmk/hosts/${hostName}${params}`)
      // Extract the actual host data from the CheckMKOperationResponse wrapper
      setHostDetails(response?.data || null)
    } catch (err) {
      console.error('Failed to load host details:', err)
      setHostDetails(null)
    } finally {
      setLoadingHostDetails(false)
    }
  }, [apiCall])

  // Load host details when modal opens or host changes
  useEffect(() => {
    if (open && host) {
      void loadHostDetails(host.host_name, showEffectiveAttributes)
    }
  }, [open, host, showEffectiveAttributes, loadHostDetails])

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setHostDetails(null)
      setShowEffectiveAttributes(false)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[64vw] !w-[64vw] max-h-[90vh] overflow-hidden flex flex-col p-0" style={{ maxWidth: '64vw', width: '64vw' }}>
        <DialogHeader className="sr-only">
          <DialogTitle>Host Details - {host?.host_name}</DialogTitle>
          <DialogDescription>View detailed information and attributes for the selected host</DialogDescription>
        </DialogHeader>

        {/* Compact Blue Header */}
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 pr-14">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Host Details</h2>
              <p className="text-blue-100 text-xs">{host?.host_name}</p>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="effective-attrs" className="text-xs text-blue-100 whitespace-nowrap">
                Effective Attributes:
              </Label>
              <Select
                value={showEffectiveAttributes ? 'true' : 'false'}
                onValueChange={(value) => setShowEffectiveAttributes(value === 'true')}
              >
                <SelectTrigger className="w-20 h-7 text-xs border-white/30 bg-white/10 hover:bg-white/20 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">No</SelectItem>
                  <SelectItem value="true">Yes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Host Details Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50/50">
          {loadingHostDetails ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-sm text-muted-foreground">Loading host details...</p>
              </div>
            </div>
          ) : hostDetails ? (
            <div className="p-4">
              {/* Host Info Section */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {(() => {
                  if (hostDetails.id && typeof hostDetails.id === 'string') {
                    return (
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-md p-3 border border-blue-200/60">
                        <div className="text-[10px] font-semibold text-blue-600/80 uppercase tracking-wide mb-1">Host Name</div>
                        <div className="font-mono text-sm font-semibold text-gray-900">{hostDetails.id}</div>
                      </div>
                    )
                  }
                  return null
                })()}

                {(() => {
                  const extensions = hostDetails.extensions as Record<string, unknown> | undefined
                  const folder = extensions?.folder
                  if (folder && typeof folder === 'string') {
                    return (
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-md p-3 border border-blue-200/60">
                        <div className="text-[10px] font-semibold text-blue-600/80 uppercase tracking-wide mb-1">Folder</div>
                        <div className="font-mono text-sm font-semibold text-gray-900">
                          {folder}
                        </div>
                      </div>
                    )
                  }
                  return null
                })()}
              </div>

              {/* Attributes Section - Grouped */}
              {(() => {
                const extensions = hostDetails.extensions as Record<string, unknown> | undefined
                if (extensions?.attributes && typeof extensions.attributes === 'object') {
                  const allAttrs = extensions.attributes as Record<string, unknown>
                  const tagAttrs: Record<string, unknown> = {}
                  const coreAttrs: Record<string, unknown> = {}

                  // Separate tags from core attributes
                  Object.entries(allAttrs).forEach(([key, value]) => {
                    if (key.startsWith('tag_')) {
                      tagAttrs[key] = value
                    } else {
                      coreAttrs[key] = value
                    }
                  })

                  return (
                    <>
                      {/* Core Attributes */}
                      {Object.keys(coreAttrs).length > 0 && (
                        <div className="mb-4">
                          <div className="flex items-center mb-2 pb-1.5 border-b border-blue-400/60">
                            <h3 className="text-sm font-semibold text-gray-900">
                              Core Attributes
                            </h3>
                          </div>
                          <div className="bg-white rounded-md p-4 border border-blue-200">
                            <JsonRenderer data={coreAttrs} />
                          </div>
                        </div>
                      )}

                      {/* Tag Attributes */}
                      {Object.keys(tagAttrs).length > 0 && (
                        <div className="mb-4">
                          <div className="flex items-center mb-2 pb-1.5 border-b border-amber-400/60">
                            <h3 className="text-sm font-semibold text-amber-800">
                              Tags
                            </h3>
                          </div>
                          <div className="bg-amber-50/50 rounded-md p-4 border border-amber-200">
                            <JsonRenderer data={tagAttrs} />
                          </div>
                        </div>
                      )}
                    </>
                  )
                }
                return null
              })()}

              {/* Effective Attributes Section - Grouped */}
              {(() => {
                const extensions = hostDetails.extensions as Record<string, unknown> | undefined
                if (showEffectiveAttributes && extensions?.effective_attributes && typeof extensions.effective_attributes === 'object') {
                  const allEffAttrs = extensions.effective_attributes as Record<string, unknown>
                  const tagEffAttrs: Record<string, unknown> = {}
                  const coreEffAttrs: Record<string, unknown> = {}

                  // Separate tags from core attributes
                  Object.entries(allEffAttrs).forEach(([key, value]) => {
                    if (key.startsWith('tag_')) {
                      tagEffAttrs[key] = value
                    } else {
                      coreEffAttrs[key] = value
                    }
                  })

                  return (
                    <>
                      {/* Effective Core Attributes */}
                      {Object.keys(coreEffAttrs).length > 0 && (
                        <div className="mb-4">
                          <div className="flex items-center mb-2 pb-1.5 border-b border-blue-500/60">
                            <h3 className="text-sm font-semibold text-blue-700">
                              Effective Core Attributes
                            </h3>
                          </div>
                          <div className="bg-blue-50/30 rounded-md p-4 border border-blue-300">
                            <JsonRenderer data={coreEffAttrs} />
                          </div>
                        </div>
                      )}

                      {/* Effective Tag Attributes */}
                      {Object.keys(tagEffAttrs).length > 0 && (
                        <div className="mb-4">
                          <div className="flex items-center mb-2 pb-1.5 border-b border-amber-500/60">
                            <h3 className="text-sm font-semibold text-amber-900">
                              Effective Tags
                            </h3>
                          </div>
                          <div className="bg-amber-100/40 rounded-md p-4 border border-amber-300">
                            <JsonRenderer data={tagEffAttrs} />
                          </div>
                        </div>
                      )}
                    </>
                  )
                }
                return null
              })()}

              {/* Cluster Info */}
              {(() => {
                const extensions = hostDetails.extensions as Record<string, unknown> | undefined
                if (extensions?.is_cluster) {
                  return (
                    <div className="mb-4">
                      <div className="flex items-center mb-2 pb-1.5 border-b border-blue-400/60">
                        <h3 className="text-sm font-semibold text-gray-900">Cluster Information</h3>
                      </div>
                      <div className="bg-blue-50/30 rounded-md p-4 border border-blue-200">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-700">Status:</span>
                            <Badge className="bg-blue-500 hover:bg-blue-600 text-xs h-5">Cluster</Badge>
                          </div>
                          {extensions.cluster_nodes ? (
                            <div>
                              <div className="text-xs font-medium text-gray-700 mb-1.5">Cluster Nodes:</div>
                              <div className="bg-white rounded p-3 border border-blue-200">
                                <JsonRenderer data={extensions.cluster_nodes} />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )
                }
                return null
              })()}

              {/* Raw JSON Section */}
              <div>
                <details className="group">
                  <summary className="flex items-center gap-1.5 text-xs font-medium text-gray-600 uppercase tracking-wide cursor-pointer hover:text-blue-600 transition-colors select-none py-2">
                    <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                    Raw JSON Response
                  </summary>
                  <div className="mt-2 bg-gray-900 rounded-md p-3 overflow-auto max-h-80 border border-gray-700">
                    <pre className="text-[11px] text-green-400 font-mono leading-relaxed">
                      {JSON.stringify(hostDetails, null, 2)}
                    </pre>
                  </div>
                </details>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No host details available
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
