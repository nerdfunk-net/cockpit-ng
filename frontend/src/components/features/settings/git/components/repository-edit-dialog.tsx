// Repository Edit Dialog Component

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RefreshCw, Settings } from 'lucide-react'
import { useRepositoryForm } from '../hooks/use-repository-form'
import { useGitMutations } from '../hooks/queries/use-git-mutations'
import { RepositoryForm } from './repository-form'
import { buildCredentialValue, extractCredentialName } from '../utils'
import type { GitRepository, GitCredential } from '../types'
import type { RepositoryFormValues } from '../validation'

interface RepositoryEditDialogProps {
  repository: GitRepository | null
  show: boolean
  onClose: () => void
  credentials: GitCredential[]
}

export function RepositoryEditDialog({
  repository,
  show,
  onClose,
  credentials,
}: RepositoryEditDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { updateRepository: updateRepoMutation } = useGitMutations()

  // Create form with repository data
  const form = useRepositoryForm({ repository: repository || undefined })

  // Reset form when repository changes
  useEffect(() => {
    if (repository && show) {
      const credentialValue = buildCredentialValue(
        credentials,
        repository.credential_name,
        repository.auth_type || 'none'
      )

      form.reset({
        name: repository.name,
        category: repository.category as RepositoryFormValues['category'],
        url: repository.url,
        branch: repository.branch,
        auth_type: (repository.auth_type || 'none') as RepositoryFormValues['auth_type'],
        credential_name: credentialValue,
        path: repository.path || '',
        verify_ssl: repository.verify_ssl,
        git_author_name: repository.git_author_name || '',
        git_author_email: repository.git_author_email || '',
        description: repository.description || '',
      })
    }
  }, [repository, credentials, show, form])

  const handleSubmit = async (data: RepositoryFormValues) => {
    if (!repository) return

    setIsSubmitting(true)
    try {
      const credentialName = extractCredentialName(data.credential_name)

      await updateRepoMutation.mutateAsync({
        id: repository.id,
        data: {
          ...data,
          auth_type: data.auth_type || 'none',
          credential_name: credentialName,
          is_active: repository.is_active,
        },
      })

      onClose()
    } catch (error) {
      console.error('Error updating repository:', error)
      // Error already handled by mutation's onError
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={show} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Git Repository</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <RepositoryForm
            form={form}
            credentials={credentials}
            isSubmitting={isSubmitting}
            showConnectionTest={false}
          />

          <div className="flex justify-end gap-4">
            <Button onClick={onClose} variant="outline" type="button">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
            >
              {isSubmitting ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Settings className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
