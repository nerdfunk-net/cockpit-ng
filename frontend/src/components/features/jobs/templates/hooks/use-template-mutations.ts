import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { JobTemplate } from '../types'
import { useMemo } from 'react'

// Type for creating/updating job templates (excludes auto-generated fields)
type JobTemplatePayload = Omit<JobTemplate, 'id' | 'created_at' | 'updated_at' | 'user_id' | 'created_by'>

export function useTemplateMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Create template
  const createTemplate = useMutation({
    mutationFn: async (data: JobTemplatePayload) => {
      return apiCall<JobTemplate>('/api/job-templates', {
        method: 'POST',
        body: JSON.stringify(data)
      })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.templates() })
      toast({
        title: 'Template Created',
        description: `Job template "${data.name}" has been created successfully.`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Creation Failed',
        description: error.message || 'Failed to create template.',
        variant: 'destructive'
      })
    }
  })

  // Update template
  const updateTemplate = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<JobTemplatePayload> }) => {
      return apiCall<JobTemplate>(`/api/job-templates/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.templates() })
      toast({
        title: 'Template Updated',
        description: `Job template "${data.name}" has been updated successfully.`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update template.',
        variant: 'destructive'
      })
    }
  })

  // Delete template
  const deleteTemplate = useMutation({
    mutationFn: async (id: number) => {
      return apiCall(`/api/job-templates/${id}`, {
        method: 'DELETE'
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.templates() })
      toast({
        title: 'Template Deleted',
        description: 'Job template has been deleted successfully.',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete template.',
        variant: 'destructive'
      })
    }
  })

  // Copy template
  const copyTemplate = useMutation({
    mutationFn: async (template: JobTemplate) => {
      const copyPayload = {
        name: `copy_of_${template.name}`,
        job_type: template.job_type,
        description: template.description || undefined,
        config_repository_id: template.config_repository_id || undefined,
        inventory_source: template.inventory_source,
        inventory_name: template.inventory_name || undefined,
        command_template_name: template.command_template_name || undefined,
        backup_running_config_path: template.backup_running_config_path || undefined,
        backup_startup_config_path: template.backup_startup_config_path || undefined,
        write_timestamp_to_custom_field: template.write_timestamp_to_custom_field,
        timestamp_custom_field_name: template.timestamp_custom_field_name || undefined,
        parallel_tasks: template.parallel_tasks || 1,
        activate_changes_after_sync: template.activate_changes_after_sync,
        scan_resolve_dns: template.scan_resolve_dns,
        scan_ping_count: template.scan_ping_count,
        scan_timeout_ms: template.scan_timeout_ms,
        scan_retries: template.scan_retries,
        scan_interval_ms: template.scan_interval_ms,
        scan_custom_field_name: template.scan_custom_field_name || undefined,
        scan_custom_field_value: template.scan_custom_field_value || undefined,
        scan_response_custom_field_name: template.scan_response_custom_field_name || undefined,
        scan_max_ips: template.scan_max_ips,
        is_global: template.is_global
      }

      return apiCall<JobTemplate>('/api/job-templates', {
        method: 'POST',
        body: JSON.stringify(copyPayload)
      })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.templates() })
      toast({
        title: 'Template Copied',
        description: `Job template "${data.name}" has been created successfully.`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Copy Failed',
        description: error.message || 'Failed to copy template.',
        variant: 'destructive'
      })
    }
  })

  // Memoize return object to prevent re-renders
  return useMemo(() => ({
    createTemplate,
    updateTemplate,
    deleteTemplate,
    copyTemplate,
  }), [createTemplate, updateTemplate, deleteTemplate, copyTemplate])
}
