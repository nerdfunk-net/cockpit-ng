'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAgentsQuery } from '@/hooks/queries/use-agents-query'
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
import { parseAnsibleFacts } from '../utils/parse-ansible-facts'
import type { AnsibleCredentials, ServerResponse } from '../types'

const EMPTY_AGENTS: Agent[] = []

interface AddServerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onServerAdded: (server: ServerResponse) => void
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

export function AddServerDialog({ open, onOpenChange, onServerAdded }: AddServerDialogProps) {
  const { apiCall } = useApi()
  const { toast } = useToast()
  const { createServer } = useServerMutations()

  const [hostname, setHostname] = useState('')
  const [useSSHKey, setUseSSHKey] = useState(false)
  const [sshUser, setSshUser] = useState('root')
  const [selectedCredentialId, setSelectedCredentialId] = useState<string>('')
  const [selectedAgentId, setSelectedAgentId] = useState<string>('')
  const [isGettingFacts, setIsGettingFacts] = useState(false)

  const { data: sshCredentials = EMPTY_CREDENTIALS, isLoading: isLoadingCreds } = useSshCredentialsQuery({
    enabled: open,
  })

  const { data: allAgents = EMPTY_AGENTS, isLoading: isLoadingAgents } = useAgentsQuery({ enabled: open })
  const ansibleAgents = useMemo(
    () => allAgents.filter((a) => a.type === 'ansible'),
    [allAgents]
  )

  // Auto-select the only agent when there is exactly one
  useEffect(() => {
    if (ansibleAgents.length === 1 && ansibleAgents[0]?.agent_id && !selectedAgentId) {
      setSelectedAgentId(ansibleAgents[0].agent_id)
    }
  }, [ansibleAgents, selectedAgentId])

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setHostname('')
      setUseSSHKey(false)
      setSshUser('root')
      setSelectedCredentialId('')
      setSelectedAgentId('')
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

      const target = hostname.trim()
      const ansibleCredentials: AnsibleCredentials = {
        target,
        agent_id: selectedAgentId,
        use_sshkey: useSSHKey,
        ansible_user: ansibleUser,
        credential_id: useSSHKey ? null : selectedCredential?.id ?? null,
      }

      const serverData = {
        ...parseAnsibleFacts(result.output),
        location: null,
        contact: null,
        nautobot_uuid: null,
        ansible_credentials: ansibleCredentials,
      }
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
