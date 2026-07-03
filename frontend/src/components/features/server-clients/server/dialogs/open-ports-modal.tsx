'use client'

import { DoorOpen } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PortBindingBadge } from '../components/port-binding-badge'
import type { ServerOpenPorts } from '../types'

interface OpenPortsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  label: string
  openPorts: ServerOpenPorts | null | undefined
}

export function OpenPortsModal({ open, onOpenChange, label, openPorts }: OpenPortsModalProps) {
  const tcpPorts = openPorts?.tcp_ports ?? []
  const udpPorts = openPorts?.udp_ports ?? []
  const hasPorts = tcpPorts.length > 0 || udpPorts.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DoorOpen className="h-5 w-5 text-blue-600" />
            Open Ports — {label}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto min-h-0">
          {hasPorts ? (
            <div className="grid grid-cols-2 gap-4 p-1">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-gray-500 uppercase tracking-wide">
                  TCP ({tcpPorts.length})
                </span>
                {tcpPorts.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {tcpPorts.map((binding) => (
                      <PortBindingBadge
                        key={`${binding.address}:${binding.port}`}
                        binding={binding}
                      />
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 italic">None</span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-gray-500 uppercase tracking-wide">
                  UDP ({udpPorts.length})
                </span>
                {udpPorts.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {udpPorts.map((binding) => (
                      <PortBindingBadge
                        key={`${binding.address}:${binding.port}`}
                        binding={binding}
                      />
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 italic">None</span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-sm text-gray-400">
              No open ports recorded for this snapshot.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
