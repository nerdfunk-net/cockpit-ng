import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'

interface CreateRepositoryInput {
  name: string
  category: string
  url: string
  branch: string
  auth_type: string
  credential_name?: string | null
  path?: string
  verify_ssl: boolean
  git_author_name?: string
  git_author_email?: string
  description?: string
}

interface UpdateRepositoryInput extends CreateRepositoryInput {
  is_active: boolean
}

interface TestConnectionInput {
  url: string
  branch: string
  auth_type: string
  credential_name?: string | null
  verify_ssl: boolean
}

interface TestConnectionResponse {
  success: boolean
  message: string
}

/**
 * Hook for Git repository mutations using TanStack Query
 *
 * Provides mutations for creating, updating, deleting, and syncing Git repositories
 * with automatic cache invalidation and optimistic updates.
 *
 * @example
 * ```tsx
 * const {
 *   createRepository,
 *   updateRepository,
 *   deleteRepository,
 *   syncRepository,
 *   removeAndSyncRepository,
 *   testConnection
 * } = useGitMutations()
 *
 * // Create repository
 * createRepository.mutate({
 *   name: 'My Repo',
 *   category: 'device_configs',
 *   url: 'https://github.com/user/repo.git',
 *   branch: 'main',
 *   auth_type: 'none',
 *   verify_ssl: true
 * })
 * ```
 */
export function useGitMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Create repository mutation
  const createRepository = useMutation({
    mutationFn: async (data: CreateRepositoryInput) => {
      return apiCall('git-repositories', {
        method: 'POST',
        body: JSON.stringify(data)
      })
    },
    onSuccess: () => {
      // Invalidate repositories list to trigger refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.git.repositories() })
      toast({
        title: 'Success',
        description: 'Repository added successfully!',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add repository',
        variant: 'destructive'
      })
    }
  })

  // Update repository mutation
  const updateRepository = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateRepositoryInput }) => {
      return apiCall(`git-repositories/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      })
    },
    onSuccess: () => {
      // Invalidate repositories list and specific repository
      queryClient.invalidateQueries({ queryKey: queryKeys.git.repositories() })
      toast({
        title: 'Success',
        description: 'Repository updated successfully!',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update repository',
        variant: 'destructive'
      })
    }
  })

  // Delete repository mutation
  const deleteRepository = useMutation({
    mutationFn: async (id: number) => {
      return apiCall(`git-repositories/${id}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      // Invalidate repositories list
      queryClient.invalidateQueries({ queryKey: queryKeys.git.repositories() })
      toast({
        title: 'Success',
        description: 'Repository deleted successfully!',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete repository',
        variant: 'destructive'
      })
    }
  })

  // Sync repository mutation
  const syncRepository = useMutation({
    mutationFn: async (id: number) => {
      return apiCall(`git/${id}/sync`, { method: 'POST' })
    },
    onSuccess: () => {
      // Invalidate repositories list to update last_sync
      queryClient.invalidateQueries({ queryKey: queryKeys.git.repositories() })
      toast({
        title: 'Success',
        description: 'Repository synced successfully!',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to sync repository',
        variant: 'destructive'
      })
    }
  })

  // Remove and sync repository mutation
  const removeAndSyncRepository = useMutation({
    mutationFn: async (id: number) => {
      return apiCall(`git/${id}/remove-and-sync`, { method: 'POST' })
    },
    onSuccess: () => {
      // Invalidate repositories list
      queryClient.invalidateQueries({ queryKey: queryKeys.git.repositories() })
      toast({
        title: 'Success',
        description: 'Repository removed and re-cloned successfully!',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove and sync repository',
        variant: 'destructive'
      })
    }
  })

  // Test connection mutation (doesn't modify cache)
  const testConnection = useMutation({
    mutationFn: async (data: TestConnectionInput) => {
      return apiCall<TestConnectionResponse>('git-repositories/test-connection', {
        method: 'POST',
        body: JSON.stringify(data)
      })
    },
    // No cache invalidation needed for test connection
    // Toast handled by caller since response determines success/error
  })

  return {
    createRepository,
    updateRepository,
    deleteRepository,
    syncRepository,
    removeAndSyncRepository,
    testConnection
  }
}

// Export types
export type {
  CreateRepositoryInput,
  UpdateRepositoryInput,
  TestConnectionInput,
  TestConnectionResponse
}
