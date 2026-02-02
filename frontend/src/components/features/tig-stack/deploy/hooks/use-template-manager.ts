import { useState, useEffect, useMemo, useCallback } from 'react'
import { useApi } from '@/hooks/use-api'

interface Template {
  id: number
  name: string
  content: string
  category: string
  scope: 'global' | 'private'
  created_at: string
  updated_at: string
}

const EMPTY_TEMPLATES: Template[] = []

export function useTemplateManager(category: string = 'tig-stack') {
  const { apiCall } = useApi()
  const [templates, setTemplates] = useState<Template[]>(EMPTY_TEMPLATES)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('none')
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [editedTemplateContent, setEditedTemplateContent] = useState<string>('')
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)

  const loadTemplates = useCallback(async () => {
    try {
      const response = await apiCall<{ templates: Template[]; total: number }>(
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

    const template = templates.find(t => t.id.toString() === templateId)
    if (template) {
      setSelectedTemplate(template)
      setEditedTemplateContent(template.content)
    }
  }, [templates])

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

      // Update the local template list
      setTemplates(templates.map(t =>
        t.id === selectedTemplate.id ? { ...t, content: editedTemplateContent } : t
      ))
      setSelectedTemplate({ ...selectedTemplate, content: editedTemplateContent })
    } catch (error) {
      console.error('Error saving template:', error)
      throw error
    } finally {
      setIsSavingTemplate(false)
    }
  }, [selectedTemplate, editedTemplateContent, templates, apiCall])

  return useMemo(() => ({
    templates,
    selectedTemplateId,
    selectedTemplate,
    editedTemplateContent,
    isSavingTemplate,
    setEditedTemplateContent,
    handleTemplateChange,
    handleSaveTemplate,
  }), [
    templates,
    selectedTemplateId,
    selectedTemplate,
    editedTemplateContent,
    isSavingTemplate,
    handleTemplateChange,
    handleSaveTemplate
  ])
}
