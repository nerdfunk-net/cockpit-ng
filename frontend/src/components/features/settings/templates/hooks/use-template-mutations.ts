import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import { useMemo } from 'react'
import type {
  TemplateFormData,
  TemplateImportResponse
} from '../types'
import { readFileContent } from '../utils/template-utils'

interface CreateTemplateInput {
  formData: TemplateFormData
  selectedFile?: File | null
}

interface UpdateTemplateInput {
  templateId: number
  formData: TemplateFormData
  selectedFile?: File | null
}

interface ImportTemplatesInput {
  filePaths: string[]
  overwriteExisting?: boolean
}

export function useTemplateMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Create template
  const createTemplate = useMutation({
    mutationFn: async ({ formData, selectedFile }: CreateTemplateInput) => {
      // If formData already has 'content' and 'source', use it as-is (from editor)
      if (formData.content !== undefined && formData.source) {
        const templateData = {
          ...formData,
          category: formData.category === '__none__' ? '' : formData.category,
        }
        return apiCall('templates', {
          method: 'POST',
          body: templateData
        })
      }

      // Otherwise, build templateData from formData (from old template form)
      const templateData: Record<string, unknown> = {
        name: formData.name,
        source: formData.source,
        template_type: formData.template_type,
        category: formData.category === '__none__' ? '' : formData.category,
        description: formData.description,
        scope: formData.scope,
        variables: formData.variables || {},
        use_nautobot_context: formData.use_nautobot_context || false
      }

      // Add source-specific data
      if (formData.source === 'git') {
        templateData.git_repo_url = formData.git_repo_url
        templateData.git_branch = formData.git_branch
        templateData.git_path = formData.git_path
        templateData.git_username = formData.git_username
        templateData.git_token = formData.git_token
      } else if (formData.source === 'webeditor') {
        templateData.content = formData.content
      } else if (formData.source === 'file' && selectedFile) {
        templateData.filename = selectedFile.name
        templateData.content = await readFileContent(selectedFile)
      }

      return apiCall('templates', {
        method: 'POST',
        body: templateData
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.list() })
      toast({
        title: 'Success',
        description: 'Template created successfully!',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to create template: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Update template
  const updateTemplate = useMutation({
    mutationFn: async ({ templateId, formData, selectedFile }: UpdateTemplateInput) => {
      // If formData already has 'content' and 'source', use it as-is (from editor)
      if (formData.content !== undefined && formData.source) {
        const templateData = {
          ...formData,
          category: formData.category === '__none__' ? '' : formData.category,
        }
        return apiCall(`templates/${templateId}`, {
          method: 'PUT',
          body: templateData
        })
      }

      // Otherwise, build templateData from formData (from old template form)
      const templateData: Record<string, unknown> = {
        name: formData.name,
        source: formData.source,
        template_type: formData.template_type,
        category: formData.category === '__none__' ? '' : formData.category,
        description: formData.description,
        scope: formData.scope,
        variables: formData.variables || {},
        use_nautobot_context: formData.use_nautobot_context || false
      }

      // Add source-specific data
      if (formData.source === 'git') {
        templateData.git_repo_url = formData.git_repo_url
        templateData.git_branch = formData.git_branch
        templateData.git_path = formData.git_path
        templateData.git_username = formData.git_username
        templateData.git_token = formData.git_token
      } else if (formData.source === 'webeditor') {
        templateData.content = formData.content
      } else if (formData.source === 'file') {
        if (selectedFile) {
          templateData.filename = selectedFile.name
          templateData.content = await readFileContent(selectedFile)
        } else if (formData.content) {
          // Keep existing content if no new file
          templateData.content = formData.content
        }
      }

      return apiCall(`templates/${templateId}`, {
        method: 'PUT',
        body: templateData
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.list() })
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.all })
      toast({
        title: 'Success',
        description: 'Template updated successfully!',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to update template: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Delete template
  const deleteTemplate = useMutation({
    mutationFn: async (templateId: number) => {
      return apiCall(`templates/${templateId}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.list() })
      toast({
        title: 'Success',
        description: 'Template deleted successfully!',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to delete template: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Bulk delete templates
  const bulkDeleteTemplates = useMutation({
    mutationFn: async (templateIds: number[]) => {
      const results = await Promise.allSettled(
        templateIds.map(id =>
          apiCall(`templates/${id}`, { method: 'DELETE' })
        )
      )

      const successCount = results.filter(r => r.status === 'fulfilled').length
      const errorCount = results.filter(r => r.status === 'rejected').length

      return { successCount, errorCount }
    },
    onSuccess: ({ successCount, errorCount }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.list() })
      if (successCount > 0) {
        toast({
          title: 'Success',
          description: `Successfully deleted ${successCount} template(s)`,
        })
      }
      if (errorCount > 0) {
        toast({
          title: 'Warning',
          description: `Failed to delete ${errorCount} template(s)`,
          variant: 'destructive'
        })
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to delete templates: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Sync git template
  const syncTemplate = useMutation({
    mutationFn: async (templateId: number) => {
      return apiCall('templates/sync', {
        method: 'POST',
        body: { template_id: templateId }
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.list() })
      toast({
        title: 'Success',
        description: 'Template synced successfully!',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to sync template: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Import templates from YAML
  const importTemplates = useMutation({
    mutationFn: async ({ filePaths, overwriteExisting = false }: ImportTemplatesInput) => {
      const response = await apiCall<TemplateImportResponse>('templates/import', {
        method: 'POST',
        body: {
          source_type: 'yaml_bulk',
          yaml_file_paths: filePaths,
          overwrite_existing: overwriteExisting
        }
      })
      return response
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.list() })

      const successCount = data.imported_templates?.length || 0
      const failedCount = data.failed_templates?.length || 0

      if (successCount > 0) {
        toast({
          title: 'Success',
          description: `Successfully imported ${successCount} template(s)`,
        })
      }
      if (failedCount > 0) {
        toast({
          title: 'Warning',
          description: `Failed to import ${failedCount} template(s)`,
          variant: 'destructive'
        })
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to import templates: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Memoize return object to prevent re-renders
  return useMemo(() => ({
    createTemplate,
    updateTemplate,
    deleteTemplate,
    bulkDeleteTemplates,
    syncTemplate,
    importTemplates,
  }), [
    createTemplate,
    updateTemplate,
    deleteTemplate,
    bulkDeleteTemplates,
    syncTemplate,
    importTemplates,
  ])
}
