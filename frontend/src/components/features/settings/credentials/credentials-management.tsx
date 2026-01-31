'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Key, Plus, RefreshCw } from 'lucide-react'
import { useCredentialsQuery } from './hooks/queries/use-credentials-query'
import { CredentialsTable } from './components/credentials-table'
import { CredentialFormDialog } from './components/credential-form-dialog'
import type { Credential } from './types'

export default function CredentialsManagement() {
  const [includeExpired, setIncludeExpired] = useState(false)
  const [formDialog, setFormDialog] = useState<{
    open: boolean
    credential?: Credential
  }>({ open: false })

  // TanStack Query hook - replaces all manual state management
  const { data, isLoading, refetch } = useCredentialsQuery({
    filters: {
      source: 'general',
      includeExpired
    }
  })

  const credentials = data || []

  const handleAddNew = () => {
    setFormDialog({ open: true })
  }

  const handleEdit = (credential: Credential) => {
    setFormDialog({ open: true, credential })
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="border-b pb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Key className="h-6 w-6 text-blue-600 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">System Credentials</h1>
              <p className="text-muted-foreground">Loading shared system credentials...</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-amber-100 p-2 rounded-lg">
            <Key className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">System Credentials</h1>
            <p className="text-muted-foreground mt-1">
              Manage shared system credentials for device access
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Reload
          </Button>
          <Button size="sm" onClick={handleAddNew}>
            <Plus className="h-4 w-4 mr-2" />
            Add Credential
          </Button>
        </div>
      </div>

      {/* Credentials Table */}
      <CredentialsTable
        credentials={credentials}
        includeExpired={includeExpired}
        onIncludeExpiredChange={setIncludeExpired}
        onEdit={handleEdit}
      />

      {/* Form Dialog */}
      <CredentialFormDialog
        open={formDialog.open}
        onOpenChange={(open) => setFormDialog({ open })}
        credential={formDialog.credential}
      />
    </div>
  )
}
