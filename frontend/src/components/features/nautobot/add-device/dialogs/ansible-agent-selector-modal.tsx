'use client'

import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Bot, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Agent } from '@/components/features/settings/connections/agents/types'

interface AnsibleAgentSelectorModalProps {
  open: boolean
  agents: Agent[]
  isSending: boolean
  onConfirm: (agentId: string, ansibleUser: string) => void
  onClose: () => void
}

export function AnsibleAgentSelectorModal({
  open,
  agents,
  isSending,
  onConfirm,
  onClose,
}: AnsibleAgentSelectorModalProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>('')
  const [ansibleUser, setAnsibleUser] = useState('root')

  const selectedAgent = useMemo(
    () => agents.find(a => a.agent_id === selectedAgentId) ?? null,
    [agents, selectedAgentId]
  )

  const canConfirm = !!selectedAgent?.agent_id && ansibleUser.trim().length > 0 && !isSending

  const handleConfirm = () => {
    if (!selectedAgent?.agent_id) return
    onConfirm(selectedAgent.agent_id, ansibleUser.trim())
  }

  return (
    <Dialog open={open} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-600" />
            Select Ansible Agent
          </DialogTitle>
          <DialogDescription>
            Multiple Ansible agents are configured. Select one to gather facts from.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            {agents.map(agent => (
              <button
                key={agent.id}
                type="button"
                onClick={() => setSelectedAgentId(agent.agent_id ?? '')}
                className={cn(
                  'w-full text-left rounded-md border px-4 py-3 transition-colors',
                  selectedAgentId === agent.agent_id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-border hover:bg-muted/50'
                )}
              >
                <p className="font-medium text-sm">{agent.name}</p>
                {agent.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{agent.description}</p>
                )}
                {agent.agent_id && (
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    {agent.agent_id}
                  </p>
                )}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <Label htmlFor="ansible-user" className="text-sm">
              SSH Username
            </Label>
            <Input
              id="ansible-user"
              value={ansibleUser}
              onChange={e => setAnsibleUser(e.target.value)}
              placeholder="root"
              className="h-8 text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!canConfirm}>
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gathering…
              </>
            ) : (
              <>
                <Bot className="h-4 w-4 mr-2" />
                Run
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
