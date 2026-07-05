'use client'

import { useState, useCallback } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GitBranch, Plus, RefreshCw } from 'lucide-react'
import { useConfirmDialog } from '@/hooks/use-confirm-dialog'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { StatusAlert } from '@/components/shared/status-alert'

// TanStack Query Hooks
import { useGitRepositoriesQuery } from '@/hooks/queries/use-git-repositories-query'
import { useGitMutations } from '@/hooks/queries/use-git-mutations'
import { useCredentialsQuery } from '@/hooks/queries/use-credentials-query'

// Custom Hooks
import { useRepositoryForm } from '../hooks/use-repository-form'
import { useRepositoryStatus } from '../hooks/use-repository-status'
import { useRepositoryDebug } from '../hooks/use-repository-debug'
import { useConnectionTest } from '../hooks/use-connection-test'

// Components
import { RepositoryList, RepositoryForm } from '.'
import {
  RepositoryEditDialog,
  RepositoryStatusDialog,
  RepositoryDebugDialog,
} from '../dialogs'

// Utils
import { extractCredentialName } from '../utils'
import { DEFAULT_FORM_DATA, EMPTY_CREDENTIALS } from '../constants'
import type { GitRepository } from '../types'
import type { RepositoryFormValues } from '../utils/validation'

const GitManagement: React.FC = () => {
  // Message state
  const [message] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Confirm dialog
  const { confirmDialog, openConfirm } = useConfirmDialog()

  // TanStack Query - Repositories
  const {
    data: reposData,
    isLoading: loadingRepos,
    refetch: refetchRepositories,
  } = useGitRepositoriesQuery()
  const repositories = reposData?.repositories || []

  // TanStack Query - Mutations
  const {
    createRepository: createRepoMutation,
    deleteRepository: deleteRepoMutation,
    syncRepository: syncRepoMutation,
    removeAndSyncRepository: removeAndSyncRepoMutation,
  } = useGitMutations()

  // TanStack Query - Credentials
  const { data: credentials = EMPTY_CREDENTIALS } = useCredentialsQuery()

  // Create form
  const createForm = useRepositoryForm()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Connection test
  const connectionTest = useConnectionTest()

  // Edit dialog
  const [editingRepo, setEditingRepo] = useState<GitRepository | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)

  // Status dialog
  const repositoryStatus = useRepositoryStatus()

  // Debug dialog
  const repositoryDebug = useRepositoryDebug()

  // Form submission
  const handleFormSubmit = useCallback(
    async (data: RepositoryFormValues) => {
      setIsSubmitting(true)
      try {
        const credentialName = extractCredentialName(data.credential_name)

        await createRepoMutation.mutateAsync({
          ...data,
          auth_type: data.auth_type || 'none',
          credential_name: credentialName,
        })

        createForm.reset(DEFAULT_FORM_DATA)
        connectionTest.clearStatus()
      } catch {
        // Error already handled by mutation's onError
      } finally {
        setIsSubmitting(false)
      }
    },
    [createRepoMutation, createForm, connectionTest]
  )

  // Connection test handler
  const handleConnectionTest = useCallback(() => {
    const formData = createForm.getValues()
    const credentialName = extractCredentialName(formData.credential_name)

    connectionTest.testConnection({
      url: formData.url,
      branch: formData.branch || 'main',
      auth_type: formData.auth_type || 'none',
      credential_name: credentialName,
      verify_ssl: formData.verify_ssl,
    })
  }, [createForm, connectionTest])

  // Repository actions
  const handleEditRepository = useCallback((repo: GitRepository) => {
    setEditingRepo(repo)
    setShowEditDialog(true)
  }, [])

  const handleDeleteRepository = useCallback(
    (repo: GitRepository) => {
      openConfirm({
        title: 'Delete Repository',
        description: `Are you sure you want to delete "${repo.name}"?`,
        variant: 'destructive',
        onConfirm: async () => {
          try {
            await deleteRepoMutation.mutateAsync(repo.id)
          } catch {
            // Error already handled by mutation's onError
          }
        },
      })
    },
    [deleteRepoMutation, openConfirm]
  )

  const handleSyncRepository = useCallback(
    async (repo: GitRepository) => {
      try {
        await syncRepoMutation.mutateAsync(repo.id)
      } catch {
        // Error already handled by mutation's onError
      }
    },
    [syncRepoMutation]
  )

  const handleRemoveAndSyncRepository = useCallback(
    (repo: GitRepository) => {
      openConfirm({
        title: 'Remove and Re-clone Repository',
        description: `Are you sure you want to remove and re-clone "${repo.name}"? This will permanently delete the local copy and create a fresh clone.`,
        variant: 'destructive',
        onConfirm: async () => {
          try {
            await removeAndSyncRepoMutation.mutateAsync(repo.id)
          } catch {
            // Error already handled by mutation's onError
          }
        },
      })
    },
    [removeAndSyncRepoMutation, openConfirm]
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <GitBranch className="h-6 w-6" />
          Git Repository Management
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage Git repositories for configurations, templates, and other resources
        </p>
      </div>

      {/* Status Message */}
      {message && (
        <StatusAlert variant={message.type === 'success' ? 'success' : 'error'}>
          {message.text}
        </StatusAlert>
      )}

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list" className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Repository List
          </TabsTrigger>
          <TabsTrigger value="add" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Repository
          </TabsTrigger>
        </TabsList>

        {/* Repository List Tab */}
        <TabsContent value="list" className="space-y-4">
          <RepositoryList
            repositories={repositories}
            isLoading={loadingRepos}
            onRefresh={refetchRepositories}
            onEdit={handleEditRepository}
            onSync={handleSyncRepository}
            onRemoveAndSync={handleRemoveAndSyncRepository}
            onViewStatus={repositoryStatus.openDialog}
            onDebug={repositoryDebug.openDialog}
            onDelete={handleDeleteRepository}
          />
        </TabsContent>

        {/* Add Repository Tab */}
        <TabsContent value="add" className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="panel-header py-3 pl-8 pr-6 -mx-6 -mt-6 mb-6">
              <CardTitle className="flex items-center gap-2 text-base">
                <Plus className="h-4 w-4" />
                Add New Git Repository
              </CardTitle>
              <CardDescription className="text-panel-header-muted text-sm">
                Configure a new Git repository for configurations, templates, or other
                resources
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={createForm.handleSubmit(handleFormSubmit)}
                className="space-y-6"
              >
                <RepositoryForm
                  form={createForm}
                  credentials={credentials}
                  isSubmitting={isSubmitting}
                  showConnectionTest
                  onConnectionTest={handleConnectionTest}
                  connectionTestStatus={connectionTest.status}
                  isTestingConnection={connectionTest.isLoading}
                />

                <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
                  <div className="flex gap-4">
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Add Repository
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        createForm.reset(DEFAULT_FORM_DATA)
                        connectionTest.clearStatus()
                      }}
                      variant="outline"
                    >
                      Reset Form
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <RepositoryEditDialog
        repository={editingRepo}
        show={showEditDialog}
        onClose={() => {
          setShowEditDialog(false)
          setEditingRepo(null)
        }}
        credentials={credentials}
      />

      <RepositoryStatusDialog
        show={repositoryStatus.showDialog}
        onClose={repositoryStatus.closeDialog}
        statusData={repositoryStatus.statusData}
        isLoading={repositoryStatus.isLoading}
      />

      <RepositoryDebugDialog
        show={repositoryDebug.showDialog}
        onClose={repositoryDebug.closeDialog}
        repository={repositoryDebug.debugRepo}
        result={repositoryDebug.debugResult}
        currentTab={repositoryDebug.debugTab}
        onTabChange={repositoryDebug.setDebugTab}
        isLoading={repositoryDebug.isLoading}
        onRunOperation={repositoryDebug.runOperation}
      />

      <ConfirmDialog {...confirmDialog} />
    </div>
  )
}

export default GitManagement
