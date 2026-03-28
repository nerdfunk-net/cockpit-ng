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
import { Wifi, Loader2, CheckCircle2 } from 'lucide-react'
import type { UseMutationResult } from '@tanstack/react-query'
import type { DeviceInfo } from '@/components/shared/device-selector'
import { DeviceSelectionTab } from '../../deploy/tabs/device-selection-tab'
import type { PingInput, PingJobResponse } from '../types'

const EMPTY_DEVICES: DeviceInfo[] = []
const EMPTY_IDS: string[] = []

interface PingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentId: string
  mutation: UseMutationResult<PingJobResponse, Error, PingInput>
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
          {mutation.isSuccess ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <div>
                <p className="font-medium text-lg">Ping Job Queued</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {mutation.data.message}
                </p>
              </div>
            </div>
          ) : (
            <DeviceSelectionTab
              selectedDeviceIds={selectedDeviceIds}
              selectedDevices={selectedDevices}
              onDevicesSelected={handleDevicesSelected}
              onInventoryLoaded={handleInventoryLoaded}
            />
          )}
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            {mutation.isSuccess ? 'Close' : 'Cancel'}
          </Button>
          {!mutation.isSuccess && (
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
