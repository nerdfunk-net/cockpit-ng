'use client'

import { useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { GitBranch, Loader2 } from 'lucide-react'
import type { UseMutationResult } from '@tanstack/react-query'
import type { GitPullInput, CommandResult } from '../types'

interface GitPullDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentId: string
  mutation: UseMutationResult<CommandResult, Error, GitPullInput>
}

export function GitPullDialog({ open, onOpenChange, agentId, mutation }: GitPullDialogProps) {
  const handleSubmit = useCallback(() => {
    mutation.mutate(
      {
        agent_id: agentId,
      },
      {
        onSuccess: () => {
          onOpenChange(false)
        },
      }
    )
  }, [agentId, mutation, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Git Pull
          </DialogTitle>
          <DialogDescription>
            Pull the latest changes from the configured git repository on agent <strong>{agentId}</strong>.
            The repository path is configured locally on the agent.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Execute Pull
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
