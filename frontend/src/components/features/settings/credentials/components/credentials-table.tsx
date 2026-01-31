'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Edit, Trash2, RefreshCw, Lock, Key } from 'lucide-react'
import { useCredentialMutations } from '../hooks/queries/use-credential-mutations'
import { DeleteCredentialDialog } from '../dialogs/delete-credential-dialog'
import type { Credential } from '../types'
import { getTypeIcon } from '../utils/credential-utils'
import { getStatusBadge } from './credential-status-badge'

interface CredentialsTableProps {
  credentials: Credential[]
  includeExpired: boolean
  onIncludeExpiredChange: (value: boolean) => void
  onEdit: (credential: Credential) => void
}

export function CredentialsTable({
  credentials,
  includeExpired,
  onIncludeExpiredChange,
  onEdit
}: CredentialsTableProps) {
  const { deleteCredential } = useCredentialMutations()
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    credential: Credential | null
  }>({ open: false, credential: null })

  const handleDelete = () => {
    if (deleteDialog.credential) {
      deleteCredential.mutate(deleteDialog.credential.id, {
        onSuccess: () => {
          setDeleteDialog({ open: false, credential: null })
        }
      })
    }
  }

  return (
    <>
      <div className="rounded-xl border shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Lock className="h-4 w-4" />
              <div>
                <h3 className="text-sm font-semibold">
                  System Credentials ({credentials.length})
                </h3>
                <p className="text-blue-100 text-xs">
                  Shared system credentials. Passwords are encrypted and never displayed.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-expired"
                checked={includeExpired}
                onCheckedChange={onIncludeExpiredChange}
              />
              <Label
                htmlFor="include-expired"
                className="text-sm text-blue-100 cursor-pointer"
              >
                Include expired
              </Label>
            </div>
          </div>
        </div>

        <div className="bg-white">
          {credentials.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto text-muted mb-4" />
              <p className="text-lg font-medium">No system credentials found</p>
              <p className="text-sm">Add your first system credential to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-semibold text-sm">Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">Username</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">Type</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">Valid Until</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {credentials.map((credential) => (
                    <tr key={credential.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <div className="font-medium">{credential.name}</div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {credential.username}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(credential.type)}
                          <span className="capitalize">{credential.type}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {credential.valid_until || '-'}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(credential.status)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(credential)}
                            className="h-8 w-8 p-0"
                            title="Edit"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDeleteDialog({ open: true, credential })
                            }
                            disabled={deleteCredential.isPending}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Delete"
                          >
                            {deleteCredential.isPending ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <DeleteCredentialDialog
        open={deleteDialog.open}
        onOpenChange={(open) =>
          setDeleteDialog({ open, credential: open ? deleteDialog.credential : null })
        }
        credentialName={deleteDialog.credential?.name || ''}
        onConfirm={handleDelete}
        isDeleting={deleteCredential.isPending}
      />
    </>
  )
}
