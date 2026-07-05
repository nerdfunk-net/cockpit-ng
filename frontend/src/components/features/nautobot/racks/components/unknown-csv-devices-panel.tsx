'use client'

import { useState, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Loader2, ArrowRight } from 'lucide-react'
import { useDeviceSearchQuery } from '../hooks/use-device-search-query'
import type { UnknownCsvDevice, DeviceSearchResult } from '../types'

interface UnknownCsvDevicesPanelProps {
  devices: UnknownCsvDevice[]
  locationId: string | undefined
  onMapDevice: (
    csvName: string,
    device: DeviceSearchResult,
    csvPosition: number | null,
    csvFace: 'front' | 'rear' | null
  ) => void
  onAddReservation: (device: UnknownCsvDevice) => void
}

interface UnknownDeviceRowProps {
  device: UnknownCsvDevice
  locationId: string | undefined
  onMapDevice: UnknownCsvDevicesPanelProps['onMapDevice']
  onAddReservation: UnknownCsvDevicesPanelProps['onAddReservation']
}

function UnknownDeviceRow({
  device,
  locationId,
  onMapDevice,
  onAddReservation,
}: UnknownDeviceRowProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const { results, isSearching } = useDeviceSearchQuery({ query, locationId })

  const handleSelect = (selected: DeviceSearchResult) => {
    onMapDevice(device.csvName, selected, device.csvPosition, device.csvFace)
    setQuery('')
  }

  return (
    <tr className="border-b last:border-b-0">
      <td
        className="px-2 py-1.5 text-foreground truncate max-w-[140px]"
        title={device.csvName}
      >
        {device.csvName}
      </td>
      <td className="px-2 py-1.5">
        <div className="relative">
          <div className="flex items-center border border-border rounded bg-card focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
            <Input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Type device name..."
              className="h-6 border-0 focus-visible:ring-0 text-xs px-1.5 py-0 bg-transparent"
              style={{ fontSize: 11 }}
              onKeyDown={e => {
                if (e.key === 'Escape') setQuery('')
                if (e.key === 'Enter' && results.length > 0) {
                  const first = results[0]
                  if (first) handleSelect(first)
                }
              }}
            />
            {isSearching && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground mr-1 shrink-0" />
            )}
            <button
              type="button"
              title="Add as rack reservation (no Nautobot device needed)"
              className="shrink-0 mr-1 text-warning-foreground hover:text-warning-foreground/70 transition-colors cursor-pointer"
              onClick={() => onAddReservation(device)}
            >
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {results.length > 0 && (
            <div className="absolute left-0 right-0 top-full bg-card border border-border shadow-lg max-h-40 overflow-y-auto z-50 rounded-b-md">
              {results.map(d => (
                <div
                  key={d.id}
                  className="px-2 py-1 text-xs hover:bg-info cursor-pointer border-b last:border-b-0 text-foreground"
                  onMouseDown={e => {
                    e.preventDefault()
                    handleSelect(d)
                  }}
                >
                  {d.name}
                </div>
              ))}
            </div>
          )}
          {query.length >= 2 && !isSearching && results.length === 0 && (
            <div className="absolute left-0 right-0 top-full bg-card border border-border shadow-lg z-50 rounded-b-md">
              <div className="px-2 py-1 text-xs text-muted-foreground italic">
                No devices found
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

export function UnknownCsvDevicesPanel({
  devices,
  locationId,
  onMapDevice,
  onAddReservation,
}: UnknownCsvDevicesPanelProps) {
  if (devices.length === 0) return null

  return (
    <div className="flex flex-col shrink-0" style={{ minWidth: 300, maxWidth: 420 }}>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        Unresolved CSV Devices
      </h3>
      <div className="border rounded-md overflow-visible">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted border-b">
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                Name
              </th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                Mapped Name
                <span
                  className="ml-1 text-warning-foreground"
                  title="Use the → button to add as reservation instead"
                >
                  →
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {devices.map(device => (
              <UnknownDeviceRow
                key={device.csvName}
                device={device}
                locationId={locationId}
                onMapDevice={onMapDevice}
                onAddReservation={onAddReservation}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
