'use client'

import { History, Loader2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useServerFactsHistoryQuery } from '@/hooks/queries/use-server-facts-history-query'
import { useServerFactsHistoryDetailQuery } from '@/hooks/queries/use-server-facts-history-detail-query'

import { AnsibleFactsModal } from './ansible-facts-modal'

interface FactsHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  serverId: number | null
  hostname: string
}

export function FactsHistoryDialog({
  open,
  onOpenChange,
  serverId,
  hostname,
}: FactsHistoryDialogProps) {
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null)

  const { data, isLoading } = useServerFactsHistoryQuery(serverId, { enabled: open })
  const entries = data?.entries ?? []

  const { data: detail, isFetching: isDetailLoading } = useServerFactsHistoryDetailQuery(
    serverId,
    selectedHistoryId
  )

  const detailOpen = selectedHistoryId != null && !!detail
  const detailLabel = detail
    ? `${hostname} (${new Date(detail.recorded_at).toLocaleString()})`
    : hostname

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-blue-600" />
              Facts History — {hostname}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : entries.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">
                No fact history recorded yet.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {entries.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between py-2.5 px-1"
                  >
                    <span className="text-sm text-gray-700">
                      {new Date(entry.recorded_at).toLocaleString()}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isDetailLoading && selectedHistoryId === entry.id}
                      onClick={() => setSelectedHistoryId(entry.id)}
                    >
                      Show
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AnsibleFactsModal
        open={detailOpen}
        onOpenChange={(next) => {
          if (!next) setSelectedHistoryId(null)
        }}
        label={detailLabel}
        facts={detail?.ansible_facts}
      />
    </>
  )
}
