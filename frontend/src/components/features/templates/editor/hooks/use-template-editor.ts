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
  useNautobotContext: z.boolean(),
  path: z.string(),
  netmikoMode: z.enum(['run_on_device', 'write_to_file', 'sync_to_nautobot']),
  testDeviceId: z.string().nullable(),
  testDeviceName: z.string(),
  preRunCommand: z.string(),
  credentialId: z.string(),
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
  useNautobotContext: true,
  path: '',
  netmikoMode: 'run_on_device',
  testDeviceId: null,
  testDeviceName: '',
  preRunCommand: '',
  credentialId: 'none',
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
        pass_snmp_mapping: boolean
        inventory_id: number | null
        variables: Record<string, string>
        pre_run_command: string | null
        credential_id: number | null
        execution_mode: string | null
        file_path: string | null
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
    variableManager.updateForCategory(watchedCategory, true) // Always include all variables initially
    // eslint-disable-next-line react-hooks/exhaustive-deps -- updateForCategory is stable from useCallback
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
        // Agent-specific fields
        inventoryId: templateData.inventory_id ?? null,
        passSnmpMapping: templateData.pass_snmp_mapping ?? true,
        useNautobotContext: templateData.use_nautobot_context ?? false,
        path: templateData.file_path || '',
        // Netmiko-specific fields
        netmikoMode: (templateData.execution_mode as EditorFormData['netmikoMode']) || 'run_on_device',
        testDeviceId: null,
        testDeviceName: '',
        preRunCommand: templateData.pre_run_command || '',
        credentialId: templateData.credential_id?.toString() || 'none',
      })

      // Restore saved custom variables
      if (templateData.variables && Object.keys(templateData.variables).length > 0) {
        variableManager.setCustomVariables(templateData.variables)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setCustomVariables is stable from useCallback
  }, [templateData, templateContent, form, variableManager.setCustomVariables])

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
