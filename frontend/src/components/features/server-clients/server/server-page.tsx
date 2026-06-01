'use client'

import { Loader2, Plus, Server } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'

import { useServersQuery } from '@/hooks/queries/use-servers-query'
import { AnsibleFactsModal } from './dialogs/ansible-facts-modal'
import { AddServerDialog } from './dialogs/add-server-dialog'
import { ServerDetail } from './components/server-detail'
import { ServerTree } from './components/server-tree'
import type { GroupByField, ServerResponse } from './types'

const EMPTY_SET = new Set<string>()

export function ServerPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [nameFilter, setNameFilter] = useState('')
  const [groupBy, setGroupBy] = useState<GroupByField>('none')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(EMPTY_SET)
  const [factsOpen, setFactsOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  const { data, isLoading, error } = useServersQuery()
  const servers = useMemo<ServerResponse[]>(() => data?.servers ?? [], [data])

  const filteredServers = useMemo(() => {
    const query = nameFilter.trim().toLowerCase()
    if (!query) return servers
    return servers.filter((s) => s.hostname.toLowerCase().includes(query))
  }, [servers, nameFilter])

  const selectedServer = useMemo(
    () => servers.find((s) => s.id === selectedId) ?? null,
    [servers, selectedId]
  )

  useEffect(() => {
    if (selectedId == null) return
    if (!filteredServers.some((s) => s.id === selectedId)) {
      setSelectedId(null)
    }
  }, [filteredServers, selectedId])

  const handleGroupByChange = useCallback((value: GroupByField) => {
    setGroupBy(value)
    setExpandedGroups(new Set<string>())
  }, [])

  const handleToggleGroup = useCallback((name: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }, [])

  const handleSelectServer = useCallback((id: number) => {
    setSelectedId(id)
  }, [])

  const handleShowFacts = useCallback(() => {
    setFactsOpen(true)
  }, [])

  const handleServerRemoved = useCallback(() => {
    setSelectedId(null)
  }, [])

  const handleServerAdded = useCallback((server: ServerResponse) => {
    setSelectedId(server.id)
  }, [])

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Server className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Server</h1>
            <p className="text-muted-foreground mt-2">
              Managed servers and their Ansible facts
            </p>
          </div>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Server
        </Button>
      </div>

      {/* Main panel */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Server className="h-4 w-4" />
            <span className="text-sm font-medium">Server Inventory</span>
          </div>
          <div className="text-xs text-blue-100">
            {nameFilter.trim()
              ? `${filteredServers.length} of ${servers.length} servers`
              : `${servers.length} server${servers.length !== 1 ? 's' : ''}`}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="p-6 text-center text-sm text-red-600">
            Failed to load servers. Please try again.
          </div>
        ) : (
          <div className="flex min-h-[520px]">
            {/* Left tree panel */}
            <div className="w-64 border-r border-gray-200 shrink-0 bg-gray-50">
              <ServerTree
                servers={filteredServers}
                nameFilter={nameFilter}
                onNameFilterChange={setNameFilter}
                groupBy={groupBy}
                selectedId={selectedId}
                expandedGroups={expandedGroups}
                onGroupByChange={handleGroupByChange}
                onSelectServer={handleSelectServer}
                onToggleGroup={handleToggleGroup}
              />
            </div>

            {/* Right detail panel */}
            <div className="flex-1 p-6 bg-gradient-to-b from-white to-gray-50 overflow-y-auto">
              {selectedServer ? (
                <ServerDetail
                  server={selectedServer}
                  onShowFacts={handleShowFacts}
                  onRemoved={handleServerRemoved}
                />
              ) : (
                <div className="text-center py-16 text-gray-400">
                  <Server className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Select a server from the list to view details</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Ansible Facts Modal */}
      <AnsibleFactsModal
        open={factsOpen}
        onOpenChange={setFactsOpen}
        server={selectedServer}
      />

      {/* Add Server Dialog */}
      <AddServerDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onServerAdded={handleServerAdded}
      />
    </div>
  )
}
