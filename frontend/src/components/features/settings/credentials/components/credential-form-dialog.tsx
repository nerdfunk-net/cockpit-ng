'use client'

import { useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription
} from '@/components/ui/form'
import { Upload, RefreshCw, CheckCircle } from 'lucide-react'
import { useCredentialForm } from '../hooks/use-credential-form'
import { useCredentialMutations } from '../hooks/queries/use-credential-mutations'
import { CREDENTIAL_TYPES } from '../constants'
import type { Credential, CredentialCreatePayload } from '../types'
import { getTypeIcon } from '../utils/credential-utils'

interface CredentialFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  credential?: Credential
}

export function CredentialFormDialog({
  open,
  onOpenChange,
  credential
}: CredentialFormDialogProps) {
  const isEditing = !!credential
  const form = useCredentialForm({ credential })
  const { createCredential, updateCredential } = useCredentialMutations()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isSaving = createCredential.isPending || updateCredential.isPending

  // Reset form when dialog opens/closes or credential changes
  useEffect(() => {
    if (open) {
      if (credential) {
        // Reset with credential values for editing
        form.reset({
          name: credential.name,
          username: credential.username,
          type: credential.type as 'ssh' | 'ssh_key' | 'tacacs' | 'generic' | 'token',
          password: '',
          ssh_private_key: '',
          ssh_passphrase: '',
          valid_until: credential.valid_until || '',
        })
      } else {
        // Reset to empty values for new credential
        form.reset({
          name: '',
          username: '',
          type: 'ssh',
          password: '',
          ssh_private_key: '',
          ssh_passphrase: '',
          valid_until: '',
        })
      }
    }
  }, [open, credential, form])

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      form.setValue('ssh_private_key', content)
    }
    reader.readAsText(file)

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const onSubmit = form.handleSubmit((data) => {
    const payload: CredentialCreatePayload = {
      name: data.name.trim(),
      username: data.username.trim(),
      type: data.type,
      valid_until: data.valid_until || null,
    }

    // Add type-specific credentials
    if (data.type === 'ssh_key') {
      if (data.ssh_private_key?.trim()) {
        payload.ssh_private_key = data.ssh_private_key
      }
      if (data.ssh_passphrase?.trim()) {
        payload.ssh_passphrase = data.ssh_passphrase
      }
    } else {
      if (data.password?.trim()) {
        payload.password = data.password
      }
    }

    if (isEditing) {
      updateCredential.mutate(
        { ...payload, id: credential.id },
        { onSuccess: () => onOpenChange(false) }
      )
    } else {
      createCredential.mutate(payload, {
        onSuccess: () => onOpenChange(false)
      })
    }
  })

  const watchedType = form.watch('type')
  const watchedSshKey = form.watch('ssh_private_key')

  const getPasswordLabel = () => {
    if (watchedType === 'token') {
      return isEditing ? 'Token (leave blank to keep current)' : 'Token'
    }
    return isEditing ? 'Password (leave blank to keep current)' : 'Password'
  }

  const getPasswordPlaceholder = () => {
    return watchedType === 'token' ? 'Enter token' : 'Enter password'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit System Credential' : 'New System Credential'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter credential name"
                      maxLength={128}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter username"
                      maxLength={128}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select credential type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CREDENTIAL_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            {getTypeIcon(type.value)}
                            {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Conditional fields based on credential type */}
            {watchedType === 'ssh_key' ? (
              <>
                {/* SSH Key Upload Section */}
                <FormField
                  control={form.control}
                  name="ssh_private_key"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        SSH Private Key
                        {!isEditing && <span className="text-destructive ml-1">*</span>}
                      </FormLabel>
                      <div className="space-y-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          onChange={handleFileUpload}
                          className="hidden"
                          id="ssh-key-upload"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Upload SSH Key File
                        </Button>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder={
                              isEditing
                                ? 'Leave blank to keep current key'
                                : 'Paste SSH private key or upload file above'
                            }
                            rows={6}
                            className="font-mono text-xs"
                          />
                        </FormControl>
                        {watchedSshKey && (
                          <p className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            SSH key loaded ({watchedSshKey.length} characters)
                          </p>
                        )}
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                {/* SSH Passphrase */}
                <FormField
                  control={form.control}
                  name="ssh_passphrase"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SSH Key Passphrase (optional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder={
                            isEditing
                              ? 'Leave blank to keep current passphrase'
                              : 'Enter passphrase if key is encrypted'
                          }
                          autoComplete="new-password"
                        />
                      </FormControl>
                      <FormDescription>
                        Only required if your SSH key is protected with a passphrase
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            ) : (
              /* Password field for non-SSH key types */
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {getPasswordLabel()}
                      {!isEditing && <span className="text-destructive ml-1">*</span>}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder={getPasswordPlaceholder()}
                        autoComplete="new-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="valid_until"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valid Until (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
