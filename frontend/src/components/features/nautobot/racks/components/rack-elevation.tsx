'use client'

import { useRef, useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'
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
  deviceSearchQuery,
  onDeviceSearchQueryChange,
  deviceSearchResults,
  isSearching,
  activeSlot,
  onSetActiveSlot,
}: RackElevationProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [popoverRef, setPopoverRef] = useState<HTMLDivElement | null>(null)

  // Auto-focus input when a slot becomes active
  useEffect(() => {
    if (activeSlot?.face === face && inputRef.current) {
      inputRef.current.focus()
    }
  }, [activeSlot, face])

  // Click-outside to close active slot
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (popoverRef && !popoverRef.contains(e.target as Node)) {
        onSetActiveSlot(null)
        onDeviceSearchQueryChange('')
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [popoverRef, onSetActiveSlot, onDeviceSearchQueryChange])

  const totalWidth = RACK_GUTTER_WIDTH_PX + RACK_BODY_WIDTH_PX

  const rows = Array.from({ length: uHeight }, (_, i) => uHeight - i)

  return (
    <div
      className="relative inline-block select-none"
      style={{ width: totalWidth, fontFamily: 'monospace', fontSize: 10 }}
    >
      {/* Rack outer border */}
      <div
        className="absolute pointer-events-none border-[4px] border-black rounded-sm"
        style={{
          left: RACK_GUTTER_WIDTH_PX - 2,
          top: -2,
          width: RACK_BODY_WIDTH_PX + 4,
          height: uHeight * RACK_UNIT_HEIGHT_PX + 4,
        }}
      />

      {rows.map((unitNumber) => {
        const assignment = assignments[unitNumber] ?? null
        const isActive =
          activeSlot?.face === face && activeSlot?.position === unitNumber

        return (
          <div
            key={unitNumber}
            className="flex"
            style={{ height: RACK_UNIT_HEIGHT_PX }}
          >
            {/* Unit number gutter */}
            <div
              className="flex items-center justify-end pr-1 text-gray-400 shrink-0"
              style={{ width: RACK_GUTTER_WIDTH_PX, fontSize: 10 }}
            >
              {unitNumber}
            </div>

            {/* Rack slot */}
            <div
              className={`relative flex items-center border border-gray-200 ${isActive ? 'overflow-visible' : 'overflow-hidden'}`}
              style={{
                width: RACK_BODY_WIDTH_PX,
                height: RACK_UNIT_HEIGHT_PX,
                backgroundColor: assignment ? '#9e9e9e' : '#f7f7f7',
              }}
            >
              {assignment ? (
                <>
                  {/* Status color indicator */}
                  <div
                    className="shrink-0 h-full"
                    style={{
                      width: RACK_STATUS_INDICATOR_PX,
                      backgroundColor: getStatusColor('active'),
                    }}
                  />
                  {/* Device name */}
                  <div
                    className="flex-1 text-center text-white truncate px-1"
                    style={{ fontSize: 10, textShadow: '1px 1px 2px black' }}
                    title={assignment.deviceName}
                  >
                    {assignment.deviceName}
                  </div>
                  {/* Remove button */}
                  <button
                    type="button"
                    className="shrink-0 h-full flex items-center justify-center text-red-300 hover:bg-red-600 hover:text-white transition-colors cursor-pointer"
                    style={{ width: 18 }}
                    title="Remove device"
                    onClick={() => onRemove(unitNumber)}
                  >
                    <span style={{ fontSize: 14, lineHeight: 1 }}>−</span>
                  </button>
                </>
              ) : isActive ? (
                /* Active add-device input */
                <div
                  ref={(el) => setPopoverRef(el)}
                  className="absolute z-50 left-0 top-0 w-full"
                  style={{ minHeight: RACK_UNIT_HEIGHT_PX }}
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
                            onAdd(unitNumber, first)
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
                  {/* Search results dropdown */}
                  {deviceSearchResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full bg-white border border-gray-200 shadow-lg max-h-40 overflow-y-auto z-50 rounded-b-md">
                      {deviceSearchResults.map((device) => (
                        <div
                          key={device.id}
                          className="px-2 py-1 text-xs hover:bg-blue-50 cursor-pointer border-b last:border-b-0 text-gray-800"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            onAdd(unitNumber, device)
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
              ) : (
                /* Empty slot — add button, text always visible */
                <button
                  type="button"
                  className="w-full h-full flex items-center justify-center text-gray-400 hover:bg-blue-50 hover:text-blue-500 transition-colors cursor-pointer"
                  onClick={() => {
                    onSetActiveSlot({ position: unitNumber, face })
                    onDeviceSearchQueryChange('')
                  }}
                >
                  <span style={{ fontSize: 9 }}>+ add device</span>
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
