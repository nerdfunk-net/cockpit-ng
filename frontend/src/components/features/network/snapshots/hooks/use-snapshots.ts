/**
 * Hook for managing snapshot executions and comparisons.
 */

import { useState, useCallback, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import type {
  Snapshot,
  SnapshotListItem,
  SnapshotExecuteRequest,
  SnapshotCompareRequest,
  SnapshotCompareResponse,
} from '../types/snapshot-types'

const EMPTY_ARRAY: SnapshotListItem[] = []

export function useSnapshots() {
  const { apiCall } = useApi()
  const [snapshots, setSnapshots] = useState<SnapshotListItem[]>(EMPTY_ARRAY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSnapshots = useCallback(async (limit = 100) => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiCall<SnapshotListItem[]>(
        `network/snapshots?limit=${limit}`
      )
      setSnapshots(data || EMPTY_ARRAY)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load snapshots'
      setError(message)
      console.error('Error loading snapshots:', err)
      setSnapshots(EMPTY_ARRAY)
    } finally {
      setLoading(false)
    }
  }, [apiCall])

  const getSnapshot = useCallback(async (snapshotId: number) => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiCall<Snapshot>(`network/snapshots/${snapshotId}`)
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load snapshot'
      setError(message)
      console.error('Error loading snapshot:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [apiCall])

  const executeSnapshot = useCallback(async (request: SnapshotExecuteRequest) => {
    setLoading(true)
    setError(null)
    try {
      const result = await apiCall<Snapshot>('network/snapshots/execute', {
        method: 'POST',
        body: request,
      })
      // Reload snapshots list
      await loadSnapshots()
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to execute snapshot'
      setError(message)
      console.error('Error executing snapshot:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [apiCall, loadSnapshots])

  const compareSnapshots = useCallback(async (request: SnapshotCompareRequest) => {
    setLoading(true)
    setError(null)
    try {
      const result = await apiCall<SnapshotCompareResponse>(
        'network/snapshots/compare',
        {
          method: 'POST',
          body: request,
        }
      )
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to compare snapshots'
      setError(message)
      console.error('Error comparing snapshots:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [apiCall])

  const deleteSnapshotDbOnly = useCallback(async (snapshotId: number) => {
    setLoading(true)
    setError(null)
    try {
      await apiCall(`network/snapshots/${snapshotId}`, {
        method: 'DELETE',
      })
      // Reload snapshots list
      await loadSnapshots()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete snapshot'
      setError(message)
      console.error('Error deleting snapshot:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [apiCall, loadSnapshots])

  const deleteSnapshotWithFiles = useCallback(async (snapshotId: number) => {
    setLoading(true)
    setError(null)
    try {
      await apiCall(`network/snapshots/${snapshotId}/files`, {
        method: 'DELETE',
      })
      // Reload snapshots list
      await loadSnapshots()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete snapshot and files'
      setError(message)
      console.error('Error deleting snapshot and files:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [apiCall, loadSnapshots])

  return useMemo(() => ({
    snapshots,
    loading,
    error,
    loadSnapshots,
    getSnapshot,
    executeSnapshot,
    compareSnapshots,
    deleteSnapshotDbOnly,
    deleteSnapshotWithFiles,
  }), [
    snapshots,
    loading,
    error,
    loadSnapshots,
    getSnapshot,
    executeSnapshot,
    compareSnapshots,
    deleteSnapshotDbOnly,
    deleteSnapshotWithFiles,
  ])
}
