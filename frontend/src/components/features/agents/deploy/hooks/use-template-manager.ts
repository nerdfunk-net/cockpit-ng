import { useState, useEffect, useMemo, useCallback } from 'react'
import { useApi } from '@/hooks/use-api'

interface TemplateVariable {
  value: string
  type: 'custom' | 'inventory'
  metadata: Record<string, unknown>
}

interface Template {
  id: number
  name: string
  content: string
  category: string
  scope: 'global' | 'private'
  use_nautobot_context: boolean
  pass_snmp_mapping: boolean
  file_path: string | null
  inventory_id: number | null
  variables?: Record<string, TemplateVariable>
  created_at: string
  updated_at: string
}

interface TemplateListItem {
  id: number
  name: string
  content: string
  category: string
  scope: 'global' | 'private'
  use_nautobot_context: boolean
  created_at: string
  updated_at: string
}

const EMPTY_TEMPLATES: TemplateListItem[] = []

export function useTemplateManager(category: string = 'agent') {
  const { apiCall } = useApi()
  const [templates, setTemplates] = useState<TemplateListItem[]>(EMPTY_TEMPLATES)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('none')
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [editedTemplateContent, setEditedTemplateContent] = useState<string>('')
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false)

  const loadTemplates = useCallback(async () => {
    try {
      const response = await apiCall<{ templates: TemplateListItem[]; total: number }>(
        `templates?category=${category}`
      )
      setTemplates(response.templates || EMPTY_TEMPLATES)
    } catch (error) {
      console.error('Error loading templates:', error)
      setTemplates(EMPTY_TEMPLATES)
    }
  }, [apiCall, category])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  const handleTemplateChange = useCallback(async (templateId: string) => {
    setSelectedTemplateId(templateId)
    if (templateId === 'none') {
      setSelectedTemplate(null)
      setEditedTemplateContent('')
      return
    }

    // Fetch full template details including variables
    setIsLoadingTemplate(true)
    try {
      const template = await apiCall<Template>(`templates/${templateId}`)
      setSelectedTemplate(template)
      setEditedTemplateContent(template.content)
    } catch (error) {
      console.error('Error loading template details:', error)
      setSelectedTemplate(null)
      setEditedTemplateContent('')
    } finally {
      setIsLoadingTemplate(false)
    }
  }, [apiCall])

  const handleSaveTemplate = useCallback(async () => {
    if (!selectedTemplate || selectedTemplate.scope !== 'private') {
      return
    }

    setIsSavingTemplate(true)
    try {
      await apiCall(`templates/${selectedTemplate.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          content: editedTemplateContent
        })
      })

      // Update the local template
      setSelectedTemplate({ ...selectedTemplate, content: editedTemplateContent })
    } catch (error) {
      console.error('Error saving template:', error)
      throw error
    } finally {
      setIsSavingTemplate(false)
    }
  }, [selectedTemplate, editedTemplateContent, apiCall])

  return useMemo(() => ({
    templates,
    selectedTemplateId,
    selectedTemplate,
    editedTemplateContent,
    isSavingTemplate,
    isLoadingTemplate,
    setEditedTemplateContent,
    handleTemplateChange,
    handleSaveTemplate,
  }), [
    templates,
    selectedTemplateId,
    selectedTemplate,
    editedTemplateContent,
    isSavingTemplate,
    isLoadingTemplate,
    handleTemplateChange,
    handleSaveTemplate
  ])
}
