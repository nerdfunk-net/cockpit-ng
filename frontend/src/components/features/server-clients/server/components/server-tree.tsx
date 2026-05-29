'use client'

import { ChevronDown, ChevronRight, FolderOpen, Server } from 'lucide-react'
import { useMemo } from 'react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { GroupByField, ServerResponse } from '../types'

interface ServerTreeProps {
  servers: ServerResponse[]
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
  { value: 'distribution_release', label: 'OS Release' },
  { value: 'distribution_version', label: 'OS Version' },
  { value: 'contact', label: 'Contact' },
]

export function ServerTree({
  servers,
  groupBy,
  selectedId,
  expandedGroups,
  onGroupByChange,
  onSelectServer,
  onToggleGroup,
}: ServerTreeProps) {
  const groups = useMemo(() => {
    if (groupBy === 'none') {
      return [{ name: '/', servers }]
    }
    const map = new Map<string, ServerResponse[]>()
    for (const server of servers) {
      const key = (server[groupBy] as string | null) ?? 'Uncategorized'
      const existing = map.get(key) ?? []
      map.set(key, [...existing, server])
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, srvs]) => ({ name, servers: srvs }))
  }, [servers, groupBy])

  return (
    <div className="flex flex-col h-full">
      {/* Group-by selector */}
      <div className="p-3 border-b border-gray-200">
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

      {/* Tree */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* Root node */}
        <div className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <FolderOpen className="h-3 w-3" />
          <span>/</span>
        </div>

        {groups.map((group) => (
          <div key={group.name}>
            {groupBy !== 'none' && (
              <button
                onClick={() => onToggleGroup(group.name)}
                className="flex items-center gap-1 w-full px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
              >
                {expandedGroups.has(group.name) ? (
                  <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" />
                ) : (
                  <ChevronRight className="h-3 w-3 shrink-0 text-gray-400" />
                )}
                <FolderOpen className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                <span className="truncate font-medium">{group.name}</span>
                <span className="ml-auto text-xs text-gray-400 shrink-0">
                  {group.servers.length}
                </span>
              </button>
            )}

            {(groupBy === 'none' || expandedGroups.has(group.name)) &&
              group.servers.map((server) => (
                <button
                  key={server.id}
                  onClick={() => onSelectServer(server.id)}
                  className={`flex items-center gap-1.5 w-full px-2 py-1.5 text-sm rounded transition-colors ${
                    groupBy !== 'none' ? 'pl-7' : 'pl-4'
                  } ${
                    selectedId === server.id
                      ? 'bg-blue-100 text-blue-800 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Server className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <span className="truncate text-xs">{server.hostname}</span>
                </button>
              ))}
          </div>
        ))}

        {servers.length === 0 && (
          <p className="px-4 py-6 text-xs text-gray-400 text-center">No servers found</p>
        )}
      </div>
    </div>
  )
}
