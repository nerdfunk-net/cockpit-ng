'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Wifi, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import type { UseMutationResult } from '@tanstack/react-query'
import type { DeviceInfo } from '@/components/shared/device-selector'
import { DeviceSelectionTab } from '../../deploy/tabs/device-selection-tab'
import type { PingInput, PingCommandResult, PingOutput } from '../types'

const EMPTY_DEVICES: DeviceInfo[] = []
const EMPTY_IDS: string[] = []

interface PingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentId: string
  mutation: UseMutationResult<PingCommandResult, Error, PingInput>
}

export function PingDialog({ open, onOpenChange, agentId, mutation }: PingDialogProps) {
  const [selectedDevices, setSelectedDevices] = useState<DeviceInfo[]>(EMPTY_DEVICES)
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>(EMPTY_IDS)
  const [inventoryId, setInventoryId] = useState<number | null>(null)

  const handleDevicesSelected = useCallback((devices: DeviceInfo[]) => {
    setSelectedDevices(devices)
    setSelectedDeviceIds(devices.map(d => d.id))
  }, [])

  const handleInventoryLoaded = useCallback((id: number) => {
    setInventoryId(id)
  }, [])

  const handleSubmit = useCallback(() => {
    if (!inventoryId) return
    mutation.mutate({ agent_id: agentId, inventory_id: inventoryId })
  }, [agentId, inventoryId, mutation])

  const handleClose = useCallback(() => {
    mutation.reset()
    setSelectedDevices(EMPTY_DEVICES)
    setSelectedDeviceIds(EMPTY_IDS)
    setInventoryId(null)
    onOpenChange(false)
  }, [mutation, onOpenChange])

  const pingOutput: PingOutput | null = mutation.data?.output ?? null

  const canPing = useMemo(
    () => inventoryId !== null && selectedDevices.length > 0 && !mutation.isPending,
    [inventoryId, selectedDevices.length, mutation.isPending]
  )

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="!max-w-[95vw] w-[95vw] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            Ping Devices — Agent: {agentId}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Device / inventory selection */}
          {!pingOutput && (
            <DeviceSelectionTab
              selectedDeviceIds={selectedDeviceIds}
              selectedDevices={selectedDevices}
              onDevicesSelected={handleDevicesSelected}
              onInventoryLoaded={handleInventoryLoaded}
            />
          )}

          {/* Ping results */}
          {pingOutput && <PingResults output={pingOutput} />}
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            {pingOutput ? 'Close' : 'Cancel'}
          </Button>
          {!pingOutput && (
            <Button onClick={handleSubmit} disabled={!canPing}>
              {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {!inventoryId
                ? 'Load an inventory to enable ping'
                : selectedDevices.length === 0
                  ? 'No devices selected'
                  : `Ping ${selectedDevices.length} device${selectedDevices.length === 1 ? '' : 's'}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Results sub-component
// ---------------------------------------------------------------------------

function PingResults({ output }: { output: PingOutput }) {
  return (
    <div className="space-y-4 py-2">
      {/* Summary row */}
      <div className="flex gap-4 text-sm">
        <span className="text-muted-foreground">
          Total devices: <strong>{output.total_devices}</strong>
        </span>
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
          {output.reachable_count} reachable
        </Badge>
        {output.unreachable_count > 0 && (
          <Badge variant="destructive">{output.unreachable_count} unreachable</Badge>
        )}
      </div>

      {/* Per-device breakdown */}
      <div className="space-y-3">
        {output.results.map(device => (
          <div key={device.device_name} className="border rounded-lg p-3">
            <p className="font-medium text-sm mb-2">{device.device_name}</p>
            <div className="space-y-1">
              {device.ip_results.map(ip => (
                <div key={ip.ip_address} className="flex items-center gap-3 text-xs">
                  {ip.reachable ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  )}
                  <span className="font-mono w-36">{ip.ip_address}</span>
                  {ip.reachable ? (
                    <span className="text-green-700">{ip.latency_ms} ms</span>
                  ) : (
                    <span className="text-red-500">not reachable</span>
                  )}
                  {ip.packet_loss_percent > 0 && ip.reachable && (
                    <span className="text-amber-500">
                      {ip.packet_loss_percent}% loss
                    </span>
                  )}
                </div>
              ))}
              {device.ip_results.length === 0 && (
                <p className="text-xs text-muted-foreground">No IP addresses found</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
