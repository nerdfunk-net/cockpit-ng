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
import { RotateCcw, Loader2 } from 'lucide-react'
import type { UseMutationResult } from '@tanstack/react-query'
import type { DockerRestartInput, CommandResult } from '../types'

const schema = z.object({
  container_name: z.string().min(1, 'Container name is required'),
})

type FormValues = z.infer<typeof schema>

interface DockerRestartDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentId: string
  mutation: UseMutationResult<CommandResult, Error, DockerRestartInput>
}

export function DockerRestartDialog({
  open,
  onOpenChange,
  agentId,
  mutation,
}: DockerRestartDialogProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      container_name: '',
    },
  })

  const handleSubmit = useCallback(
    (values: FormValues) => {
      mutation.mutate(
        {
          agent_id: agentId,
          container_name: values.container_name,
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
            <RotateCcw className="h-5 w-5" />
            Docker Restart
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
              name="container_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Container Name</FormLabel>
                  <FormControl>
                    <Input placeholder="my-container" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Restart
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
