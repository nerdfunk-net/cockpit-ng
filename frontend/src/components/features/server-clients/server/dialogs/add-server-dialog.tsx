'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Bot, Loader2, Plus } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { useSshCredentialsQuery, type SshCredential } from '@/hooks/queries/use-ssh-credentials-query'
import { useServerMutations } from '@/hooks/queries/use-server-mutations'
import type { Agent } from '@/components/features/settings/connections/agents/types'
import type { ServerResponse } from '../types'

interface AddServerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onServerAdded: (server: ServerResponse) => void
}

interface AgentsSettingsResponse {
  success: boolean
  data?: { agents: Agent[] }
}

interface CommandResponse {
  command_id: string
  status: string
  output: unknown
  error?: string
  execution_time_ms: number
}

interface CredentialPasswordResponse {
  password: string
}

const EMPTY_CREDENTIALS: SshCredential[] = []

const VIRTUAL_FS = new Set([
  'tmpfs', 'proc', 'sysfs', 'devtmpfs', 'cgroup', 'cgroup2',
  'devpts', 'hugetlbfs', 'mqueue', 'securityfs', 'fusectl', 'pstore',
])

function countRealMounts(mounts: Array<{ device?: string; fstype?: string }>): number {
  return mounts.filter(
    (m) => m.device?.startsWith('/dev/') && !VIRTUAL_FS.has(m.fstype ?? '')
  ).length
}

function parseAnsibleFacts(output: unknown) {
  const raw = output as Record<string, unknown> | null
  const f = (raw?.facts as Record<string, unknown> | undefined)
    ?.ansible_facts as Record<string, unknown> | undefined ?? {}

  const defaultIpv4 = f.default_ipv4 as Record<string, string> | undefined
  const mounts = (f.mounts as Array<{ device?: string; fstype?: string }>) ?? []

  return {
    hostname: (f.fqdn as string) ?? (f.hostname as string) ?? '',
    os_family: (f.os_family as string) ?? '',
    processor_count: (f.processor_count as number) ?? null,
    memtotal_mb: (f.memtotal_mb as number) ?? null,
    architecture: (f.architecture as string) ?? '',
    distribution_release: (f.distribution_release as string) ?? '',
    distribution_version: (f.distribution_version as string) ?? '',
    primary_ipv4: defaultIpv4?.address ?? '',
    primary_interface: defaultIpv4?.interface ?? '',
    disk_count: countRealMounts(mounts),
    ansible_facts: (raw?.facts as Record<string, unknown>) ?? null,
    location: null,
    contact: null,
    nautobot_uuid: null,
  }
}

export function AddServerDialog({ open, onOpenChange, onServerAdded }: AddServerDialogProps) {
  const { apiCall } = useApi()
  const { toast } = useToast()
  const { createServer } = useServerMutations()

  const [hostname, setHostname] = useState('')
  const [useSSHKey, setUseSSHKey] = useState(false)
  const [sshUser, setSshUser] = useState('root')
  const [selectedCredentialId, setSelectedCredentialId] = useState<string>('')
  const [selectedAgentId, setSelectedAgentId] = useState<string>('')
  const [ansibleAgents, setAnsibleAgents] = useState<Agent[]>([])
  const [isLoadingAgents, setIsLoadingAgents] = useState(false)
  const [isGettingFacts, setIsGettingFacts] = useState(false)

  const { data: sshCredentials = EMPTY_CREDENTIALS, isLoading: isLoadingCreds } = useSshCredentialsQuery({
    enabled: open,
  })

  // Load ansible agents when dialog opens
  useEffect(() => {
    if (!open) return
    setIsLoadingAgents(true)
    apiCall<AgentsSettingsResponse>('settings/agents')
      .then((response) => {
        const all = response?.data?.agents ?? []
        const filtered = all.filter((a) => a.type === 'ansible')
        setAnsibleAgents(filtered)
        if (filtered.length === 1 && filtered[0]?.agent_id) {
          setSelectedAgentId(filtered[0].agent_id)
        }
      })
      .catch(() => {
        toast({
          title: 'Failed to load agents',
          description: 'Could not fetch configured agents.',
          variant: 'destructive',
        })
      })
      .finally(() => setIsLoadingAgents(false))
  }, [open, apiCall, toast])

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setHostname('')
      setUseSSHKey(false)
      setSshUser('root')
      setSelectedCredentialId('')
      setSelectedAgentId('')
      setAnsibleAgents([])
    }
  }, [open])

  const selectedCredential = useMemo(
    () => sshCredentials.find((c) => String(c.id) === selectedCredentialId) ?? null,
    [sshCredentials, selectedCredentialId]
  )

  const canGetFacts = useMemo(() => {
    if (!hostname.trim() || !selectedAgentId || isGettingFacts) return false
    if (!useSSHKey && !selectedCredentialId) return false
    return true
  }, [hostname, selectedAgentId, useSSHKey, selectedCredentialId, isGettingFacts])

  const handleGetFacts = useCallback(async () => {
    if (!canGetFacts) return

    setIsGettingFacts(true)
    try {
      let ansiblePassword: string | undefined
      let ansibleUser: string

      if (useSSHKey) {
        ansibleUser = sshUser.trim() || 'root'
      } else {
        if (!selectedCredential) return
        ansibleUser = selectedCredential.username
        const pwResp = await apiCall<CredentialPasswordResponse>(
          `credentials/${selectedCredential.id}/password`
        )
        ansiblePassword = pwResp.password
      }

      const params: Record<string, unknown> = {
        ip_address: hostname.trim(),
        ansible_user: ansibleUser,
        use_sshkey: useSSHKey,
      }
      if (ansiblePassword !== undefined) {
        params.ansible_password = ansiblePassword
      }

      const result = await apiCall<CommandResponse>('cockpit-agent/command', {
        method: 'POST',
        body: JSON.stringify({
          agent_id: selectedAgentId,
          command: 'get_facts',
          params,
          timeout: 60,
        }),
      })

      if (result.status !== 'success') {
        toast({
          title: 'Failed to gather facts',
          description: result.error ?? 'Unknown error from agent',
          variant: 'destructive',
        })
        return
      }

      const serverData = parseAnsibleFacts(result.output)
      const saved = await createServer.mutateAsync(serverData)

      toast({ title: 'Server added', description: saved.hostname })
      onServerAdded(saved)
      onOpenChange(false)
    } catch (err: unknown) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'An unexpected error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsGettingFacts(false)
    }
  }, [
    canGetFacts, useSSHKey, sshUser, selectedCredential, hostname,
    selectedAgentId, apiCall, toast, createServer, onServerAdded, onOpenChange,
  ])

  const isLoading = isLoadingAgents || isLoadingCreds

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-blue-600" />
            Add Server
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Hostname / IP */}
          <div className="space-y-1">
            <Label htmlFor="add-server-host">Hostname or IP Address</Label>
            <Input
              id="add-server-host"
              placeholder="192.168.1.1 or server.example.com"
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              disabled={isGettingFacts}
            />
          </div>

          {/* SSH Credentials */}
          <div className="space-y-1">
            <Label htmlFor="add-server-cred">SSH Credential</Label>
            <Select
              value={selectedCredentialId}
              onValueChange={setSelectedCredentialId}
              disabled={useSSHKey || isLoadingCreds || isGettingFacts}
            >
              <SelectTrigger id="add-server-cred">
                <SelectValue
                  placeholder={
                    isLoadingCreds
                      ? 'Loading…'
                      : sshCredentials.length === 0
                        ? 'No SSH credentials found'
                        : 'Select credential'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {sshCredentials.map((cred) => (
                  <SelectItem key={cred.id} value={String(cred.id)}>
                    {cred.name}
                    <span className="text-muted-foreground ml-1 text-xs">({cred.username})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Use SSH Key checkbox */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="add-server-sshkey"
              checked={useSSHKey}
              onCheckedChange={(checked) => setUseSSHKey(checked === true)}
              disabled={isGettingFacts}
            />
            <Label htmlFor="add-server-sshkey" className="cursor-pointer">
              Use SSH key
            </Label>
          </div>

          {/* SSH Username (only when using SSH key) */}
          {useSSHKey && (
            <div className="space-y-1">
              <Label htmlFor="add-server-sshuser">SSH Username</Label>
              <Input
                id="add-server-sshuser"
                placeholder="root"
                value={sshUser}
                onChange={(e) => setSshUser(e.target.value)}
                disabled={isGettingFacts}
              />
            </div>
          )}

          {/* Ansible Agent */}
          <div className="space-y-1">
            <Label htmlFor="add-server-agent">Ansible Agent</Label>
            {isLoadingAgents ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground h-9 px-3">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading agents…
              </div>
            ) : ansibleAgents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No Ansible agents configured. Add one in Settings → Connections → Agents.
              </p>
            ) : (
              <Select
                value={selectedAgentId}
                onValueChange={setSelectedAgentId}
                disabled={isGettingFacts}
              >
                <SelectTrigger id="add-server-agent">
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  {ansibleAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.agent_id ?? agent.id}>
                      <div className="flex items-center gap-2">
                        <Bot className="h-3.5 w-3.5 text-blue-500" />
                        {agent.name}
                        {agent.agent_id && (
                          <span className="text-muted-foreground text-xs font-mono">
                            ({agent.agent_id})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isGettingFacts}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleGetFacts}
            disabled={!canGetFacts || isLoading}
          >
            {isGettingFacts ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gathering Facts…
              </>
            ) : (
              'Get Facts'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
