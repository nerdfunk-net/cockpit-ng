import React, { useState, useEffect, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { InventoryRenderer } from '../renderers/inventory-renderer'
import { useApi } from '@/hooks/use-api'
import type { CheckMKHost } from '@/types/checkmk/types'

interface InventoryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  host: CheckMKHost | null
}

export function InventoryModal({ open, onOpenChange, host }: InventoryModalProps) {
  const { apiCall } = useApi()
  const [inventoryData, setInventoryData] = useState<Record<string, unknown> | null>(null)
  const [loadingInventory, setLoadingInventory] = useState(false)

  const loadInventory = useCallback(async (hostName: string) => {
    try {
      setLoadingInventory(true)
      const response = await apiCall<{ success: boolean; message: string; data: Record<string, unknown> }>(`checkmk/inventory/${hostName}`)
      // Extract the actual inventory data from the CheckMKOperationResponse wrapper
      setInventoryData(response?.data || null)
    } catch (err) {
      console.error('Failed to load inventory:', err)
      setInventoryData(null)
    } finally {
      setLoadingInventory(false)
    }
  }, [apiCall])

  // Load inventory when modal opens or host changes
  useEffect(() => {
    if (open && host) {
      void loadInventory(host.host_name)
    }
  }, [open, host, loadInventory])

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setInventoryData(null)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[64vw] !w-[64vw] max-h-[90vh] overflow-hidden flex flex-col p-0" style={{ maxWidth: '64vw', width: '64vw' }}>
        <DialogHeader className="sr-only">
          <DialogTitle>Inventory - {host?.host_name}</DialogTitle>
          <DialogDescription>View inventory data for the selected host</DialogDescription>
        </DialogHeader>

        {/* Compact Blue Header */}
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
          <div>
            <h2 className="text-base font-semibold">Host Inventory</h2>
            <p className="text-blue-100 text-xs">{host?.host_name}</p>
          </div>
        </div>

        {/* Inventory Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50/50">
          {loadingInventory ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-sm text-muted-foreground">Loading inventory...</p>
              </div>
            </div>
          ) : inventoryData ? (
            <div className="p-4">
              {/* Check if result exists and has data */}
              {(inventoryData.result as Record<string, unknown>) &&
               Object.keys(inventoryData.result as Record<string, unknown>).length > 0 ? (
                (() => {
                  const result = inventoryData.result as Record<string, unknown>
                  const hostname = Object.keys(result)[0]
                  if (!hostname) return null
                  const hostData = result[hostname] as Record<string, unknown>
                  const nodes = (hostData?.Nodes as Record<string, unknown>) || {}

                  return (
                    <>
                      {/* Render all top-level nodes dynamically */}
                      {Object.entries(nodes).map(([nodeName, nodeData]) => {
                        // Determine color scheme based on node name
                        let borderColor = 'border-gray-400/60'
                        let textColor = 'text-gray-900'
                        let bgColor = 'bg-white'

                        if (nodeName === 'hardware') {
                          borderColor = 'border-blue-400/60'
                          textColor = 'text-gray-900'
                          bgColor = 'bg-white'
                        } else if (nodeName === 'networking') {
                          borderColor = 'border-green-400/60'
                          textColor = 'text-green-700'
                          bgColor = 'bg-green-50/30'
                        } else if (nodeName === 'software') {
                          borderColor = 'border-purple-400/60'
                          textColor = 'text-purple-700'
                          bgColor = 'bg-purple-50/30'
                        }

                        return (
                          <div key={nodeName} className="mb-4">
                            <div className={`flex items-center mb-2 pb-1.5 border-b ${borderColor}`}>
                              <h3 className={`text-sm font-semibold capitalize ${textColor}`}>{nodeName}</h3>
                            </div>
                            <div className={`${bgColor} rounded-md p-4 border ${borderColor}`}>
                              <InventoryRenderer data={nodeData} />
                            </div>
                          </div>
                        )
                      })}

                      {/* Show message if no nodes */}
                      {Object.keys(nodes).length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          No inventory nodes available for this host
                        </div>
                      )}

                      {/* Raw JSON Section */}
                      <div>
                        <details className="group">
                          <summary className="flex items-center gap-1.5 text-xs font-medium text-gray-600 uppercase tracking-wide cursor-pointer hover:text-blue-600 transition-colors select-none py-2">
                            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                            Raw JSON Response
                          </summary>
                          <div className="mt-2 bg-gray-900 rounded-md p-3 overflow-auto max-h-80 border border-gray-700">
                            <pre className="text-[11px] text-green-400 font-mono leading-relaxed">
                              {JSON.stringify(inventoryData, null, 2)}
                            </pre>
                          </div>
                        </details>
                      </div>
                    </>
                  )
                })()
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No inventory data available for this host
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No inventory data available
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
