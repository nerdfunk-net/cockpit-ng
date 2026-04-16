'use client'

import { useState, useEffect, useCallback } from 'react'
import { Activity, Loader2, AlertCircle, Key, ChevronRight, RefreshCw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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
        const response = await apiCall<SshCredential[]>('credentials?include_expired=false')
        if (!cancelled) {
          setCredentials(response.filter((c) => c.type === 'ssh'))
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
      const response = await apiCall<{ results: CommandResult[] }>(
        'netmiko/execute-commands',
        {
          method: 'POST',
          body: {
            devices: [{ ip, platform: 'cisco_ios' }],
            commands: ['show ip arp', 'show mac address-table'],
            credential_id: selectedCredId,
            use_textfsm: true,
          },
        }
      )

      const result = response.results[0]
      if (!result?.success) {
        setErrorMsg(result?.error || result?.output || 'Command execution failed.')
        setStep('error')
        return
      }

      const co = result.command_outputs
      const arp = Array.isArray(co?.['show ip arp'])
        ? (co!['show ip arp'] as ArpEntry[])
        : []
      const mac = Array.isArray(co?.['show mac address-table'])
        ? (co!['show mac address-table'] as MacEntry[])
        : []

      setResults({ arp, mac })
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
            <Activity className="h-5 w-5 text-blue-500" />
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
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        </div>
      ) : credentials.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No SSH credentials found. Please add SSH credentials in{' '}
          <strong>Settings → Credentials</strong>.
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {credentials.map((cred) => (
            <button
              key={cred.id}
              onClick={() => onSelect(cred.id)}
              className={cn(
                'w-full flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors',
                selectedCredId === cred.id
                  ? 'border-blue-500 bg-blue-50 text-blue-900'
                  : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-800'
              )}
            >
              <div className="flex items-center gap-3">
                <Key
                  className={cn(
                    'h-4 w-4 shrink-0',
                    selectedCredId === cred.id ? 'text-blue-500' : 'text-gray-400'
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

      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
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
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      <p className="text-sm text-muted-foreground">
        Connecting to <strong>{deviceName}</strong> and executing commands…
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
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-red-800">Command execution failed</p>
          <p className="text-xs text-red-700 mt-1 font-mono whitespace-pre-wrap break-all">
            {message}
          </p>
        </div>
      </div>
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
      <div className="flex gap-1 border-b border-gray-200">
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

      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
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
          ? 'border-blue-500 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      )}
    >
      {label}
      <span
        className={cn(
          'text-xs px-1.5 py-0.5 rounded-full',
          active ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
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

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-3 py-2 font-semibold text-gray-700">IP Address</th>
            <th className="text-left px-3 py-2 font-semibold text-gray-700">MAC Address</th>
            <th className="text-left px-3 py-2 font-semibold text-gray-700">Age</th>
            <th className="text-left px-3 py-2 font-semibold text-gray-700">Interface</th>
            <th className="text-left px-3 py-2 font-semibold text-gray-700">Protocol</th>
            <th className="text-left px-3 py-2 font-semibold text-gray-700">Type</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50 transition-colors">
              <td className="px-3 py-2 font-mono text-gray-800">{row.ip_address}</td>
              <td className="px-3 py-2 font-mono text-gray-600">{row.mac_address}</td>
              <td className="px-3 py-2 text-gray-600">
                {row.age === '-' ? '—' : `${row.age} min`}
              </td>
              <td className="px-3 py-2 text-gray-600">{row.interface}</td>
              <td className="px-3 py-2 text-gray-500">{row.protocol}</td>
              <td className="px-3 py-2 text-gray-500">{row.type}</td>
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
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-3 py-2 font-semibold text-gray-700">MAC Address</th>
            <th className="text-left px-3 py-2 font-semibold text-gray-700">VLAN</th>
            <th className="text-left px-3 py-2 font-semibold text-gray-700">Type</th>
            <th className="text-left px-3 py-2 font-semibold text-gray-700">Port(s)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50 transition-colors">
              <td className="px-3 py-2 font-mono text-gray-800">{row.destination_address}</td>
              <td className="px-3 py-2 text-gray-600">{row.vlan_id}</td>
              <td className="px-3 py-2">
                <MacTypeBadge type={row.type} />
              </td>
              <td className="px-3 py-2 text-gray-600">
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
  const style =
    type === 'DYNAMIC'
      ? 'bg-green-100 text-green-700'
      : type === 'STATIC'
        ? 'bg-blue-100 text-blue-700'
        : 'bg-gray-100 text-gray-600'

  return <span className={cn('px-1.5 py-0.5 rounded font-medium', style)}>{type}</span>
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground rounded-lg border border-dashed border-gray-200">
      {message}
    </div>
  )
}
