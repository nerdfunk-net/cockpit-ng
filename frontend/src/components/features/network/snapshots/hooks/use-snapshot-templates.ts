/**
 * Hook for managing snapshot command templates.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import type {
  SnapshotCommandTemplate,
  SnapshotCommandTemplateCreate,
} from '../types/snapshot-types'

const EMPTY_ARRAY: SnapshotCommandTemplate[] = []

export function useSnapshotTemplates() {
  const { apiCall } = useApi()
  const [templates, setTemplates] = useState<SnapshotCommandTemplate[]>(EMPTY_ARRAY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiCall<SnapshotCommandTemplate[]>(
        'network/snapshots/templates'
      )
      setTemplates(data || EMPTY_ARRAY)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load templates'
      setError(message)
      console.error('Error loading snapshot templates:', err)
      setTemplates(EMPTY_ARRAY)
    } finally {
      setLoading(false)
    }
  }, [apiCall])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  const createTemplate = useCallback(async (template: SnapshotCommandTemplateCreate) => {
    setLoading(true)
    setError(null)
    try {
      const created = await apiCall<SnapshotCommandTemplate>(
        'network/snapshots/templates',
        {
          method: 'POST',
          body: template,
        }
      )
      setTemplates(prev => [...prev, created])
      return created
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create template'
      setError(message)
      console.error('Error creating template:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [apiCall])

  const deleteTemplate = useCallback(async (templateId: number) => {
    setLoading(true)
    setError(null)
    try {
      await apiCall(`network/snapshots/templates/${templateId}`, {
        method: 'DELETE',
      })
      setTemplates(prev => prev.filter(t => t.id !== templateId))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete template'
      setError(message)
      console.error('Error deleting template:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [apiCall])

  return useMemo(() => ({
    templates,
    loading,
    error,
    loadTemplates,
    createTemplate,
    deleteTemplate,
  }), [templates, loading, error, loadTemplates, createTemplate, deleteTemplate])
}
