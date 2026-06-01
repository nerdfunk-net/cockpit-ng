'use client'

import { useVirtualizer } from '@tanstack/react-virtual'
import {
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Search,
  Server,
} from 'lucide-react'
import { useMemo, useRef } from 'react'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  buildServerTreeRows,
  getServerTreeRowHeight,
  type ServerTreeRow,
} from '../utils/build-server-tree-rows'
import type { GroupByField, ServerSummaryResponse } from '../types'

interface ServerTreeProps {
  servers: ServerSummaryResponse[]
  isSearching: boolean
  nameFilter: string
  onNameFilterChange: (value: string) => void
  groupBy: GroupByField
  selectedId: number | null
  expandedGroups: Set<string>
  onGroupByChange: (value: GroupByField) => void
  onSelectServer: (id: number) => void
  onToggleGroup: (name: string) => void
}

const GROUP_BY_OPTIONS: { value: GroupByField; label: string }[] = [
  { value: 'none', label: 'No grouping' },
  { value: 'location', label: 'Location' },
  { value: 'cluster', label: 'Cluster' },
  { value: 'distribution_release', label: 'OS Release' },
  { value: 'distribution_version', label: 'OS Version' },
  { value: 'contact', label: 'Contact' },
  { value: 'is_virtual', label: 'Virtual Machine' },
]

function TreeRowContent({
  row,
  selectedId,
  expandedGroups,
  expandAllGroups,
  onSelectServer,
  onToggleGroup,
}: {
  row: ServerTreeRow
  selectedId: number | null
  expandedGroups: Set<string>
  expandAllGroups: boolean
  onSelectServer: (id: number) => void
  onToggleGroup: (name: string) => void
}) {
  if (row.type === 'root') {
    return (
      <div className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider h-full">
        <FolderOpen className="h-3 w-3" />
        <span>/</span>
      </div>
    )
  }

  if (row.type === 'group') {
    return (
      <button
        type="button"
        onClick={() => onToggleGroup(row.name)}
        className="flex items-center gap-1 w-full px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors h-full"
      >
        {expandedGroups.has(row.name) || expandAllGroups ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-gray-400" />
        )}
        <FolderOpen className="h-3.5 w-3.5 shrink-0 text-blue-400" />
        <span className="truncate font-medium">{row.name}</span>
        <span className="ml-auto text-xs text-gray-400 shrink-0">{row.count}</span>
      </button>
    )
  }

  const { server, indented } = row
  return (
    <button
      type="button"
      onClick={() => onSelectServer(server.id)}
      className={`flex items-center gap-1.5 w-full px-2 py-1.5 text-sm rounded transition-colors h-full ${
        indented ? 'pl-7' : 'pl-4'
      } ${
        selectedId === server.id
          ? 'bg-blue-100 text-blue-800 font-medium'
          : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      <Server className="h-3.5 w-3.5 shrink-0 text-gray-400" />
      <span className="truncate text-xs">{server.hostname}</span>
    </button>
  )
}

export function ServerTree({
  servers,
  isSearching,
  nameFilter,
  onNameFilterChange,
  groupBy,
  selectedId,
  expandedGroups,
  onGroupByChange,
  onSelectServer,
  onToggleGroup,
}: ServerTreeProps) {
  const isFiltering = nameFilter.trim().length > 0
  const scrollRef = useRef<HTMLDivElement>(null)

  const rows = useMemo(
    () =>
      buildServerTreeRows(
        servers,
        groupBy,
        expandedGroups,
        isFiltering
      ),
    [servers, groupBy, expandedGroups, isFiltering]
  )

  // TanStack Virtual is intentionally incompatible with React Compiler memoization.
  // eslint-disable-next-line react-hooks/incompatible-library -- windowed list rendering
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => getServerTreeRowHeight(rows[index]!),
    overscan: 12,
  })

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 border-b border-gray-200 space-y-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            type="search"
            placeholder="Search by name…"
            value={nameFilter}
            onChange={(e) => onNameFilterChange(e.target.value)}
            className="pl-7 h-8 text-xs"
            aria-label="Filter servers by name"
          />
        </div>
        <Select value={groupBy} onValueChange={(v) => onGroupByChange(v as GroupByField)}>
          <SelectTrigger className="w-full h-8 text-xs">
            <SelectValue placeholder="Group by…" />
          </SelectTrigger>
          <SelectContent>
            {GROUP_BY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-2">
        {isSearching && servers.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : rows.length <= 1 && servers.length === 0 ? (
          <p className="px-4 py-6 text-xs text-gray-400 text-center">
            {isFiltering ? 'No servers match your search' : 'No servers found'}
          </p>
        ) : (
          <div
            className="relative w-full"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index]!
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  className="absolute left-0 top-0 w-full"
                  style={{
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <TreeRowContent
                    row={row}
                    selectedId={selectedId}
                    expandedGroups={expandedGroups}
                    expandAllGroups={isFiltering}
                    onSelectServer={onSelectServer}
                    onToggleGroup={onToggleGroup}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
