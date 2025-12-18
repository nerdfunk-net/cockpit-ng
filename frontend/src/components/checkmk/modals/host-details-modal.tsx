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
        
        {/* Blue Header */}
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-3 px-6">
          <div>
            <h2 className="text-lg font-semibold">Host Details</h2>
            <p className="text-blue-100 text-sm">{host?.host_name}</p>
          </div>
        </div>

        {/* Controls Section */}
        <div className="bg-gray-50 border-b px-6 py-3">
          <div className="flex items-center gap-3">
            <Label htmlFor="effective-attrs" className="text-sm font-medium text-gray-700">
              Show Effective Attributes:
            </Label>
            <Select
              value={showEffectiveAttributes ? 'true' : 'false'}
              onValueChange={(value) => setShowEffectiveAttributes(value === 'true')}
            >
              <SelectTrigger className="w-24 h-8 border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500 text-gray-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">False</SelectItem>
                <SelectItem value="true">True</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Host Details Content */}
        <div className="flex-1 overflow-y-auto bg-white">
          {loadingHostDetails ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-sm text-muted-foreground">Loading host details...</p>
              </div>
            </div>
          ) : hostDetails ? (
            <div className="p-6">
              {/* Host Info Section */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                {(() => {
                  if (hostDetails.id && typeof hostDetails.id === 'string') {
                    return (
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-lg p-4 border border-blue-200">
                        <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">Host Name</div>
                        <div className="font-mono text-lg font-semibold text-gray-900">{hostDetails.id}</div>
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
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-lg p-4 border border-purple-200">
                        <div className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-2">Folder</div>
                        <div className="font-mono text-lg font-semibold text-gray-900">
                          {folder}
                        </div>
                      </div>
                    )
                  }
                  return null
                })()}
              </div>

              {/* Attributes Section */}
              {(() => {
                const extensions = hostDetails.extensions as Record<string, unknown> | undefined
                if (extensions?.attributes) {
                  return (
                    <div className="mb-6">
                      <div className="flex items-center mb-4 pb-2 border-b-2 border-blue-500">
                        <h3 className="text-lg font-bold text-gray-900">
                          {showEffectiveAttributes ? 'Effective Attributes' : 'Attributes'}
                        </h3>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                        <JsonRenderer data={extensions.attributes} />
                      </div>
                    </div>
                  )
                }
                return null
              })()}

              {/* Effective Attributes Section (separate) */}
              {(() => {
                const extensions = hostDetails.extensions as Record<string, unknown> | undefined
                if (showEffectiveAttributes && extensions?.effective_attributes) {
                  return (
                    <div className="mb-6">
                      <div className="flex items-center mb-4 pb-2 border-b-2 border-indigo-500">
                        <h3 className="text-lg font-bold text-indigo-700">Effective Attributes</h3>
                      </div>
                      <div className="bg-indigo-50/50 rounded-lg p-6 border border-indigo-200">
                        <JsonRenderer data={extensions.effective_attributes} />
                      </div>
                    </div>
                  )
                }
                return null
              })()}

              {/* Cluster Info */}
              {(() => {
                const extensions = hostDetails.extensions as Record<string, unknown> | undefined
                if (extensions?.is_cluster) {
                  return (
                    <div className="mb-6">
                      <div className="flex items-center mb-4 pb-2 border-b-2 border-amber-500">
                        <h3 className="text-lg font-bold text-amber-700">Cluster Information</h3>
                      </div>
                      <div className="bg-amber-50 rounded-lg p-6 border border-amber-200">
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-gray-700">Status:</span>
                            <Badge className="bg-amber-500 hover:bg-amber-600">Cluster</Badge>
                          </div>
                          {extensions.cluster_nodes ? (
                            <div>
                              <div className="text-sm font-semibold text-gray-700 mb-2">Cluster Nodes:</div>
                              <div className="bg-white rounded p-4 border border-amber-200">
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
                  <summary className="flex items-center gap-2 text-sm font-semibold text-gray-600 uppercase tracking-wide cursor-pointer hover:text-blue-600 transition-colors select-none py-3">
                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                    Raw JSON Response
                  </summary>
                  <div className="mt-3 bg-gray-900 rounded-lg p-4 overflow-auto max-h-96 border border-gray-700">
                    <pre className="text-xs text-green-400 font-mono leading-relaxed">
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
