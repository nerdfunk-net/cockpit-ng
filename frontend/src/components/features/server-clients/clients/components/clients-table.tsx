'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  TableIcon,
  ChevronLeft,
  ChevronRight,
  History,
  SlidersHorizontal,
} from 'lucide-react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type VisibilityState,
  type ColumnSizingState,
} from '@tanstack/react-table'
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200, 500] as const

const COLUMN_LABELS: Record<string, string> = {
  ip_address: 'IP Address',
  mac_address: 'MAC Address',
  port: 'Port',
  vlan: 'VLAN',
  vrf: 'VRF',
  hostname: 'Hostname',
  device_name: 'Device',
}

interface ColumnFilters {
  ipAddress: string
  macAddress: string
  port: string
  vlan: string
  vrf: string
  hostname: string
  deviceName: string
}

const COLUMN_FILTER_KEY: Partial<Record<string, keyof ColumnFilters>> = {
  ip_address: 'ipAddress',
  mac_address: 'macAddress',
  port: 'port',
  vlan: 'vlan',
  vrf: 'vrf',
  hostname: 'hostname',
  device_name: 'deviceName',
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

const EMPTY_ITEMS: ClientDataItem[] = []

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
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const startRow = total === 0 ? 0 : (page - 1) * pageSize + 1
  const endRow = Math.min(page * pageSize, total)

  const handleFilterChange = useCallback(
    (key: keyof ColumnFilters) => (e: React.ChangeEvent<HTMLInputElement>) => {
      onFilterChange(key, e.target.value)
    },
    [onFilterChange]
  )

  const columns = useMemo<ColumnDef<ClientDataItem>[]>(
    () => [
      {
        id: 'ip_address',
        accessorKey: 'ip_address',
        header: 'IP Address',
        size: 150,
        minSize: 90,
        enableHiding: false,
        cell: ({ row }) => (
          <span className="flex items-center gap-1 font-mono text-xs text-gray-800">
            <button
              type="button"
              onClick={() => onHistoryClick(row.original)}
              className="text-gray-400 hover:text-blue-600 transition-colors shrink-0"
              title="Show history"
            >
              <History className="h-3.5 w-3.5" />
            </button>
            {row.original.ip_address ?? '—'}
          </span>
        ),
      },
      {
        id: 'mac_address',
        accessorKey: 'mac_address',
        header: 'MAC Address',
        size: 150,
        minSize: 90,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-gray-800">
            {row.original.mac_address ?? '—'}
          </span>
        ),
      },
      {
        id: 'port',
        accessorKey: 'port',
        header: 'Port',
        size: 100,
        minSize: 60,
        cell: ({ row }) => (
          <span className="text-xs text-gray-700">{row.original.port ?? '—'}</span>
        ),
      },
      {
        id: 'vlan',
        accessorKey: 'vlan',
        header: 'VLAN',
        size: 70,
        minSize: 50,
        cell: ({ row }) => (
          <span className="text-xs text-gray-700">{row.original.vlan ?? '—'}</span>
        ),
      },
      {
        id: 'vrf',
        accessorKey: 'vrf',
        header: 'VRF',
        size: 110,
        minSize: 60,
        cell: ({ row }) => (
          <span className="text-xs text-gray-700">{row.original.vrf ?? '—'}</span>
        ),
      },
      {
        id: 'hostname',
        accessorKey: 'hostname',
        header: 'Hostname',
        size: 180,
        minSize: 80,
        cell: ({ row }) => (
          <span className="text-xs text-gray-700 block truncate" title={row.original.hostname ?? undefined}>
            {row.original.hostname ?? '—'}
          </span>
        ),
      },
      {
        id: 'device_name',
        accessorKey: 'device_name',
        header: 'Device',
        size: 150,
        minSize: 80,
        enableHiding: false,
        cell: ({ row }) => (
          <span className="text-xs text-gray-700">{row.original.device_name}</span>
        ),
      },
    ],
    [onHistoryClick]
  )

  const data = items.length > 0 ? items : EMPTY_ITEMS

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange',
    state: { columnVisibility, columnSizing },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
  })

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
        <div className="flex items-center gap-2">
          <div className="text-xs text-blue-100">
            {total > 0 ? `${startRow}–${endRow} of ${total}` : '0 entries'}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-white hover:bg-white/20 hover:text-white"
                aria-label="Toggle columns"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter(col => col.getCanHide())
                .map(col => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={col.getIsVisible()}
                    onCheckedChange={value => col.toggleVisibility(!!value)}
                  >
                    {COLUMN_LABELS[col.id] ?? col.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
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
              <table
                style={{ width: table.getCenterTotalSize(), tableLayout: 'fixed' }}
                className="caption-bottom text-sm"
              >
                <thead>
                  {/* Column name row with resize handles */}
                  {table.getHeaderGroups().map(headerGroup => (
                    <tr
                      key={headerGroup.id}
                      className="border-b border-gray-200 bg-gray-50"
                    >
                      {headerGroup.headers.map(header => (
                        <th
                          key={header.id}
                          style={{ width: header.getSize() }}
                          className="relative select-none h-9 px-3 text-left align-middle font-medium text-gray-700 overflow-hidden"
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                          {header.column.getCanResize() && (
                            <div
                              onMouseDown={header.getResizeHandler()}
                              onTouchStart={header.getResizeHandler()}
                              className={`absolute right-0 top-0 h-full w-1 cursor-col-resize transition-colors ${
                                header.column.getIsResizing()
                                  ? 'bg-blue-500'
                                  : 'bg-transparent hover:bg-blue-400'
                              }`}
                            />
                          )}
                        </th>
                      ))}
                    </tr>
                  ))}
                  {/* Filter inputs row — aligned to visible columns */}
                  <tr className="border-b border-gray-200">
                    {table.getVisibleLeafColumns().map(col => {
                      const filterKey = COLUMN_FILTER_KEY[col.id]
                      return (
                        <th
                          key={col.id}
                          style={{ width: col.getSize() }}
                          className="px-2 py-1.5 overflow-hidden"
                        >
                          {filterKey ? (
                            <Input
                              placeholder="Filter..."
                              value={filters[filterKey]}
                              onChange={handleFilterChange(filterKey)}
                              className="h-7 text-xs"
                            />
                          ) : null}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {table.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={table.getVisibleLeafColumns().length}
                        className="text-center py-12 text-gray-500"
                      >
                        <p className="text-base font-medium">No entries found</p>
                        <p className="text-xs mt-1">
                          {total === 0
                            ? 'Run a Get Client Data job to collect data'
                            : 'Try clearing the filters'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    table.getRowModel().rows.map(row => (
                      <tr
                        key={row.id}
                        className="border-b border-gray-100 hover:bg-muted/50 transition-colors"
                      >
                        {row.getVisibleCells().map(cell => (
                          <td
                            key={cell.id}
                            style={{ width: cell.column.getSize() }}
                            className="px-3 py-2 align-middle overflow-hidden"
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
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
                    onValueChange={v => onPageSizeChange(Number(v))}
                  >
                    <SelectTrigger className="h-7 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map(size => (
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
