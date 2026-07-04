'use client'

import { Loader2, Plus, Server } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { IconChip } from '@/components/shared/icon-chip'
import { useDebounce } from '@/hooks/use-debounce'
import { useServerQuery } from '@/hooks/queries/use-server-query'
import { useServersQuery } from '@/hooks/queries/use-servers-query'

import { AnsibleFactsModal } from './dialogs/ansible-facts-modal'
import { HistoryDialog } from './dialogs/history-dialog'
import { AddServerDialog } from './dialogs/add-server-dialog'
import { ServerDetail } from './components/server-detail'
import { ServerTree } from './components/server-tree'
import type { GroupByField, ServerResponse } from './types'

const EMPTY_SET = new Set<string>()

export function ServerPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [nameFilter, setNameFilter] = useState('')
  const [groupBy, setGroupBy] = useState<GroupByField>('location')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(EMPTY_SET)
  const [factsOpen, setFactsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  const debouncedSearch = useDebounce(nameFilter, 300)
  const { data, isLoading, isFetching, error } = useServersQuery({
    search: debouncedSearch,
  })
  const servers = useMemo(() => data?.servers ?? [], [data])
  const totalAll = data?.total_all ?? servers.length
  const isSearchPending =
    nameFilter.trim() !== debouncedSearch.trim() && nameFilter.trim().length > 0

  const {
    data: selectedServer,
    isLoading: isDetailLoading,
    error: detailError,
  } = useServerQuery(selectedId)

  useEffect(() => {
    if (selectedId == null) return
    if (!servers.some((s) => s.id === selectedId)) {
      setSelectedId(null)
    }
  }, [servers, selectedId])

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

  const handleShowHistory = useCallback(() => {
    setHistoryOpen(true)
  }, [])

  const handleServerRemoved = useCallback(() => {
    setSelectedId(null)
  }, [])

  const handleServerAdded = useCallback((server: ServerResponse) => {
    setSelectedId(server.id)
  }, [])

  const isFiltering = debouncedSearch.trim().length > 0
  const headerCountLabel = useMemo(() => {
    if (isFiltering) {
      return `${data?.total ?? servers.length} of ${totalAll} servers`
    }
    return `${totalAll} server${totalAll !== 1 ? 's' : ''}`
  }, [isFiltering, data?.total, servers.length, totalAll])

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <IconChip variant="primary">
            <Server className="h-6 w-6" />
          </IconChip>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Server</h1>
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
      <div className="shadow-lg border-0 p-0 bg-card rounded-lg overflow-hidden">
        <div className="panel-header py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Server className="h-4 w-4" />
            <span className="text-sm font-medium">Server Inventory</span>
          </div>
          <div className="text-xs text-panel-header-muted">{headerCountLabel}</div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="p-6 text-center text-sm text-error-foreground">
            Failed to load servers. Please try again.
          </div>
        ) : (
          <div className="flex min-h-[520px]">
            {/* Left tree panel */}
            <div className="w-64 border-r border-border shrink-0 bg-muted flex flex-col min-h-[520px]">
              <ServerTree
                servers={servers}
                isSearching={isSearchPending || (isFetching && isFiltering)}
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
            <div className="flex-1 p-6 panel-content overflow-y-auto">
              {selectedId != null && isDetailLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : detailError ? (
                <div className="text-center py-16 text-sm text-error-foreground">
                  Failed to load server details. Please try again.
                </div>
              ) : selectedServer ? (
                <ServerDetail
                  server={selectedServer}
                  onShowFacts={handleShowFacts}
                  onShowHistory={handleShowHistory}
                  onRemoved={handleServerRemoved}
                />
              ) : (
                <div className="text-center py-16 text-muted-foreground">
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
        label={selectedServer?.hostname ?? ''}
        facts={selectedServer?.ansible_facts}
      />

      {/* History Dialog (Facts + Open Ports) */}
      <HistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        serverId={selectedId}
        hostname={selectedServer?.hostname ?? ''}
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
