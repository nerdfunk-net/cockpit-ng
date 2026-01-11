import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { GitRepository, GitRepositoriesResponse } from './queries/use-git-repositories-query'

/**
 * Hook for Git repository mutations with optimistic updates
 *
 * Demonstrates TanStack Query's optimistic update pattern:
 * - Updates UI immediately before API call
 * - Shows instant feedback to user
 * - Automatically rolls back on error
 * - Preserves data consistency
 *
 * @example
 * ```tsx
 * const { syncRepositoryOptimistic } = useGitMutationsOptimistic()
 *
 * // UI updates immediately, then syncs in background
 * syncRepositoryOptimistic.mutate({ id: 1, name: 'my-repo' })
 * ```
 */
export function useGitMutationsOptimistic() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  /**
   * Sync repository with optimistic UI update
   *
   * Before API call:
   * - Immediately updates sync_status to 'syncing'
   * - Shows "Syncing..." in UI
   * - User sees instant feedback
   *
   * On success:
   * - Invalidates cache to fetch real sync result
   * - Shows success toast
   *
   * On error:
   * - Automatically rolls back to previous state
   * - Shows error toast
   * - No manual cleanup needed!
   */
  const syncRepositoryOptimistic = useMutation({
    mutationFn: async (repo: { id: number; name: string }) => {
      return apiCall(`git/${repo.id}/sync`, { method: 'POST' })
    },

    // OPTIMISTIC UPDATE: Run before API call
    onMutate: async (repo) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: queryKeys.git.repositories() })

      // Snapshot the previous value
      const previousRepos = queryClient.getQueryData<GitRepositoriesResponse>(
        queryKeys.git.repositories()
      )

      // Optimistically update to the new value
      queryClient.setQueryData<GitRepositoriesResponse>(
        queryKeys.git.repositories(),
        (old) => {
          if (!old) return old

          return {
            ...old,
            repositories: old.repositories.map((r) =>
              r.id === repo.id
                ? { ...r, sync_status: 'syncing', last_sync: new Date().toISOString() }
                : r
            ),
          }
        }
      )

      // Show immediate feedback toast
      toast({
        title: 'Syncing repository',
        description: `${repo.name} is being synced...`,
      })

      // Return context object with snapshotted value
      return { previousRepos }
    },

    // SUCCESS: Invalidate to get real data
    onSuccess: (_data, repo) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.git.repositories() })
      toast({
        title: 'Success',
        description: `${repo.name} synced successfully!`,
      })
    },

    // ERROR: Roll back to the previous state
    onError: (error: Error, repo, context) => {
      if (context?.previousRepos) {
        queryClient.setQueryData(
          queryKeys.git.repositories(),
          context.previousRepos
        )
      }

      toast({
        title: 'Sync failed',
        description: error.message || `Failed to sync ${repo.name}`,
        variant: 'destructive',
      })
    },

    // SETTLEMENT: Always refetch after error or success
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.git.repositories() })
    },
  })

  /**
   * Delete repository with optimistic UI removal
   *
   * Immediately removes repository from list, then rolls back if delete fails
   */
  const deleteRepositoryOptimistic = useMutation({
    mutationFn: async (id: number) => {
      return apiCall(`git-repositories/${id}`, { method: 'DELETE' })
    },

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.git.repositories() })

      const previousRepos = queryClient.getQueryData<GitRepositoriesResponse>(
        queryKeys.git.repositories()
      )

      // Optimistically remove from list
      queryClient.setQueryData<GitRepositoriesResponse>(
        queryKeys.git.repositories(),
        (old) => {
          if (!old) return old
          return {
            ...old,
            repositories: old.repositories.filter((r) => r.id !== id),
          }
        }
      )

      const deletedRepo = previousRepos?.repositories.find((r) => r.id === id)
      toast({
        title: 'Deleting repository',
        description: `Removing ${deletedRepo?.name || 'repository'}...`,
      })

      return { previousRepos }
    },

    onSuccess: (_data, _id, context) => {
      const deletedRepo = context?.previousRepos?.repositories.find((r) => r.id === _id)
      toast({
        title: 'Success',
        description: `${deletedRepo?.name || 'Repository'} deleted successfully!`,
      })
    },

    onError: (error: Error, _id, context) => {
      if (context?.previousRepos) {
        queryClient.setQueryData(
          queryKeys.git.repositories(),
          context.previousRepos
        )
      }

      toast({
        title: 'Delete failed',
        description: error.message || 'Failed to delete repository',
        variant: 'destructive',
      })
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.git.repositories() })
    },
  })

  /**
   * Toggle repository active status with optimistic update
   *
   * Immediately toggles is_active field, rolls back on error
   */
  const toggleRepositoryActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: number; is_active: boolean }) => {
      return apiCall(`git-repositories/${id}/toggle-active`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active }),
      })
    },

    onMutate: async ({ id, is_active }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.git.repositories() })

      const previousRepos = queryClient.getQueryData<GitRepositoriesResponse>(
        queryKeys.git.repositories()
      )

      // Optimistically toggle active status
      queryClient.setQueryData<GitRepositoriesResponse>(
        queryKeys.git.repositories(),
        (old) => {
          if (!old) return old
          return {
            ...old,
            repositories: old.repositories.map((r) =>
              r.id === id ? { ...r, is_active } : r
            ),
          }
        }
      )

      return { previousRepos }
    },

    onError: (error: Error, _variables, context) => {
      if (context?.previousRepos) {
        queryClient.setQueryData(
          queryKeys.git.repositories(),
          context.previousRepos
        )
      }

      toast({
        title: 'Update failed',
        description: error.message || 'Failed to update repository status',
        variant: 'destructive',
      })
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.git.repositories() })
    },
  })

  return {
    syncRepositoryOptimistic,
    deleteRepositoryOptimistic,
    toggleRepositoryActive,
  }
}

// Export types
export type { GitRepository, GitRepositoriesResponse }
