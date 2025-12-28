import { useState, useEffect } from 'react'
import { useApi } from '@/hooks/use-api'
import type { Template } from '../types'

export function useTemplateManager() {
  const { apiCall } = useApi()
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('none')
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [editedTemplateContent, setEditedTemplateContent] = useState<string>('')
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)

  const loadTemplates = async () => {
    try {
      // Try lowercase first (standard)
      const response = await apiCall<{ templates: Template[]; total: number }>('templates?category=netmiko')
      console.log('Loaded templates with category=netmiko:', response.templates)

      // If no templates found, try with capital N (in case user created it manually)
      if (!response.templates || response.templates.length === 0) {
        const responseCapital = await apiCall<{ templates: Template[]; total: number }>('templates?category=Netmiko')
        console.log('Loaded templates with category=Netmiko:', responseCapital.templates)
        setTemplates(responseCapital.templates || [])
      } else {
        setTemplates(response.templates || [])
      }
    } catch (error) {
      console.error('Error loading templates:', error)
      setTemplates([])
    }
  }

  useEffect(() => {
    loadTemplates()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleTemplateChange = async (templateId: string) => {
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
  }

  const handleSaveTemplate = async () => {
    if (!selectedTemplate || selectedTemplate.scope !== 'private') {
      return
    }

    setIsSavingTemplate(true)
    try {
      await apiCall(`templates/${selectedTemplate.id}`, {
        method: 'PUT',
        body: {
          content: editedTemplateContent
        }
      })

      // Update the local template list
      setTemplates(templates.map(t =>
        t.id === selectedTemplate.id ? { ...t, content: editedTemplateContent } : t
      ))
      setSelectedTemplate({ ...selectedTemplate, content: editedTemplateContent })

      alert('Template saved successfully!')
    } catch (error) {
      console.error('Error saving template:', error)
      alert('Failed to save template')
    } finally {
      setIsSavingTemplate(false)
    }
  }

  return {
    templates,
    selectedTemplateId,
    selectedTemplate,
    editedTemplateContent,
    isSavingTemplate,
    setEditedTemplateContent,
    handleTemplateChange,
    handleSaveTemplate,
  }
}
