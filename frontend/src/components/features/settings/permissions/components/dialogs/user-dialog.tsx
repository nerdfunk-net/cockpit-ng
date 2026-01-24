import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Checkbox } from '@/components/ui/checkbox'
import type { User } from '../../types'
import { useCallback, useEffect } from 'react'

const createUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(50),
  realname: z.string().min(1, 'Real name is required').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  is_active: z.boolean(),
})

const updateUserSchema = z.object({
  realname: z.string().max(100).optional().or(z.literal('')),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  password: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
  is_active: z.boolean().optional(),
})

type CreateUserFormData = z.infer<typeof createUserSchema>
type UpdateUserFormData = z.infer<typeof updateUserSchema>

interface UserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: CreateUserFormData | UpdateUserFormData) => void
  user?: User | null
  isEdit?: boolean
}

export function UserDialog({ open, onOpenChange, onSubmit, user, isEdit = false }: UserDialogProps) {
  const form = useForm<CreateUserFormData | UpdateUserFormData>({
    resolver: zodResolver(isEdit ? updateUserSchema : createUserSchema),
    defaultValues: isEdit && user
      ? {
          realname: user.realname || '',
          email: user.email || '',
          password: '',
          is_active: user.is_active,
        }
      : {
          username: '',
          realname: '',
          email: '',
          password: '',
          is_active: true,
        }
  })

  // Reset form when user changes or dialog opens
  useEffect(() => {
    if (open) {
      if (isEdit && user) {
        form.reset({
          realname: user.realname || '',
          email: user.email || '',
          password: '',
          is_active: user.is_active,
        })
      } else {
        form.reset({
          username: '',
          realname: '',
          email: '',
          password: '',
          is_active: true,
        })
      }
    }
  }, [open, user, isEdit, form])

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
          <DialogTitle>{isEdit ? 'Edit User' : 'Create New User'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update user information' : 'Add a new user to the system'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isEdit && (
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="johndoe" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="realname"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Real Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="John Doe" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" placeholder="john@example.com" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password {isEdit && '(leave blank to keep current)'}</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" placeholder="••••••••" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Active</FormLabel>
                  </div>
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
