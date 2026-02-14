'use client'

import { useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { GitBranch, Loader2 } from 'lucide-react'
import type { UseMutationResult } from '@tanstack/react-query'
import type { GitPullInput, CommandResult } from '../types'

const schema = z.object({
  repository_path: z.string().min(1, 'Repository path is required'),
  branch: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface GitPullDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentId: string
  mutation: UseMutationResult<CommandResult, Error, GitPullInput>
}

export function GitPullDialog({ open, onOpenChange, agentId, mutation }: GitPullDialogProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      repository_path: '',
      branch: 'main',
    },
  })

  const handleSubmit = useCallback(
    (values: FormValues) => {
      mutation.mutate(
        {
          agent_id: agentId,
          repository_path: values.repository_path,
          branch: values.branch || 'main',
        },
        {
          onSuccess: () => {
            form.reset()
            onOpenChange(false)
          },
        }
      )
    },
    [agentId, mutation, form, onOpenChange]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Git Pull
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Agent</label>
              <Input value={agentId} disabled />
            </div>

            <FormField
              control={form.control}
              name="repository_path"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Repository Path</FormLabel>
                  <FormControl>
                    <Input placeholder="/opt/app" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="branch"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Branch</FormLabel>
                  <FormControl>
                    <Input placeholder="main" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Execute
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
