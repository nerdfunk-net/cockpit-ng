'use client'

import { useCallback } from 'react'
import { TableIcon, ChevronLeft, ChevronRight, History } from 'lucide-react'
import type { ClientDataItem } from '../types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200, 500] as const

interface ColumnFilters {
  ipAddress: string
  macAddress: string
  port: string
  vlan: string
  hostname: string
  deviceName: string
}

interface ClientsTableProps {
  items: ClientDataItem[]
  total: number
  page: number
  pageSize: number
  filters: ColumnFilters
  isLoading: boolean
  isFetching?: boolean
  onFilterChange: (key: keyof ColumnFilters, value: string) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  selectedDevice: string | null
  onHistoryClick: (item: ClientDataItem) => void
}

export function ClientsTable({
  items,
  total,
  page,
  pageSize,
  filters,
  isLoading,
  isFetching = false,
  onFilterChange,
  onPageChange,
  onPageSizeChange,
  selectedDevice,
  onHistoryClick,
}: ClientsTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const startRow = total === 0 ? 0 : (page - 1) * pageSize + 1
  const endRow = Math.min(page * pageSize, total)

  const handleFilterChange = useCallback(
    (key: keyof ColumnFilters) => (e: React.ChangeEvent<HTMLInputElement>) => {
      onFilterChange(key, e.target.value)
    },
    [onFilterChange]
  )

  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2">
          <TableIcon className="h-4 w-4" />
          <span className="text-sm font-medium">
            {selectedDevice ? `Clients — ${selectedDevice}` : 'All Clients'}
          </span>
          {isFetching && !isLoading && (
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white opacity-70" />
          )}
        </div>
        <div className="text-xs text-blue-100">
          {total > 0 ? `${startRow}–${endRow} of ${total}` : '0 entries'}
        </div>
      </div>

      <div className="bg-gradient-to-b from-white to-gray-50 rounded-b-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
            <span className="ml-2 text-sm text-gray-600">Loading...</span>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  {/* Column name row */}
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-2 font-medium text-gray-700 whitespace-nowrap">
                      IP Address
                    </th>
                    <th className="text-left px-4 py-2 font-medium text-gray-700 whitespace-nowrap">
                      MAC Address
                    </th>
                    <th className="text-left px-4 py-2 font-medium text-gray-700 whitespace-nowrap">
                      Port
                    </th>
                    <th className="text-left px-4 py-2 font-medium text-gray-700 whitespace-nowrap">
                      VLAN
                    </th>
                    <th className="text-left px-4 py-2 font-medium text-gray-700 whitespace-nowrap">
                      Hostname
                    </th>
                    <th className="text-left px-4 py-2 font-medium text-gray-700 whitespace-nowrap">
                      Device
                    </th>
                  </tr>
                  {/* Filter row */}
                  <tr className="border-b border-gray-200">
                    <th className="px-2 py-1.5">
                      <Input
                        placeholder="Filter..."
                        value={filters.ipAddress}
                        onChange={handleFilterChange('ipAddress')}
                        className="h-7 text-xs"
                      />
                    </th>
                    <th className="px-2 py-1.5">
                      <Input
                        placeholder="Filter..."
                        value={filters.macAddress}
                        onChange={handleFilterChange('macAddress')}
                        className="h-7 text-xs"
                      />
                    </th>
                    <th className="px-2 py-1.5">
                      <Input
                        placeholder="Filter..."
                        value={filters.port}
                        onChange={handleFilterChange('port')}
                        className="h-7 text-xs"
                      />
                    </th>
                    <th className="px-2 py-1.5">
                      <Input
                        placeholder="Filter..."
                        value={filters.vlan}
                        onChange={handleFilterChange('vlan')}
                        className="h-7 text-xs"
                      />
                    </th>
                    <th className="px-2 py-1.5">
                      <Input
                        placeholder="Filter..."
                        value={filters.hostname}
                        onChange={handleFilterChange('hostname')}
                        className="h-7 text-xs"
                      />
                    </th>
                    <th className="px-2 py-1.5">
                      <Input
                        placeholder="Filter..."
                        value={filters.deviceName}
                        onChange={handleFilterChange('deviceName')}
                        className="h-7 text-xs"
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-gray-500">
                        <p className="text-base font-medium">No entries found</p>
                        <p className="text-xs mt-1">
                          {total === 0
                            ? 'Run a Get Client Data job to collect data'
                            : 'Try clearing the filters'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr
                        key={`${item.session_id}-${item.ip_address}`}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-2 font-mono text-xs text-gray-800">
                          <span className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onHistoryClick(item)}
                              className="text-gray-400 hover:text-blue-600 transition-colors shrink-0"
                              title="Show history"
                            >
                              <History className="h-3.5 w-3.5" />
                            </button>
                            {item.ip_address ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-gray-800">
                          {item.mac_address ?? '—'}
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-700">
                          {item.port ?? '—'}
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-700">
                          {item.vlan ?? '—'}
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-700">
                          {item.hostname ?? '—'}
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-700">
                          {item.device_name}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {total > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Select
                    value={String(pageSize)}
                    onValueChange={(v) => onPageSizeChange(Number(v))}
                  >
                    <SelectTrigger className="h-7 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <SelectItem key={size} value={String(size)} className="text-xs">
                          {size} / page
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
