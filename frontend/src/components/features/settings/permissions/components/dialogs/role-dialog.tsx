import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import type { Role } from '../../types'
import { useCallback } from 'react'

const roleSchema = z.object({
  name: z.string().min(3, 'Role name must be at least 3 characters').max(50),
  description: z.string().min(1, 'Description is required').max(255),
})

type RoleFormData = z.infer<typeof roleSchema>

interface RoleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: RoleFormData) => void
  role?: Role | null
  isEdit?: boolean
}

export function RoleDialog({ open, onOpenChange, onSubmit, role, isEdit = false }: RoleDialogProps) {
  const form = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: isEdit && role
      ? {
          name: role.name,
          description: role.description,
        }
      : {
          name: '',
          description: '',
        }
  })

  const handleSubmit = form.handleSubmit((data) => {
    onSubmit(data)
    form.reset()
    onOpenChange(false)
  })

  const handleCancel = useCallback(() => {
    form.reset()
    onOpenChange(false)
  }, [form, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Role' : 'Create New Role'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update role information' : 'Add a new role to the system'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Administrator" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Full system access" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit">
                {isEdit ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
