'use client'

import { useRef, useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Loader2 } from 'lucide-react'
import {
  RACK_UNIT_HEIGHT_PX,
  RACK_GUTTER_WIDTH_PX,
  RACK_BODY_WIDTH_PX,
  RACK_STATUS_INDICATOR_PX,
} from '../constants'
import type { RackFaceAssignments, ActiveSlot, DeviceSearchResult } from '../types'

interface RackElevationProps {
  face: 'front' | 'rear'
  uHeight: number
  assignments: RackFaceAssignments
  onAdd: (position: number, device: DeviceSearchResult) => void
  onRemove: (position: number) => void
  onMoveToUnpositioned: (position: number) => void
  onMoveReservationToUnknown: (position: number) => void
  onAddReservation: (position: number, description: string) => void
  deviceSearchQuery: string
  onDeviceSearchQueryChange: (q: string) => void
  deviceSearchResults: DeviceSearchResult[]
  isSearching: boolean
  activeSlot: ActiveSlot | null
  onSetActiveSlot: (slot: ActiveSlot | null) => void
}

const STATUS_COLORS: Record<string, string> = {
  active: '#4caf50',
  planned: '#2196f3',
  staged: '#9c27b0',
  failed: '#f44336',
  decommissioning: '#ff9800',
  inventory: '#9e9e9e',
}

function getStatusColor(statusName?: string) {
  if (!statusName) return STATUS_COLORS['active']
  return STATUS_COLORS[statusName.toLowerCase()] ?? '#4caf50'
}

export function RackElevation({
  face,
  uHeight,
  assignments,
  onAdd,
  onRemove,
  onMoveToUnpositioned,
  onMoveReservationToUnknown,
  onAddReservation,
  deviceSearchQuery,
  onDeviceSearchQueryChange,
  deviceSearchResults,
  isSearching,
  activeSlot,
  onSetActiveSlot,
}: RackElevationProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [popoverRef, setPopoverRef] = useState<HTMLDivElement | null>(null)

  // Reservation input state (local — no need to lift this up)
  const resInputRef = useRef<HTMLInputElement>(null)
  const [resPopoverRef, setResPopoverRef] = useState<HTMLDivElement | null>(null)
  const [resSlot, setResSlot] = useState<number | null>(null)
  const [resDesc, setResDesc] = useState('')

  // Auto-focus device search input when a slot becomes active
  useEffect(() => {
    if (activeSlot?.face === face && inputRef.current) {
      inputRef.current.focus()
    }
  }, [activeSlot, face])

  // Auto-focus reservation input when resSlot opens
  useEffect(() => {
    if (resSlot !== null && resInputRef.current) {
      resInputRef.current.focus()
    }
  }, [resSlot])

  // Clear resSlot when the device-search activeSlot opens on this face (mutually exclusive)
  useEffect(() => {
    if (activeSlot?.face === face && activeSlot.position !== null) {
      setResSlot(null)
      setResDesc('')
    }
  }, [activeSlot, face])

  // Click-outside to close active slot and/or resSlot
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const outsideDevicePopover = !popoverRef || !popoverRef.contains(e.target as Node)
      const outsideResPopover = !resPopoverRef || !resPopoverRef.contains(e.target as Node)
      if (outsideDevicePopover && outsideResPopover) {
        onSetActiveSlot(null)
        onDeviceSearchQueryChange('')
        setResSlot(null)
        setResDesc('')
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [popoverRef, resPopoverRef, onSetActiveSlot, onDeviceSearchQueryChange])

  const rows = Array.from({ length: uHeight }, (_, i) => uHeight - i)
  const bodyHeight = uHeight * RACK_UNIT_HEIGHT_PX

  // Top pixel offset of unit u within the rack body (top = highest unit number)
  const unitTop = (u: number) => (uHeight - u) * RACK_UNIT_HEIGHT_PX

  // Precompute which units are occupied (for background color + skipping empty-slot buttons)
  const occupiedUnits = new Map<number, boolean>() // unit → isReservation
  for (const [posStr, assignment] of Object.entries(assignments)) {
    if (!assignment) continue
    const pos = Number(posStr)
    const h = assignment.uHeight ?? 1
    for (let k = 0; k < h; k++) {
      occupiedUnits.set(pos + k, assignment.isReservation === true)
    }
  }

  return (
    <div className="inline-flex select-none relative" style={{ fontFamily: 'monospace', fontSize: 10 }}>
      {/* Rack frame — overlay with high z-index so background rows never cover it */}
      <div
        className="absolute pointer-events-none border-2 border-black"
        style={{ left: RACK_GUTTER_WIDTH_PX, top: 0, width: RACK_BODY_WIDTH_PX, height: bodyHeight, zIndex: 20 }}
      />

      {/* Gutter: unit numbers — one fixed-height row per unit, always 1 to uHeight */}
      <div className="shrink-0" style={{ width: RACK_GUTTER_WIDTH_PX }}>
        {rows.map((u) => (
          <div
            key={u}
            className="flex items-center justify-end pr-1 text-gray-400"
            style={{ height: RACK_UNIT_HEIGHT_PX, fontSize: 10 }}
          >
            {u}
          </div>
        ))}
      </div>

      {/* Rack body: position:relative so device blocks can span multiple units */}
      <div
        className="relative"
        style={{ width: RACK_BODY_WIDTH_PX, height: bodyHeight }}
      >
        {/* Background grid: one row per unit, provides borders and empty-slot color */}
        {rows.map((u) => {
          const isOccupied = occupiedUnits.has(u)
          const isReservationUnit = occupiedUnits.get(u) === true
          const bgColor = isReservationUnit ? '#455a64' : isOccupied ? '#9e9e9e' : '#f7f7f7'
          return (
            <div
              key={u}
              className="absolute border-b border-gray-200"
              style={{
                top: unitTop(u),
                left: 0,
                right: 0,
                height: RACK_UNIT_HEIGHT_PX,
                backgroundColor: bgColor,
              }}
            />
          )
        })}

        {/* Device blocks: absolutely positioned, span full uHeight */}
        {Object.entries(assignments).map(([posStr, assignment]) => {
          if (!assignment) return null
          const pos = Number(posStr)
          const h = assignment.uHeight ?? 1
          const top = unitTop(pos + h - 1)
          const height = h * RACK_UNIT_HEIGHT_PX
          const isReservation = assignment.isReservation === true
          const bgColor = isReservation ? '#455a64' : '#9e9e9e'
          return (
            <div
              key={posStr}
              className="absolute flex items-center overflow-hidden"
              style={{ top, left: 0, right: 0, height, backgroundColor: bgColor, zIndex: 1 }}
            >
              {isReservation ? (
                /* Reservation: amber left stripe instead of status color */
                <div
                  className="shrink-0 h-full"
                  style={{ width: RACK_STATUS_INDICATOR_PX, backgroundColor: '#f59e0b' }}
                />
              ) : (
                /* Normal device: status color indicator */
                <div
                  className="shrink-0 h-full"
                  style={{ width: RACK_STATUS_INDICATOR_PX, backgroundColor: getStatusColor('active') }}
                />
              )}
              {/* Device / reservation name */}
              <div
                className="flex-1 text-center text-white truncate px-1"
                style={{ fontSize: 10, textShadow: '1px 1px 2px black' }}
                title={isReservation ? `Reserved: ${assignment.deviceName}` : assignment.deviceName}
              >
                {isReservation ? `[res] ${assignment.deviceName}` : assignment.deviceName}
              </div>
              {/* Move button — to unpositioned for devices, to Unresolved CSV for reservations */}
              {isReservation ? (
                <button
                  type="button"
                  className="shrink-0 h-full flex items-center justify-center text-amber-300 hover:bg-amber-600 hover:text-white transition-colors cursor-pointer"
                  style={{ width: 18 }}
                  title="Move back to Unresolved CSV Devices"
                  onClick={() => onMoveReservationToUnknown(pos)}
                >
                  <ArrowLeft style={{ width: 10, height: 10 }} />
                </button>
              ) : (
                <button
                  type="button"
                  className="shrink-0 h-full flex items-center justify-center text-blue-300 hover:bg-blue-500 hover:text-white transition-colors cursor-pointer"
                  style={{ width: 18 }}
                  title="Move to unpositioned (keep rack)"
                  onClick={() => onMoveToUnpositioned(pos)}
                >
                  <ArrowLeft style={{ width: 10, height: 10 }} />
                </button>
              )}
              {/* Remove button */}
              <button
                type="button"
                className="shrink-0 h-full flex items-center justify-center text-red-300 hover:bg-red-600 hover:text-white transition-colors cursor-pointer"
                style={{ width: 18 }}
                title={isReservation ? 'Remove reservation' : 'Remove device from rack'}
                onClick={() => onRemove(pos)}
              >
                <span style={{ fontSize: 14, lineHeight: 1 }}>−</span>
              </button>
            </div>
          )
        })}

        {/* Empty slot buttons: one per unoccupied unit */}
        {rows.map((u) => {
          if (occupiedUnits.has(u)) return null  // occupied (device or reservation)
          const isActive = activeSlot?.face === face && activeSlot?.position === u
          const isResActive = resSlot === u
          return (
            <div
              key={u}
              className={`absolute ${isActive || isResActive ? 'z-50' : 'z-10'}`}
              style={{ top: unitTop(u), left: 0, right: 0, height: RACK_UNIT_HEIGHT_PX }}
            >
              {isActive ? (
                /* Device search popover */
                <div
                  ref={(el) => setPopoverRef(el)}
                  className="absolute left-0 top-0 w-full"
                  style={{ minHeight: RACK_UNIT_HEIGHT_PX, zIndex: 50 }}
                >
                  <div
                    className="flex items-center w-full bg-white border border-blue-400 shadow-sm"
                    style={{ height: RACK_UNIT_HEIGHT_PX }}
                  >
                    <Input
                      ref={inputRef}
                      value={deviceSearchQuery}
                      onChange={(e) => onDeviceSearchQueryChange(e.target.value)}
                      placeholder="Type device name..."
                      className="h-full border-0 focus-visible:ring-0 text-xs px-1 py-0"
                      style={{ fontSize: 10, height: RACK_UNIT_HEIGHT_PX }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          onSetActiveSlot(null)
                          onDeviceSearchQueryChange('')
                        }
                        if (e.key === 'Enter' && deviceSearchResults.length > 0) {
                          const first = deviceSearchResults[0]
                          if (first) {
                            onAdd(u, first)
                            onSetActiveSlot(null)
                            onDeviceSearchQueryChange('')
                          }
                        }
                      }}
                    />
                    {isSearching && (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground mr-1 shrink-0" />
                    )}
                  </div>
                  {deviceSearchResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full bg-white border border-gray-200 shadow-lg max-h-40 overflow-y-auto z-50 rounded-b-md">
                      {deviceSearchResults.map((device) => (
                        <div
                          key={device.id}
                          className="px-2 py-1 text-xs hover:bg-blue-50 cursor-pointer border-b last:border-b-0 text-gray-800"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            onAdd(u, device)
                            onSetActiveSlot(null)
                            onDeviceSearchQueryChange('')
                          }}
                        >
                          {device.name}
                        </div>
                      ))}
                    </div>
                  )}
                  {deviceSearchQuery.length >= 2 &&
                    !isSearching &&
                    deviceSearchResults.length === 0 && (
                      <div className="absolute left-0 right-0 top-full bg-white border border-gray-200 shadow-lg z-50 rounded-b-md">
                        <div className="px-2 py-1 text-xs text-gray-400 italic">
                          No devices found
                        </div>
                      </div>
                    )}
                </div>
              ) : isResActive ? (
                /* Reservation description input */
                <div
                  ref={(el) => setResPopoverRef(el)}
                  className="absolute left-0 top-0 w-full"
                  style={{ zIndex: 50 }}
                >
                  <div
                    className="flex items-center w-full bg-white border border-amber-400 shadow-sm"
                    style={{ height: RACK_UNIT_HEIGHT_PX }}
                  >
                    <Input
                      ref={resInputRef}
                      value={resDesc}
                      onChange={(e) => setResDesc(e.target.value)}
                      placeholder="Reservation description…"
                      className="h-full border-0 focus-visible:ring-0 text-xs px-1 py-0"
                      style={{ fontSize: 10, height: RACK_UNIT_HEIGHT_PX }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setResSlot(null)
                          setResDesc('')
                        }
                        if (e.key === 'Enter' && resDesc.trim()) {
                          onAddReservation(u, resDesc.trim())
                          setResSlot(null)
                          setResDesc('')
                        }
                      }}
                    />
                  </div>
                </div>
              ) : (
                /* Normal empty unit: add-device + (res) buttons */
                <div className="flex items-center w-full h-full">
                  <button
                    type="button"
                    className="flex-1 h-full flex items-center justify-center text-gray-400 hover:bg-blue-50 hover:text-blue-500 transition-colors cursor-pointer"
                    onClick={() => {
                      onSetActiveSlot({ position: u, face })
                      onDeviceSearchQueryChange('')
                    }}
                  >
                    <span style={{ fontSize: 9 }}>+ add device</span>
                  </button>
                  <button
                    type="button"
                    className="shrink-0 h-full flex items-center justify-center text-gray-400 hover:bg-amber-50 hover:text-amber-600 transition-colors cursor-pointer border-l border-gray-200"
                    style={{ width: 32, fontSize: 9 }}
                    title="Add reservation"
                    onClick={() => {
                      onSetActiveSlot(null)
                      onDeviceSearchQueryChange('')
                      setResSlot(u)
                      setResDesc('')
                    }}
                  >
                    (res)
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
