'use client'

import { useMemo } from 'react'
import { History } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useClientHistoryQuery } from '@/hooks/queries/use-clients-query'
import type {
  ClientDataItem,
  IpHistoryEntry,
  MacHistoryEntry,
  HostnameHistoryEntry,
} from '@/hooks/queries/use-clients-query'

interface ClientHistoryDialogProps {
  item: ClientDataItem | null
  onClose: () => void
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

function EmptyState({ message }: { message: string }) {
  return (
    <tr>
      <td colSpan={6} className="text-center py-10 text-muted-foreground text-xs">
        {message}
      </td>
    </tr>
  )
}

function LoadingState() {
  return (
    <tr>
      <td colSpan={6} className="text-center py-10">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
          <span className="text-xs">Loading history…</span>
        </div>
      </td>
    </tr>
  )
}

function IpHistoryTab({
  rows,
  isLoading,
}: {
  rows: IpHistoryEntry[]
  isLoading: boolean
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted">
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">
              Collected At
            </th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Device</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">
              IP Address
            </th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">
              MAC Address
            </th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Port</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">VLAN</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <LoadingState />
          ) : rows.length === 0 ? (
            <EmptyState message="No IP address history found" />
          ) : (
            rows.map(row => (
              <tr
                key={`${row.collected_at}-${row.device_name}-${row.ip_address}`}
                className="border-b border-border hover:bg-muted/50 transition-colors"
              >
                <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">
                  {formatDate(row.collected_at)}
                </td>
                <td className="px-3 py-1.5 font-medium text-foreground">
                  {row.device_name}
                </td>
                <td className="px-3 py-1.5 font-mono text-foreground">
                  {row.ip_address}
                </td>
                <td className="px-3 py-1.5 font-mono text-muted-foreground">
                  {row.mac_address ?? '—'}
                </td>
                <td className="px-3 py-1.5 text-muted-foreground">{row.port ?? '—'}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{row.vlan ?? '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function MacHistoryTab({
  rows,
  isLoading,
}: {
  rows: MacHistoryEntry[]
  isLoading: boolean
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted">
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">
              Collected At
            </th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Device</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">
              MAC Address
            </th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">
              IP Address
            </th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Port</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">VLAN</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <LoadingState />
          ) : rows.length === 0 ? (
            <EmptyState message="No MAC address history found" />
          ) : (
            rows.map(row => (
              <tr
                key={`${row.collected_at}-${row.device_name}-${row.mac_address}`}
                className="border-b border-border hover:bg-muted/50 transition-colors"
              >
                <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">
                  {formatDate(row.collected_at)}
                </td>
                <td className="px-3 py-1.5 font-medium text-foreground">
                  {row.device_name}
                </td>
                <td className="px-3 py-1.5 font-mono text-foreground">
                  {row.mac_address}
                </td>
                <td className="px-3 py-1.5 font-mono text-muted-foreground">
                  {row.ip_address ?? '—'}
                </td>
                <td className="px-3 py-1.5 text-muted-foreground">{row.port ?? '—'}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{row.vlan ?? '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function HostnameHistoryTab({
  rows,
  isLoading,
}: {
  rows: HostnameHistoryEntry[]
  isLoading: boolean
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted">
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">
              Collected At
            </th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Device</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Hostname</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">
              IP Address
            </th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <LoadingState />
          ) : rows.length === 0 ? (
            <EmptyState message="No hostname history found" />
          ) : (
            rows.map(row => (
              <tr
                key={`${row.collected_at}-${row.device_name}-${row.hostname}`}
                className="border-b border-border hover:bg-muted/50 transition-colors"
              >
                <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">
                  {formatDate(row.collected_at)}
                </td>
                <td className="px-3 py-1.5 font-medium text-foreground">
                  {row.device_name}
                </td>
                <td className="px-3 py-1.5 text-foreground">{row.hostname}</td>
                <td className="px-3 py-1.5 font-mono text-muted-foreground">
                  {row.ip_address ?? '—'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export function ClientHistoryDialog({ item, onClose }: ClientHistoryDialogProps) {
  const historyParams = useMemo(
    () => ({
      ip_address: item?.ip_address ?? null,
      mac_address: item?.mac_address ?? null,
      hostname: item?.hostname ?? null,
    }),
    [item]
  )

  const { data, isLoading } = useClientHistoryQuery(historyParams, item !== null)

  const ipHistory = data?.ip_history ?? []
  const macHistory = data?.mac_history ?? []
  const hostnameHistory = data?.hostname_history ?? []

  const title = useMemo(() => {
    if (!item) return 'History'
    return item.ip_address ?? item.mac_address ?? item.hostname ?? 'History'
  }, [item])

  return (
    <Dialog
      open={item !== null}
      onOpenChange={open => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="!max-w-[67rem] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            History — {title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <Tabs defaultValue="ip" className="flex flex-col flex-1 min-h-0">
            <TabsList className="shrink-0">
              <TabsTrigger value="ip">
                IP Address
                {ipHistory.length > 0 && (
                  <span className="ml-1.5 text-xs bg-primary/10 text-primary rounded-full px-1.5 py-0.5">
                    {ipHistory.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="mac">
                MAC Address
                {macHistory.length > 0 && (
                  <span className="ml-1.5 text-xs bg-primary/10 text-primary rounded-full px-1.5 py-0.5">
                    {macHistory.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="hostname">
                Hostname
                {hostnameHistory.length > 0 && (
                  <span className="ml-1.5 text-xs bg-primary/10 text-primary rounded-full px-1.5 py-0.5">
                    {hostnameHistory.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-2 rounded border border-border">
              <TabsContent value="ip" className="mt-0">
                <IpHistoryTab rows={ipHistory} isLoading={isLoading} />
              </TabsContent>
              <TabsContent value="mac" className="mt-0">
                <MacHistoryTab rows={macHistory} isLoading={isLoading} />
              </TabsContent>
              <TabsContent value="hostname" className="mt-0">
                <HostnameHistoryTab rows={hostnameHistory} isLoading={isLoading} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
