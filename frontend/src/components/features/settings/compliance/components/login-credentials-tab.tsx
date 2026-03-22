'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, Trash2, Edit } from 'lucide-react'

import { useLoginCredentialsQuery } from '../hooks/use-login-credentials-query'
import { useLoginCredentialsMutations } from '../hooks/use-login-credentials-mutations'
import { LoginCredentialDialog } from '../dialogs/login-credential-dialog'

import type { LoginCredential, LoginCredentialFormData } from '../types'
import { DEFAULT_LOGIN_FORM, EMPTY_LOGIN_CREDENTIALS } from '../utils/constants'
import type { OpenConfirmFn } from './types'

interface LoginCredentialsTabProps {
  openConfirm: OpenConfirmFn
  isActiveTab: boolean
}

export function LoginCredentialsTab({ openConfirm, isActiveTab }: LoginCredentialsTabProps) {
  const {
    data: loginCredentials = EMPTY_LOGIN_CREDENTIALS,
    isLoading: loginCredentialsLoading,
  } = useLoginCredentialsQuery({ enabled: isActiveTab })

  const { createCredential, updateCredential, deleteCredential } = useLoginCredentialsMutations()

  const [showDialog, setShowDialog] = useState(false)
  const [editingCredential, setEditingCredential] = useState<LoginCredential | null>(null)
  const [form, setForm] = useState<LoginCredentialFormData>(DEFAULT_LOGIN_FORM)

  const handleAdd = useCallback(() => {
    setEditingCredential(null)
    setForm(DEFAULT_LOGIN_FORM)
    setShowDialog(true)
  }, [])

  const handleEdit = useCallback((credential: LoginCredential) => {
    setEditingCredential(credential)
    setForm({
      name: credential.name || '',
      username: credential.username,
      password: '', // Don't pre-fill password
      description: credential.description || '',
    })
    setShowDialog(true)
  }, [])

  const handleSave = useCallback(async () => {
    if (editingCredential) {
      await updateCredential.mutateAsync({ id: editingCredential.id, data: form })
    } else {
      await createCredential.mutateAsync(form)
    }
    setShowDialog(false)
  }, [editingCredential, form, updateCredential, createCredential])

  const handleDelete = useCallback(
    (id: number) => {
      openConfirm({
        title: 'Delete login credential?',
        description: 'Are you sure you want to delete this login credential?',
        onConfirm: () => deleteCredential.mutateAsync(id),
        variant: 'destructive',
      })
    },
    [deleteCredential, openConfirm]
  )

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Login Credentials</CardTitle>
              <CardDescription>
                Username and password combinations for compliance checks
              </CardDescription>
            </div>
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Add Credential
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loginCredentialsLoading && loginCredentials.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : loginCredentials.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No credentials configured</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Password</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loginCredentials.map((credential) => (
                  <TableRow key={credential.id}>
                    <TableCell className="font-medium">
                      {credential.name || credential.username}
                    </TableCell>
                    <TableCell>{credential.username}</TableCell>
                    <TableCell className="font-mono text-sm">{credential.password}</TableCell>
                    <TableCell>{credential.description || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={credential.is_active ? 'default' : 'secondary'}>
                        {credential.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(credential)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(credential.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <LoginCredentialDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        credential={editingCredential}
        formData={form}
        onFormChange={setForm}
        onSave={handleSave}
        isSaving={
          editingCredential ? updateCredential.isPending : createCredential.isPending
        }
      />
    </>
  )
}
