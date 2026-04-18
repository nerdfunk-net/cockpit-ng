'use client'

import { Search, Server, ChevronLeft, ChevronRight, Activity, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { NautobotDevice } from '@/hooks/queries/use-clients-query'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200, 500] as const

interface DeviceListProps {
  devices: string[]
  total: number
  selectedDevice: string | null
  onSelect: (device: string | null) => void
  isLoading: boolean
  search: string
  onSearchChange: (value: string) => void
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  deviceObjects?: NautobotDevice[]
  onLiveStatusClick?: (device: NautobotDevice) => void
  onFilterClick?: () => void
  filterActive?: boolean
}

export function DeviceList({
  devices,
  total,
  selectedDevice,
  onSelect,
  isLoading,
  search,
  onSearchChange,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  deviceObjects,
  onLiveStatusClick,
  onFilterClick,
  filterActive,
}: DeviceListProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const startRow = total === 0 ? 0 : (page - 1) * pageSize + 1
  const endRow = Math.min(page * pageSize, total)

  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2">
          <Server className="h-4 w-4" />
          <span className="text-sm font-medium">Devices</span>
        </div>
        <button
          onClick={onFilterClick}
          className={cn(
            'flex items-center gap-1 text-xs transition-colors',
            filterActive
              ? 'text-yellow-200 hover:text-white'
              : 'text-blue-100 hover:text-white'
          )}
          aria-label="Filter devices"
        >
          <Filter className="h-3.5 w-3.5" />
          Filter
          {filterActive && <span className="h-1.5 w-1.5 rounded-full bg-yellow-300" />}
        </button>
      </div>

      {/* Search input */}
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder="Search devices..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-7 h-7 text-xs"
          />
        </div>
      </div>

      {/* Device list */}
      <div className="bg-gradient-to-b from-white to-gray-50 flex-1">
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

            {devices.map((device) => {
              const deviceObj = deviceObjects?.find((d) => d.name === device)
              return (
                <li key={device} className="group flex items-center">
                  <button
                    onClick={() => onSelect(device)}
                    className={cn(
                      'flex-1 min-w-0 text-left px-4 py-2.5 text-sm transition-colors hover:bg-blue-50 truncate',
                      selectedDevice === device
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-700'
                    )}
                    title={device}
                  >
                    {device}
                  </button>
                  {onLiveStatusClick && deviceObj && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onLiveStatusClick(deviceObj)
                      }}
                      title="Get live status"
                      className={cn(
                        'shrink-0 mr-2 p-1 rounded transition-colors',
                        'opacity-0 group-hover:opacity-100 focus:opacity-100',
                        'text-gray-400 hover:text-blue-500 hover:bg-blue-50'
                      )}
                    >
                      <Activity className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              )
            })}

            {devices.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-gray-400">
                {search ? 'No matching devices' : 'No devices found'}
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Pagination footer */}
      <div className="border-t border-gray-200 px-3 py-2 rounded-b-lg bg-white">
        <div className="flex items-center justify-between gap-1">
          <p className="text-xs text-gray-400 whitespace-nowrap">
            {total > 0 ? `${startRow}–${endRow} / ${total}` : '0'}
          </p>
          <div className="flex items-center gap-1">
            <Select
              value={String(pageSize)}
              onValueChange={(v) => onPageSizeChange(Number(v))}
            >
              <SelectTrigger className="h-6 w-16 text-xs px-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)} className="text-xs">
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4 text-gray-600" />
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4 text-gray-600" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
