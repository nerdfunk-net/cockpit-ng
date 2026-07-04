'use client'

import { useState, useEffect, useCallback } from 'react'
import { Activity, Loader2, Key, ChevronRight, RefreshCw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { StatusAlert } from '@/components/shared/status-alert'
import { StatusBadge } from '@/components/shared/status-badge'
import { cn } from '@/lib/utils'
import { useApi } from '@/hooks/use-api'
import type { NautobotDevice } from '@/hooks/queries/use-clients-query'

// ── Types ──────────────────────────────────────────────────────────────────────

interface SshCredential {
  id: number
  name: string
  username: string
  type: string
  valid_until?: string
}

interface ArpEntry {
  protocol: string
  ip_address: string
  age: string
  mac_address: string
  type: string
  interface: string
  vrf?: string
}

interface MacEntry {
  destination_address: string
  type: string
  vlan_id: string
  destination_port: string | string[]
}

interface LiveStatusResults {
  arp: ArpEntry[]
  mac: MacEntry[]
}

type DialogStep = 'credential' | 'loading' | 'results' | 'error'

interface CommandResult {
  device: string
  success: boolean
  output: string
  error?: string
  command_outputs?: Record<string, unknown>
}

// ── VRF helpers ────────────────────────────────────────────────────────────────

function parseVrfNames(output: unknown): string[] {
  if (Array.isArray(output)) {
    return (output as Record<string, string>[])
      .map(e => e.name || e.NAME || '')
      .filter(Boolean)
  }
  if (typeof output === 'string' && output.trim()) {
    const vrfs: string[] = []
    let headerFound = false
    for (const line of output.split('\n')) {
      const stripped = line.trim()
      if (!stripped) continue
      if (!headerFound) {
        if (line.includes('Name') && line.includes('Default RD')) headerFound = true
        continue
      }
      const name = stripped.split(/\s+/)[0]
      if (name) vrfs.push(name)
    }
    return vrfs
  }
  return []
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface LiveStatusDialogProps {
  device: NautobotDevice | null
  onClose: () => void
}

export function LiveStatusDialog({ device, onClose }: LiveStatusDialogProps) {
  const { apiCall } = useApi()
  const [step, setStep] = useState<DialogStep>('credential')
  const [credentials, setCredentials] = useState<SshCredential[]>([])
  const [selectedCredId, setSelectedCredId] = useState<number | null>(null)
  const [results, setResults] = useState<LiveStatusResults | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [loadingCreds, setLoadingCreds] = useState(true)

  const isOpen = device !== null

  // Reset state each time a new device is clicked
  useEffect(() => {
    if (device) {
      setStep('credential')
      setSelectedCredId(null)
      setResults(null)
      setErrorMsg('')
    }
  }, [device])

  // Load SSH credentials whenever the dialog opens
  useEffect(() => {
    if (!isOpen) return

    let cancelled = false

    async function loadCreds() {
      setLoadingCreds(true)
      try {
        const response = await apiCall<SshCredential[]>(
          'credentials?include_expired=false'
        )
        if (!cancelled) {
          setCredentials(response.filter(c => c.type === 'ssh'))
        }
      } catch {
        if (!cancelled) setCredentials([])
      } finally {
        if (!cancelled) setLoadingCreds(false)
      }
    }

    loadCreds()

    return () => {
      cancelled = true
    }
  }, [isOpen, apiCall])

  const handleFetch = useCallback(async () => {
    if (!device || selectedCredId === null) return

    const ip = device.primary_ip4?.address
    if (!ip) {
      setErrorMsg(
        `Device "${device.name}" has no primary IP address configured in Nautobot.`
      )
      setStep('error')
      return
    }

    setStep('loading')
    try {
      // ── Phase 1: VRF discovery + default ARP + MAC table ──────────────────
      const phase1 = await apiCall<{ results: CommandResult[] }>(
        'netmiko/execute-commands',
        {
          method: 'POST',
          body: {
            devices: [{ ip, platform: 'cisco_ios' }],
            commands: ['show ip vrf', 'show ip arp', 'show mac address-table'],
            credential_id: selectedCredId,
            use_textfsm: true,
          },
        }
      )

      const r1 = phase1.results[0]
      if (!r1?.success) {
        setErrorMsg(r1?.error || r1?.output || 'Command execution failed.')
        setStep('error')
        return
      }

      const co1 = r1.command_outputs ?? {}
      const mac: MacEntry[] = Array.isArray(co1['show mac address-table'])
        ? (co1['show mac address-table'] as MacEntry[])
        : []
      const defaultArp: ArpEntry[] = Array.isArray(co1['show ip arp'])
        ? (co1['show ip arp'] as ArpEntry[])
        : []
      const vrfNames = parseVrfNames(co1['show ip vrf'])

      // ── Phase 2: per-VRF ARP (only when VRFs are present) ─────────────────
      let vrfArp: ArpEntry[] = []
      if (vrfNames.length > 0) {
        try {
          const vrfCommands = vrfNames.map(v => `show ip arp vrf ${v}`)
          const phase2 = await apiCall<{ results: CommandResult[] }>(
            'netmiko/execute-commands',
            {
              method: 'POST',
              body: {
                devices: [{ ip, platform: 'cisco_ios' }],
                commands: vrfCommands,
                credential_id: selectedCredId,
                use_textfsm: true,
              },
            }
          )
          const r2 = phase2.results[0]
          if (r2?.success) {
            const co2 = r2.command_outputs ?? {}
            for (const vrf of vrfNames) {
              const cmd = `show ip arp vrf ${vrf}`
              if (Array.isArray(co2[cmd])) {
                vrfArp = vrfArp.concat(
                  (co2[cmd] as ArpEntry[]).map(e => ({ ...e, vrf }))
                )
              }
            }
          }
        } catch {
          // Phase 2 failure is non-fatal — phase 1 results are still shown
        }
      }

      setResults({ arp: [...defaultArp, ...vrfArp], mac })
      setStep('results')
    } catch (err) {
      setErrorMsg((err as Error).message || 'Request failed.')
      setStep('error')
    }
  }, [device, selectedCredId, apiCall])

  if (!device) return null

  const deviceIp = device.primary_ip4?.address?.split('/')[0]

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Live Status — {device.name}
            {deviceIp && (
              <span className="text-sm font-normal text-muted-foreground ml-1">
                ({deviceIp})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {step === 'credential' && (
          <CredentialStep
            credentials={credentials}
            loadingCreds={loadingCreds}
            selectedCredId={selectedCredId}
            onSelect={setSelectedCredId}
            onFetch={handleFetch}
            onClose={onClose}
          />
        )}

        {step === 'loading' && <LoadingStep deviceName={device.name} />}

        {step === 'error' && (
          <ErrorStep
            message={errorMsg}
            onRetry={() => setStep('credential')}
            onClose={onClose}
          />
        )}

        {step === 'results' && results && (
          <ResultsStep
            results={results}
            deviceName={device.name}
            onRefetch={() => handleFetch()}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface CredentialStepProps {
  credentials: SshCredential[]
  loadingCreds: boolean
  selectedCredId: number | null
  onSelect: (id: number) => void
  onFetch: () => void
  onClose: () => void
}

function CredentialStep({
  credentials,
  loadingCreds,
  selectedCredId,
  onSelect,
  onFetch,
  onClose,
}: CredentialStepProps) {
  return (
    <div className="space-y-4 mt-2">
      <p className="text-sm text-muted-foreground">
        Select SSH credentials to connect and fetch live ARP and MAC address table data.
      </p>

      {loadingCreds ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : credentials.length === 0 ? (
        <StatusAlert variant="warning">
          No SSH credentials found. Please add SSH credentials in{' '}
          <strong>Settings → Credentials</strong>.
        </StatusAlert>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {credentials.map(cred => (
            <button
              key={cred.id}
              onClick={() => onSelect(cred.id)}
              className={cn(
                'w-full flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors',
                selectedCredId === cred.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card hover:bg-muted text-foreground'
              )}
            >
              <div className="flex items-center gap-3">
                <Key
                  className={cn(
                    'h-4 w-4 shrink-0',
                    selectedCredId === cred.id ? 'text-primary' : 'text-muted-foreground'
                  )}
                />
                <div>
                  <div className="text-sm font-medium">{cred.name}</div>
                  <div className="text-xs text-muted-foreground">{cred.username}</div>
                </div>
              </div>
              {cred.valid_until && (
                <span className="text-xs text-muted-foreground shrink-0 ml-4">
                  expires {cred.valid_until}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={onFetch}
          disabled={selectedCredId === null || loadingCreds}
          className="gap-1.5"
        >
          Fetch Live Status
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function LoadingStep({ deviceName }: { deviceName: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">
        Connecting to <strong>{deviceName}</strong> and executing commands…
      </p>
      <p className="text-xs text-muted-foreground">
        VRF discovery is included — this may require a second connection.
      </p>
    </div>
  )
}

interface ErrorStepProps {
  message: string
  onRetry: () => void
  onClose: () => void
}

function ErrorStep({ message, onRetry, onClose }: ErrorStepProps) {
  return (
    <div className="space-y-4 mt-2">
      <StatusAlert variant="error">
        <p className="text-sm font-medium">Command execution failed</p>
        <p className="text-xs mt-1 font-mono whitespace-pre-wrap break-all">{message}</p>
      </StatusAlert>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try Again
        </Button>
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  )
}

// ── Results Step ───────────────────────────────────────────────────────────────

interface ResultsStepProps {
  results: LiveStatusResults
  deviceName: string
  onRefetch: () => void
  onClose: () => void
}

function ResultsStep({ results, deviceName, onRefetch, onClose }: ResultsStepProps) {
  const [activeTab, setActiveTab] = useState<'arp' | 'mac'>('arp')

  return (
    <div className="space-y-4 mt-2">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        <TabButton
          active={activeTab === 'arp'}
          count={results.arp.length}
          label="ARP Table"
          onClick={() => setActiveTab('arp')}
        />
        <TabButton
          active={activeTab === 'mac'}
          count={results.mac.length}
          label="MAC Address Table"
          onClick={() => setActiveTab('mac')}
        />
      </div>

      {activeTab === 'arp' && <ArpTable rows={results.arp} />}
      {activeTab === 'mac' && <MacTable rows={results.mac} />}

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <p className="text-xs text-muted-foreground">
          Snapshot from <span className="font-medium">{deviceName}</span>
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRefetch} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

interface TabButtonProps {
  active: boolean
  label: string
  count: number
  onClick: () => void
}

function TabButton({ active, label, count, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      )}
    >
      {label}
      <span
        className={cn(
          'text-xs px-1.5 py-0.5 rounded-full',
          active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
        )}
      >
        {count}
      </span>
    </button>
  )
}

// ── ARP Table ──────────────────────────────────────────────────────────────────

function ArpTable({ rows }: { rows: ArpEntry[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState message="No ARP entries returned. TextFSM parsing may not be available for this platform." />
    )
  }

  const hasVrf = rows.some(r => r.vrf)

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted border-b border-border">
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground">
              IP Address
            </th>
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground">
              MAC Address
            </th>
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Age</th>
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground">
              Interface
            </th>
            {hasVrf && (
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">VRF</th>
            )}
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground">
              Protocol
            </th>
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Type</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr
              key={`${row.ip_address}-${row.interface}-${row.vrf ?? ''}`}
              className="hover:bg-muted/50 transition-colors"
            >
              <td className="px-3 py-2 font-mono text-foreground">{row.ip_address}</td>
              <td className="px-3 py-2 font-mono text-muted-foreground">{row.mac_address}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {row.age === '-' ? '—' : `${row.age} min`}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{row.interface}</td>
              {hasVrf && (
                <td className="px-3 py-2 text-muted-foreground">{row.vrf ?? '—'}</td>
              )}
              <td className="px-3 py-2 text-muted-foreground">{row.protocol}</td>
              <td className="px-3 py-2 text-muted-foreground">{row.type}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── MAC Table ──────────────────────────────────────────────────────────────────

function MacTable({ rows }: { rows: MacEntry[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState message="No MAC address entries returned. TextFSM parsing may not be available for this platform." />
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted border-b border-border">
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground">
              MAC Address
            </th>
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground">VLAN</th>
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Type</th>
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Port(s)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map(row => (
            <tr
              key={`${row.destination_address}-${row.vlan_id}`}
              className="hover:bg-muted/50 transition-colors"
            >
              <td className="px-3 py-2 font-mono text-foreground">
                {row.destination_address}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{row.vlan_id}</td>
              <td className="px-3 py-2">
                <MacTypeBadge type={row.type} />
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {Array.isArray(row.destination_port)
                  ? row.destination_port.join(', ')
                  : row.destination_port}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MacTypeBadge({ type }: { type: string }) {
  if (type === 'DYNAMIC') {
    return (
      <StatusBadge variant="success" className="font-medium">
        {type}
      </StatusBadge>
    )
  }
  if (type === 'STATIC') {
    return (
      <StatusBadge variant="info" className="font-medium">
        {type}
      </StatusBadge>
    )
  }
  return (
    <span className="px-1.5 py-0.5 rounded font-medium bg-muted text-muted-foreground">
      {type}
    </span>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground rounded-lg border border-dashed border-border">
      {message}
    </div>
  )
}
