import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import { useMemo } from 'react'
import type { TemplateRenderResponse } from '../types/templates'

/**
 * CRUD + render mutations for templates.
 * Automatically invalidates queryKeys.templates.list() after create/update/delete.
 */
export function useTemplatesMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const createTemplate = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return apiCall('templates', { method: 'POST', body: data })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.list() })
      toast({ title: 'Success', description: 'Template created successfully' })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create template',
        variant: 'destructive',
      })
    },
  })

  const updateTemplate = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      return apiCall(`templates/${id}`, { method: 'PUT', body: data })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.list() })
      toast({ title: 'Success', description: 'Template updated successfully' })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update template',
        variant: 'destructive',
      })
    },
  })

  const deleteTemplate = useMutation({
    mutationFn: async (id: number) => {
      return apiCall(`templates/${id}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.list() })
      toast({ title: 'Success', description: 'Template deleted successfully' })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete template',
        variant: 'destructive',
      })
    },
  })

  const renderTemplate = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return apiCall<TemplateRenderResponse>('templates/render', {
        method: 'POST',
        body: data,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Render Error',
        description: error.message || 'Failed to render template',
        variant: 'destructive',
      })
    },
  })

  return useMemo(() => ({
    createTemplate,
    updateTemplate,
    deleteTemplate,
    renderTemplate,
  }), [createTemplate, updateTemplate, deleteTemplate, renderTemplate])
}
