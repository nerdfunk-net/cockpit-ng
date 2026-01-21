import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { CacheSettings, CacheActionResponse } from '../types'
import { useMemo } from 'react'

export function useCacheMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Save settings
  const saveSettings = useMutation({
    mutationFn: async (settings: CacheSettings) => {
      const response = await apiCall<CacheActionResponse>('settings/cache', {
        method: 'PUT',
        body: JSON.stringify(settings)
      })
      if (!response?.success) {
        throw new Error(response?.message || 'Failed to save settings')
      }
      return response
    },
    onSuccess: () => {
      // Invalidate settings to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.cache.settings() })
      toast({
        title: 'Success',
        description: 'Cache settings saved successfully',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to save settings: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Clear cache
  const clearCache = useMutation({
    mutationFn: async (namespace?: string) => {
      const body = namespace ? { namespace } : {}
      const response = await apiCall<CacheActionResponse>('cache/clear', {
        method: 'POST',
        body: JSON.stringify(body)
      })
      if (!response?.success) {
        throw new Error(response?.message || 'Failed to clear cache')
      }
      return response
    },
    onSuccess: (data) => {
      // Invalidate all cache queries
      queryClient.invalidateQueries({ queryKey: queryKeys.cache.stats() })
      queryClient.invalidateQueries({ queryKey: queryKeys.cache.entries() })
      toast({
        title: 'Success',
        description: data.message || 'Cache cleared successfully',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to clear cache: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Cleanup expired entries
  const cleanupExpired = useMutation({
    mutationFn: async (_?: void) => {
      const response = await apiCall<CacheActionResponse>('cache/cleanup', {
        method: 'POST'
      })
      if (!response?.success) {
        throw new Error(response?.message || 'Failed to cleanup expired entries')
      }
      return response
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cache.stats() })
      queryClient.invalidateQueries({ queryKey: queryKeys.cache.entries() })
      toast({
        title: 'Success',
        description: data.message || `Removed ${data.removed_count || 0} expired entries`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to cleanup: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Memoize return object to prevent re-renders
  return useMemo(() => ({
    saveSettings,
    clearCache,
    cleanupExpired,
  }), [saveSettings, clearCache, cleanupExpired])
}
