'use client'

import { Server } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DeviceListProps {
  devices: string[]
  selectedDevice: string | null
  onSelect: (device: string | null) => void
  isLoading: boolean
}

export function DeviceList({ devices, selectedDevice, onSelect, isLoading }: DeviceListProps) {
  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2">
          <Server className="h-4 w-4" />
          <span className="text-sm font-medium">Devices</span>
        </div>
        {!isLoading && (
          <div className="text-xs text-blue-100">{devices.length} device{devices.length !== 1 ? 's' : ''}</div>
        )}
      </div>

      <div className="bg-gradient-to-b from-white to-gray-50 rounded-b-lg">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {/* "All" entry */}
            <li>
              <button
                onClick={() => onSelect(null)}
                className={cn(
                  'w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-blue-50',
                  selectedDevice === null
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700'
                )}
              >
                All
              </button>
            </li>

            {devices.map((device) => (
              <li key={device}>
                <button
                  onClick={() => onSelect(device)}
                  className={cn(
                    'w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-blue-50 truncate',
                    selectedDevice === device
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700'
                  )}
                  title={device}
                >
                  {device}
                </button>
              </li>
            ))}

            {devices.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-gray-400">
                No data collected yet
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
