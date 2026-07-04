'use client'

import { useMemo, useState } from 'react'
import { History, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useServerFactsHistoryQuery } from '@/hooks/queries/use-server-facts-history-query'
import { useServerFactsHistoryDetailQuery } from '@/hooks/queries/use-server-facts-history-detail-query'
import { useServerOpenPortsHistoryQuery } from '@/hooks/queries/use-server-open-ports-history-query'
import { useServerOpenPortsHistoryDetailQuery } from '@/hooks/queries/use-server-open-ports-history-detail-query'

import { AnsibleFactsModal } from './ansible-facts-modal'
import { OpenPortsModal } from './open-ports-modal'

interface HistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  serverId: number | null
  hostname: string
}

type HistoryEntryType = 'facts' | 'open_ports'

interface MergedHistoryEntry {
  type: HistoryEntryType
  id: number
  recorded_at: string
}

const EMPTY_ENTRIES: MergedHistoryEntry[] = []

export function HistoryDialog({ open, onOpenChange, serverId, hostname }: HistoryDialogProps) {
  const [selected, setSelected] = useState<MergedHistoryEntry | null>(null)

  const { data: factsData, isLoading: isFactsLoading } = useServerFactsHistoryQuery(
    serverId,
    { enabled: open }
  )
  const { data: portsData, isLoading: isPortsLoading } = useServerOpenPortsHistoryQuery(
    serverId,
    { enabled: open }
  )

  const entries = useMemo(() => {
    const factsEntries = factsData?.entries ?? EMPTY_ENTRIES
    const portsEntries = portsData?.entries ?? EMPTY_ENTRIES
    const merged: MergedHistoryEntry[] = [
      ...factsEntries.map((e) => ({ type: 'facts' as const, id: e.id, recorded_at: e.recorded_at })),
      ...portsEntries.map((e) => ({
        type: 'open_ports' as const,
        id: e.id,
        recorded_at: e.recorded_at,
      })),
    ]
    return merged.sort(
      (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
    )
  }, [factsData, portsData])

  const isLoading = isFactsLoading || isPortsLoading

  const isFactsSelected = selected?.type === 'facts'
  const isPortsSelected = selected?.type === 'open_ports'

  const { data: factsDetail, isFetching: isFactsDetailLoading } =
    useServerFactsHistoryDetailQuery(serverId, isFactsSelected ? selected.id : null)
  const { data: portsDetail, isFetching: isPortsDetailLoading } =
    useServerOpenPortsHistoryDetailQuery(serverId, isPortsSelected ? selected.id : null)

  const factsModalOpen = isFactsSelected && !!factsDetail
  const portsModalOpen = isPortsSelected && !!portsDetail

  const handleClear = (next: boolean) => {
    if (!next) setSelected(null)
  }

  const detailLabel = (recordedAt: string) =>
    `${hostname} (${new Date(recordedAt).toLocaleString()})`

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              History — {hostname}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : entries.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No history recorded yet.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {entries.map((entry) => {
                  const isPending =
                    selected?.type === entry.type &&
                    selected.id === entry.id &&
                    (entry.type === 'facts' ? isFactsDetailLoading : isPortsDetailLoading)
                  return (
                    <li
                      key={`${entry.type}-${entry.id}`}
                      className="flex items-center justify-between gap-3 py-2.5 px-1"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {entry.type === 'facts' ? (
                          <StatusBadge variant="info" className="shrink-0 px-1.5 py-0 text-[10px]">
                            Facts
                          </StatusBadge>
                        ) : (
                          <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px]">
                            Open Ports
                          </Badge>
                        )}
                        <span className="truncate text-sm text-muted-foreground">
                          {new Date(entry.recorded_at).toLocaleString()}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => setSelected(entry)}
                      >
                        Show
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AnsibleFactsModal
        open={factsModalOpen}
        onOpenChange={handleClear}
        label={factsDetail ? detailLabel(factsDetail.recorded_at) : hostname}
        facts={factsDetail?.ansible_facts}
      />

      <OpenPortsModal
        open={portsModalOpen}
        onOpenChange={handleClear}
        label={portsDetail ? detailLabel(portsDetail.recorded_at) : hostname}
        openPorts={portsDetail?.open_ports}
      />
    </>
  )
}
