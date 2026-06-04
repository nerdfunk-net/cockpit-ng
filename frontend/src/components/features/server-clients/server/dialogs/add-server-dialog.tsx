'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAgentsQuery } from '@/hooks/queries/use-agents-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { AlertCircle, Bot, Loader2, Server } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { useSshCredentialsQuery, type SshCredential } from '@/hooks/queries/use-ssh-credentials-query'
import { useServerMutations } from '@/hooks/queries/use-server-mutations'
import type { Agent } from '@/components/features/settings/connections/agents/types'
import { parseAnsibleFacts } from '../utils/parse-ansible-facts'
import type { AnsibleCredentials, ServerResponse } from '../types'

const EMPTY_AGENTS: Agent[] = []

/** Higher-contrast fields on light gradient dialog backgrounds (see doc/STYLE_GUIDE_DESIGN.md). */
const FIELD_INPUT_CLASS =
  'bg-white border-gray-300 text-gray-900 shadow-sm placeholder:text-gray-500 focus-visible:border-blue-500 focus-visible:ring-blue-500/30'

const FIELD_SELECT_TRIGGER_CLASS = `w-full ${FIELD_INPUT_CLASS}`

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

  useEffect(() => {
    if (ansibleAgents.length === 1 && ansibleAgents[0]?.agent_id && !selectedAgentId) {
      setSelectedAgentId(ansibleAgents[0].agent_id)
    }
  }, [ansibleAgents, selectedAgentId])

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
    } catch {
      // Error toast is shown by useServerMutations createServer.onError
    } finally {
      setIsGettingFacts(false)
    }
  }, [
    canGetFacts,
    useSSHKey,
    sshUser,
    selectedCredential,
    hostname,
    selectedAgentId,
    apiCall,
    toast,
    createServer,
    onServerAdded,
    onOpenChange,
  ])

  const isLoading = isLoadingAgents || isLoadingCreds

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Add Server</DialogTitle>
          <DialogDescription>
            Configure hostname and credentials, then gather Ansible facts to register the server.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 px-4 py-3 text-white">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white/20 p-2">
              <Server className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-medium">Add Server</h2>
              <p className="mt-0.5 text-xs text-blue-100">
                Connect via Ansible to gather host facts and register the server
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 bg-gradient-to-b from-white to-gray-50 p-6">
          <Alert className="border-blue-200 bg-blue-50">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm text-blue-800">
              Enter the target hostname or IP and choose how Cockpit authenticates. Facts are
              collected through the selected Ansible agent.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="add-server-host" className="text-sm font-medium text-gray-700">
              Hostname or IP address
            </Label>
            <Input
              id="add-server-host"
              placeholder="192.168.1.1 or server.example.com"
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              disabled={isGettingFacts}
              className={FIELD_INPUT_CLASS}
            />
            <p className="text-xs text-gray-500">
              Used as the Ansible connection target and stored on the server record.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="add-server-cred" className="text-sm font-medium text-gray-700">
              SSH credential
            </Label>
            <Select
              value={selectedCredentialId}
              onValueChange={setSelectedCredentialId}
              disabled={useSSHKey || isLoadingCreds || isGettingFacts}
            >
              <SelectTrigger id="add-server-cred" className={FIELD_SELECT_TRIGGER_CLASS}>
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
                    <span className="ml-1 text-xs text-muted-foreground">({cred.username})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Stored credentials from Settings. Not used when SSH key authentication is enabled.
            </p>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 p-4 shadow-sm">
            <Checkbox
              id="add-server-sshkey"
              checked={useSSHKey}
              onCheckedChange={(checked) => setUseSSHKey(checked === true)}
              disabled={isGettingFacts}
              className="mt-0.5 border-gray-400 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
            />
            <div className="flex-1 space-y-1">
              <Label htmlFor="add-server-sshkey" className="cursor-pointer text-sm font-medium text-gray-800">
                Use SSH key
              </Label>
              <p className="text-xs text-gray-600">
                Authenticate with the agent&apos;s configured SSH key instead of a stored password.
              </p>
            </div>
          </div>

          {useSSHKey ? (
            <div className="space-y-2">
              <Label htmlFor="add-server-sshuser" className="text-sm font-medium text-gray-700">
                SSH username
              </Label>
              <Input
                id="add-server-sshuser"
                placeholder="root"
                value={sshUser}
                onChange={(e) => setSshUser(e.target.value)}
                disabled={isGettingFacts}
                className={FIELD_INPUT_CLASS}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="add-server-agent" className="text-sm font-medium text-gray-700">
              Ansible agent
            </Label>
            {isLoadingAgents ? (
              <div className="flex h-9 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-600 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                Loading agents…
              </div>
            ) : ansibleAgents.length === 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                No Ansible agents configured. Add one in Settings → Connections → Agents.
              </div>
            ) : (
              <Select
                value={selectedAgentId}
                onValueChange={setSelectedAgentId}
                disabled={isGettingFacts}
              >
                <SelectTrigger id="add-server-agent" className={FIELD_SELECT_TRIGGER_CLASS}>
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  {ansibleAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.agent_id ?? agent.id}>
                      <div className="flex items-center gap-2">
                        <Bot className="h-3.5 w-3.5 text-blue-500" />
                        {agent.name}
                        {agent.agent_id ? (
                          <span className="font-mono text-xs text-muted-foreground">
                            ({agent.agent_id})
                          </span>
                        ) : null}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-gray-200 bg-white px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isGettingFacts}
            className="border-gray-300"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleGetFacts}
            disabled={!canGetFacts || isLoading}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {isGettingFacts ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
