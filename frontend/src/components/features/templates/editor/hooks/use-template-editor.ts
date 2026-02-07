import { useCallback, useEffect, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useTemplateVariables } from './use-template-variables'
import type { EditorFormData } from '../types'

const editorFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  template_type: z.enum(['jinja2', 'text', 'textfsm']),
  category: z.string(),
  description: z.string(),
  scope: z.enum(['global', 'private']),
  content: z.string(),
  inventoryId: z.number().nullable(),
  passSnmpMapping: z.boolean(),
  path: z.string(),
})

const DEFAULT_VALUES: EditorFormData = {
  name: '',
  template_type: 'jinja2',
  category: '__none__',
  description: '',
  scope: 'global',
  content: '',
  inventoryId: null,
  passSnmpMapping: true,
  path: '',
}

export function useTemplateEditor() {
  const { apiCall } = useApi()
  const searchParams = useSearchParams()
  const templateId = searchParams.get('id') ? Number(searchParams.get('id')) : null
  const isEditMode = templateId !== null

  // Fetch existing template data when editing
  const { data: templateData, isLoading: isLoadingTemplate } = useQuery({
    queryKey: queryKeys.templates.detail(templateId!),
    queryFn: async () => {
      const response = await apiCall<{
        id: number
        name: string
        template_type: string
        category: string
        description: string
        scope: string
        use_nautobot_context: boolean
      }>(`templates/${templateId}`, { method: 'GET' })
      return response
    },
    enabled: isEditMode,
    staleTime: 60 * 1000,
  })

  // Fetch template content when editing
  const { data: templateContent, isLoading: isLoadingContent } = useQuery({
    queryKey: queryKeys.templates.content(templateId!),
    queryFn: async () => {
      const response = await apiCall<{ content: string }>(
        `templates/${templateId}/content`,
        { method: 'GET' }
      )
      return response.content || ''
    },
    enabled: isEditMode,
    staleTime: 60 * 1000,
  })

  const form = useForm<EditorFormData>({
    resolver: zodResolver(editorFormSchema),
    defaultValues: DEFAULT_VALUES,
  })

  const variableManager = useTemplateVariables(DEFAULT_VALUES.category)

  const watchedCategory = useWatch({ control: form.control, name: 'category' })

  // Update variables when category changes
  useEffect(() => {
    variableManager.updateForCategory(watchedCategory)
  }, [watchedCategory, variableManager.updateForCategory])

  // Populate form when template data loads (edit mode)
  useEffect(() => {
    if (templateData && templateContent !== undefined) {
      form.reset({
        name: templateData.name,
        template_type: (templateData.template_type as EditorFormData['template_type']) || 'jinja2',
        category: templateData.category || '__none__',
        description: templateData.description || '',
        scope: (templateData.scope as 'global' | 'private') || 'global',
        content: templateContent || '',
        inventoryId: null,
        passSnmpMapping: true,
        path: '',
      })
    }
  }, [templateData, templateContent, form])

  const setContent = useCallback(
    (content: string) => {
      form.setValue('content', content)
    },
    [form]
  )

  const isLoading = isEditMode && (isLoadingTemplate || isLoadingContent)

  return useMemo(
    () => ({
      form,
      templateId,
      isEditMode,
      isLoading,
      variableManager,
      watchedCategory,
      setContent,
    }),
    [form, templateId, isEditMode, isLoading, variableManager, watchedCategory, setContent]
  )
}
