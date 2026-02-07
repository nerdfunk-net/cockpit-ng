'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, RefreshCw } from 'lucide-react'
import { useDeviceSearchQuery } from '../hooks/use-device-search-query'
import type { DeviceSearchResult } from '../types/templates'
import { DEVICE_SEARCH_MIN_CHARS } from '../utils/template-constants'

interface DeviceSearchPanelProps {
  selectedDevice: DeviceSearchResult | null
  onDeviceSelect: (device: DeviceSearchResult) => void
  onDeviceClear: () => void
  onShowNautobotData: () => void
  onRenderTemplate: () => void
  canRender: boolean
  isRendering: boolean
}

export function DeviceSearchPanel({
  selectedDevice,
  onDeviceSelect,
  onDeviceClear,
  onShowNautobotData,
  onRenderTemplate,
  canRender,
  isRendering,
}: DeviceSearchPanelProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  // Debounce the search term
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(searchTerm), 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const { data: devices = [], isLoading } = useDeviceSearchQuery(debouncedTerm, {
    enabled: debouncedTerm.length >= DEVICE_SEARCH_MIN_CHARS && !selectedDevice,
  })

  // Show dropdown when results arrive
  useEffect(() => {
    if (devices.length > 0 && !selectedDevice) {
      setShowDropdown(true)
    }
  }, [devices, selectedDevice])

  const handleSelect = (device: DeviceSearchResult) => {
    onDeviceSelect(device)
    setSearchTerm(device.name)
    setShowDropdown(false)
  }

  const handleClear = () => {
    onDeviceClear()
    setSearchTerm('')
    setDebouncedTerm('')
    setShowDropdown(false)
  }

  return (
    <div className="space-y-2 p-4 bg-amber-50 border-2 border-amber-200 rounded-lg">
      <div className="flex items-center justify-between">
        <Label htmlFor="device-search" className="text-sm font-medium text-amber-900">
          Device (Optional - for previewing Nautobot data)
        </Label>
        {selectedDevice && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onShowNautobotData}
            className="h-7 text-xs"
          >
            <Eye className="h-3 w-3 mr-1" />
            Show Nautobot Data
          </Button>
        )}
      </div>
      <div className="relative">
        <Input
          id="device-search"
          placeholder="Type at least 3 characters to search devices..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border-2 border-slate-300 bg-white focus:border-blue-500"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <RefreshCw className="h-4 w-4 animate-spin text-gray-400" />
          </div>
        )}

        {showDropdown && devices.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border-2 border-blue-300 rounded-md shadow-lg max-h-60 overflow-auto">
            {devices.map(device => (
              <button
                key={device.id}
                type="button"
                onClick={() => handleSelect(device)}
                className="w-full px-4 py-2 text-left hover:bg-blue-50 transition-colors border-b last:border-b-0"
              >
                <div className="font-medium text-sm">{device.name}</div>
                {device.primary_ip4 && (
                  <div className="text-xs text-gray-500">
                    {typeof device.primary_ip4 === 'object' ? device.primary_ip4.address : device.primary_ip4}
                    {device.location && ` \u2022 ${device.location.name}`}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {showDropdown && devices.length === 0 && debouncedTerm.length >= DEVICE_SEARCH_MIN_CHARS && !isLoading && (
          <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-300 rounded-md shadow-lg px-4 py-2 text-sm text-gray-500">
            No devices found matching &quot;{debouncedTerm}&quot;
          </div>
        )}
      </div>

      {selectedDevice && (
        <div className="p-3 bg-white border-2 border-amber-300 rounded-md">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm text-amber-900">{selectedDevice.name}</div>
              {selectedDevice.primary_ip4 && (
                <div className="text-xs text-amber-700">
                  {typeof selectedDevice.primary_ip4 === 'object'
                    ? selectedDevice.primary_ip4.address
                    : selectedDevice.primary_ip4}
                  {selectedDevice.location && ` \u2022 ${selectedDevice.location.name}`}
                </div>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-amber-600 hover:text-amber-800 h-7 text-xs"
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Test Template Button */}
      <div className="pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onRenderTemplate}
          disabled={!canRender || isRendering}
          className="w-full border-2 border-amber-600 text-amber-800 hover:bg-amber-600 hover:text-white font-semibold"
        >
          {isRendering ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <Eye className="h-4 w-4 mr-2" />
              Test Template
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
