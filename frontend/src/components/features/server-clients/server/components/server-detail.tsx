'use client'

// react-hooks/refs fires false positives on all dropdown.* accesses because the rule tracks
// the whole object once it sees it connected to a ref= prop. Only setContainerRef is
// ref-related; displayValue, showDropdown, filteredItems are plain state/memoized values.
/* eslint-disable react-hooks/refs */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DoorOpen,
  FileJson,
  HardDrive,
  History,
  Loader2,
  Network,
  Pencil,
  FileSearch,
  Radar,
  RefreshCw,
  Server,
  Settings2,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useNautobotLocationsQuery, type LocationItem } from '@/hooks/queries/use-inventory-queries'
import { buildLocationHierarchy } from '@/components/features/nautobot/add-device/utils'
import { useSearchableDropdown } from '@/components/features/nautobot/add-device/hooks/use-searchable-dropdown'
import { useServerMutations } from '@/hooks/queries/use-server-mutations'

import { InterfacesDialog } from '../dialogs/interfaces-dialog'
import { ClusterRow } from './cluster-row'
import { ContactRow } from './contact-row'
import { PortBindingBadge } from './port-binding-badge'
import { useRefreshServerFacts } from '../hooks/use-refresh-server-facts'
import { useRefreshServerOpenPorts } from '../hooks/use-refresh-server-open-ports'
import { useRemoveServer } from '../hooks/use-remove-server'
import { useUpdateServerToNautobot } from '../hooks/use-update-server-to-nautobot'
import { NautobotUuidRow } from './nautobot-uuid-row'
import {
  formatServerInterfaceDisplay,
  formatServerPrimaryIpv4Display,
} from '../utils/format-interface-address'
import type { SelectedInterface, ServerLocation, ServerResponse } from '../types'

interface MountEntry {
  mount: string
  device: string
  fstype: string
  size_total: number
  size_available: number
}

interface ServerDetailProps {
  server: ServerResponse
  onShowFacts: () => void
  onShowHistory: () => void
  onRemoved: () => void
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(0)} MB`
}

function FactRow({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-foreground truncate">
        {value ?? <span className="text-muted-foreground italic">—</span>}
      </span>
    </div>
  )
}

const EMPTY_LOCATIONS: LocationItem[] = []

function LocationRow({ server }: { server: ServerResponse }) {
  const [editing, setEditing] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)
  const { updateServer } = useServerMutations()

  const { data: rawLocations = EMPTY_LOCATIONS, isLoading } = useNautobotLocationsQuery(editing)
  const locations = useMemo(() => buildLocationHierarchy(rawLocations), [rawLocations])

  const filterPredicate = useCallback(
    (loc: LocationItem, query: string) =>
      (loc.hierarchicalPath || loc.name).toLowerCase().includes(query),
    []
  )

  const handleSelect = useCallback(
    (id: string) => {
      const loc = locations.find((l) => l.id === id)
      if (!loc) return
      const newLocation: ServerLocation = {
        id: loc.id,
        name: loc.name,
        hierarchical_path: loc.hierarchicalPath ?? null,
      }
      updateServer.mutate({ id: server.id, data: { location: newLocation } })
      setEditing(false)
    },
    [locations, server.id, updateServer]
  )

  const dropdown = useSearchableDropdown({
    items: locations,
    selectedId: server.location?.id ?? '',
    onSelect: handleSelect,
    getDisplayText: (loc) => loc.hierarchicalPath || loc.name,
    filterPredicate,
  })

  // Close edit mode when clicking outside the row
  useEffect(() => {
    if (!editing) return
    const handler = (e: MouseEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) {
        setEditing(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [editing])

  const displayName =
    server.location?.hierarchical_path || server.location?.name

  return (
    <div ref={rowRef} className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">Location</span>

      {editing ? (
        <div className="relative" ref={dropdown.setContainerRef}>
          <Input
            autoFocus
            className="h-7 text-xs"
            placeholder={isLoading ? 'Loading…' : 'Search location…'}
            value={dropdown.displayValue}
            onChange={(e) => {
              dropdown.setSearchQuery(e.target.value)
              dropdown.setShowDropdown(true)
            }}
            onFocus={() => dropdown.setShowDropdown(true)}
            onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
          />
          {dropdown.showDropdown && dropdown.filteredItems.length > 0 && (
            <div className="absolute z-[100] mt-1 w-64 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
              {dropdown.filteredItems.map((loc) => (
                <div
                  key={loc.id}
                  className="px-3 py-1.5 hover:bg-accent cursor-pointer text-xs border-b last:border-b-0"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    dropdown.selectItem(loc)
                  }}
                >
                  {loc.hierarchicalPath || loc.name}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-foreground truncate">
            {displayName ?? <span className="text-muted-foreground italic">—</span>}
          </span>
          <button
            onClick={() => setEditing(true)}
            title="Set location"
            className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  )
}

export function ServerDetail({
  server,
  onShowFacts,
  onShowHistory,
  onRemoved,
}: ServerDetailProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [alsoRemoveFromNautobot, setAlsoRemoveFromNautobot] = useState(false)
  const [interfacesOpen, setInterfacesOpen] = useState(false)
  const {
    updateServerInNautobot,
    isPending: isUpdatingNautobot,
    canUpdate,
    defaultsLoading,
    deviceDropdownsLoading,
  } = useUpdateServerToNautobot(server)
  const {
    removeServer,
    isPending: isRemoving,
    hasNautobotLink,
    nautobotResourceLabel,
  } = useRemoveServer(server, onRemoved)
  const { refreshFacts, isRefreshing, canRefreshFacts } = useRefreshServerFacts(server)
  const { scanOpenPorts, isScanning, canScanOpenPorts } = useRefreshServerOpenPorts(server)

  const handleConfirmOpenChange = useCallback((open: boolean) => {
    setConfirmOpen(open)
    if (!open) {
      setAlsoRemoveFromNautobot(false)
    }
  }, [])

  const handleConfirmRemove = useCallback(async () => {
    try {
      await removeServer(alsoRemoveFromNautobot)
      setConfirmOpen(false)
      setAlsoRemoveFromNautobot(false)
    } catch {
      // Error toast shown by useRemoveServer; keep dialog open
    }
  }, [alsoRemoveFromNautobot, removeServer])
  const facts = server.ansible_facts
  const ansibleFacts = facts?.ansible_facts as Record<string, unknown> | undefined
  const rawFacts = facts?.facts as Record<string, unknown> | undefined

  const mounts: MountEntry[] = (
    (ansibleFacts?.mounts as MountEntry[] | undefined) ??
    (rawFacts?.ansible_mounts as MountEntry[] | undefined) ??
    []
  )

  const selectedInterfaces: SelectedInterface[] = server.selected_interfaces ?? []
  const tcpPorts = server.open_ports?.tcp_ports ?? []
  const udpPorts = server.open_ports?.udp_ports ?? []
  const hasOpenPorts = tcpPorts.length > 0 || udpPorts.length > 0
  const primaryIpv4Display = useMemo(
    () => formatServerPrimaryIpv4Display(server),
    [server]
  )

  const distribution = [server.distribution_release, server.distribution_version]
    .filter(Boolean)
    .join(' / ')

  return (
    <div className="shadow-lg border-0 p-0 bg-card rounded-lg">
      {/* Gradient header */}
      <div className="panel-header py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2">
          <Server className="h-4 w-4" />
          <span className="text-sm font-medium">{server.hostname}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onShowHistory}
            title="Show Facts and Open Ports History"
            className="flex items-center gap-1.5 text-xs text-panel-header-muted hover:text-current transition-colors"
          >
            <History className="h-4 w-4" />
            <span>Show History</span>
          </button>
          <button
            onClick={onShowFacts}
            title="Show Ansible Facts"
            className="flex items-center gap-1.5 text-xs text-panel-header-muted hover:text-current transition-colors"
          >
            <FileJson className="h-4 w-4" />
            <span>Show Facts</span>
          </button>
        </div>
      </div>

      {/* Facts grid */}
      <div className="p-6 panel-content space-y-6">
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <FactRow label="Hostname" value={server.hostname} />
          <FactRow label="Virtual Machine" value={server.is_virtual ? 'Yes' : 'No'} />
          {server.is_virtual ? <ClusterRow server={server} /> : null}
          <FactRow label="Primary IPv4" value={primaryIpv4Display ?? server.primary_ipv4} />
          <FactRow label="Interface" value={server.primary_interface} />
          <FactRow label="OS Family" value={server.os_family} />
          <FactRow label="Architecture" value={server.architecture} />
          <FactRow label="Distribution" value={distribution || null} />
          <FactRow label="CPUs" value={server.processor_count} />
          <FactRow label="RAM" value={server.memtotal_mb != null ? `${server.memtotal_mb} MB` : null} />
          <FactRow label="Disks" value={server.disk_count} />
          <LocationRow server={server} />
          <NautobotUuidRow server={server} />
        </div>

        {/* Mounts table */}
        {mounts.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Mount Points</span>
            </div>
            <div className="border border-border rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted border-b border-border">
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium">Device</th>
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium">Mount</th>
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium">FS</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-medium">Total</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-medium">Available</th>
                  </tr>
                </thead>
                <tbody>
                  {mounts.map((m, i) => (
                    <tr
                      key={m.mount}
                      className={i % 2 === 0 ? 'bg-card' : 'bg-muted/40'}
                    >
                      <td className="px-3 py-2 font-mono text-muted-foreground">{m.device}</td>
                      <td className="px-3 py-2 font-mono text-foreground">{m.mount}</td>
                      <td className="px-3 py-2 text-muted-foreground">{m.fstype}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {m.size_total ? formatBytes(m.size_total) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {m.size_available ? formatBytes(m.size_available) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Interfaces section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Network className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Interfaces</span>
            <button
              onClick={() => setInterfacesOpen(true)}
              title="Manage interfaces"
              className="ml-auto flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              <Settings2 className="h-3.5 w-3.5" />
              <span>Manage</span>
            </button>
          </div>
          {selectedInterfaces.length > 0 ? (
            <div className="border border-border rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted border-b border-border">
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium">Interface</th>
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium">IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInterfaces.map((iface, i) => {
                    const ipDisplay = formatServerInterfaceDisplay(server, iface)
                    return (
                      <tr key={iface.name} className={i % 2 === 0 ? 'bg-card' : 'bg-muted/40'}>
                        <td className="px-3 py-2 font-mono text-foreground">{iface.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {ipDisplay ?? <span className="italic text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No interfaces selected — click Manage to add some.</p>
          )}
        </div>

        {/* Open Ports section */}
        {hasOpenPorts && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <DoorOpen className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Open Ports</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  TCP ({tcpPorts.length})
                </span>
                {tcpPorts.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {tcpPorts.map((binding) => (
                      <PortBindingBadge
                        key={`${binding.address}:${binding.port}`}
                        binding={binding}
                      />
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground italic">None</span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  UDP ({udpPorts.length})
                </span>
                {udpPorts.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {udpPorts.map((binding) => (
                      <PortBindingBadge
                        key={`${binding.address}:${binding.port}`}
                        binding={binding}
                      />
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground italic">None</span>
                )}
              </div>
            </div>
          </div>
        )}

        <ContactRow server={server} />

        {/* Actions */}
        <div className="pt-2 border-t border-border flex justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={!canRefreshFacts || isRefreshing || isScanning || isRemoving}
              title={
                canRefreshFacts
                  ? 'Re-gather Ansible facts using stored connection settings'
                  : 'No stored Ansible connection settings for this server'
              }
              onClick={() => void refreshFacts()}
            >
              {isRefreshing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Gathering…
                </>
              ) : (
                <>
                  <FileSearch className="h-3.5 w-3.5 mr-1.5" />
                  Get Facts
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={!canScanOpenPorts || isScanning || isRefreshing || isRemoving}
              title={
                canScanOpenPorts
                  ? 'Scan open TCP/UDP ports using stored connection settings'
                  : 'No stored Ansible connection settings for this server'
              }
              onClick={() => void scanOpenPorts()}
            >
              {isScanning ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Scanning…
                </>
              ) : (
                <>
                  <Radar className="h-3.5 w-3.5 mr-1.5" />
                  Get Open Ports
                </>
              )}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {canUpdate ? (
              <Button
                variant="default"
                size="sm"
                className="h-8"
                disabled={
                  isUpdatingNautobot ||
                  isRefreshing ||
                  isScanning ||
                  defaultsLoading ||
                  (!server.is_virtual && deviceDropdownsLoading)
                }
                onClick={() => void updateServerInNautobot()}
              >
                {isUpdatingNautobot ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Updating…
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Update Server
                  </>
                )}
              </Button>
            ) : null}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={isRemoving || isRefreshing || isScanning}
              className="h-8 px-3"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Remove Server
            </Button>
          </div>
        </div>
      </div>

      {/* Interfaces dialog */}
      <InterfacesDialog
        open={interfacesOpen}
        onOpenChange={setInterfacesOpen}
        server={server}
      />

      {/* Confirm removal dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={handleConfirmOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove server?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  This will permanently delete <strong>{server.hostname}</strong> and all its
                  data from Cockpit. This action cannot be undone.
                </p>
                {hasNautobotLink ? (
                  <div className="flex items-start gap-2 rounded-md border border-border p-3">
                    <Checkbox
                      id="also-remove-nautobot"
                      checked={alsoRemoveFromNautobot}
                      onCheckedChange={checked =>
                        setAlsoRemoveFromNautobot(checked === true)
                      }
                      disabled={isRemoving}
                    />
                    <Label
                      htmlFor="also-remove-nautobot"
                      className="cursor-pointer font-normal leading-snug"
                    >
                      Also remove this {nautobotResourceLabel} from Nautobot
                    </Label>
                  </div>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemove}
              disabled={isRemoving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemoving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Removing…
                </>
              ) : (
                'Remove'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
