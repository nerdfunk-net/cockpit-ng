'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { useApi } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import { escapeHtml } from '@/lib/security'
import type { SavedInventory } from '@/hooks/queries/use-saved-inventories-queries'

// Template import response interface
interface TemplateImportResponse {
  success: boolean
  message: string
  imported_count?: number
  skipped_count?: number
  errors?: string[]
  imported_templates?: string[]
  failed_templates?: string[]
}
import {
  FileCode,
  Plus,
  Download,
  Search,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  RotateCcw as Sync,
  GitBranch,
  Upload,
  Code,
  Save,
  RotateCcw,
  CheckSquare,
  Square,
  AlertCircle,
  CheckCircle,
  Loader2,
  Play,
  FolderOpen
} from 'lucide-react'
import { LoadInventoryDialog } from '@/components/features/general/inventory/dialogs/load-inventory-dialog'

interface Template {
  id: number
  name: string
  source: 'git' | 'file' | 'webeditor'
  template_type: string
  category: string
  description: string
  updated_at: string
  created_by?: string
  scope: 'global' | 'private'
  variables?: Record<string, string>
  use_nautobot_context?: boolean
  git_repo_url?: string
  git_branch?: string
  git_path?: string
}

interface TemplateFormData {
  name: string
  source: 'git' | 'file' | 'webeditor' | ''
  template_type: string
  category: string
  description: string
  content?: string
  scope: 'global' | 'private'
  variables?: Record<string, string>
  use_nautobot_context?: boolean
  git_repo_url?: string
  git_branch?: string
  git_path?: string
  git_username?: string
  git_token?: string
  filename?: string
}

interface ImportableTemplate {
  name: string
  description: string
  category: string
  source: string
  file_path: string
  template_type: string
  selected?: boolean
}

type LoadingState = 'idle' | 'loading' | 'error' | 'success'

export default function TemplateManagement() {
  const { apiCall } = useApi()
  
  // State
  const [templates, setTemplates] = useState<Template[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loadingState, setLoadingState] = useState<LoadingState>('idle')
  const [message, setMessage] = useState('')
  
  // Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState('__all__')
  const [filterSource, setFilterSource] = useState('__all__')
  
  // Selection state for bulk operations
  const [selectedTemplates, setSelectedTemplates] = useState<Set<number>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Import state
  const [importableTemplates, setImportableTemplates] = useState<ImportableTemplate[]>([])
  const [importLoading, setImportLoading] = useState(false)
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 })
  const [importResults, setImportResults] = useState<{ success: string[], failed: string[] }>({ success: [], failed: [] })
  
  // Form state
  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    source: '',
    template_type: 'jinja2',
    category: '__none__',
    description: '',
    content: '',
    scope: 'global',
    variables: {},
    use_nautobot_context: false,
    git_repo_url: '',
    git_branch: 'main',
    git_path: '',
    git_username: '',
    git_token: ''
  })
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [activeTab, setActiveTab] = useState('list')
  const [showSourceChangeModal, setShowSourceChangeModal] = useState(false)

  // Inventory selection state for TIG-Stack templates
  const [selectedInventory, setSelectedInventory] = useState<{ id: number; name: string } | null>(null)
  const [showInventoryDialog, setShowInventoryDialog] = useState(false)
  const [inventories, setInventories] = useState<SavedInventory[]>([])
  const [isLoadingInventories, setIsLoadingInventories] = useState(false)
  const [isRendering, setIsRendering] = useState(false)

  const showMessage = useCallback((msg: string, _type: 'success' | 'error') => {
    setMessage(msg)
    setTimeout(() => setMessage(''), 5000)
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedTemplates(new Set())
    setEditingTemplate(null)
    setIsCreating(false)
    setFormData({
      name: '',
      source: '',
      template_type: 'jinja2',
      category: '__none__',
      description: '',
      content: '',
      scope: 'global',
      variables: {},
      use_nautobot_context: false,
      git_repo_url: '',
      git_branch: 'main',
      git_path: '',
      git_username: '',
      git_token: ''
    })
    setSelectedFile(null)
  }, [])

  const loadTemplates = useCallback(async () => {
    setLoadingState('loading')
    try {
      const response = await apiCall<{ templates: Template[] }>('templates')
      setTemplates(response.templates || [])
      setLoadingState('success')
      // Clear selection when templates are reloaded
      clearSelection()
    } catch (error) {
      console.error('Error loading templates:', error)
      setLoadingState('error')
      showMessage('Failed to load templates', 'error')
    }
  }, [apiCall, clearSelection, showMessage])

  const loadCategories = useCallback(async () => {
    try {
      const response = await apiCall<string[]>('templates/categories')
      setCategories(response || [])
    } catch (error) {
      console.error('Error loading categories:', error)
    }
  }, [apiCall])

  useEffect(() => {
    loadTemplates()
    loadCategories()
  }, [loadTemplates, loadCategories])

  const handleFormChange = (field: keyof TemplateFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const resetForm = () => {
    setFormData({
      name: '',
      source: '',
      template_type: 'jinja2',
      category: '__none__',
      description: '',
      content: '',
      scope: 'global',
      variables: {},
      use_nautobot_context: false,
      git_repo_url: '',
      git_branch: 'main',
      git_path: '',
      git_username: '',
      git_token: ''
    })
    setSelectedFile(null)
    setEditingTemplate(null)
  }

  // Selection helper functions
  const toggleTemplateSelection = (templateId: number) => {
    setSelectedTemplates(prev => {
      const newSet = new Set(prev)
      if (newSet.has(templateId)) {
        newSet.delete(templateId)
      } else {
        newSet.add(templateId)
      }
      return newSet
    })
  }

  const toggleSelectAllTemplates = () => {
    if (selectedTemplates.size === filteredTemplates.length) {
      setSelectedTemplates(new Set())
    } else {
      setSelectedTemplates(new Set(filteredTemplates.map(t => t.id)))
    }
  }

  const handleEditTemplate = async (template: Template) => {
    try {
      // Load template content for editing
      const response = await apiCall<{ content: string }>(`templates/${template.id}/content`)
      
      // Populate form with template data
      // For file-sourced templates, default to webeditor to enable editing
      const editSource = template.source === 'file' ? 'webeditor' : template.source
      
      setFormData({
        name: template.name,
        source: editSource,
        template_type: template.template_type,
        category: template.category || '__none__',
        description: template.description || '',
        content: response.content || '',
        scope: template.scope || 'global',
        variables: template.variables || {},
        use_nautobot_context: template.use_nautobot_context || false,
        git_repo_url: template.git_repo_url || '',
        git_branch: template.git_branch || 'main',
        git_path: template.git_path || '',
        git_username: '',
        git_token: ''
      })
      
      setEditingTemplate(template)
      setActiveTab('create') // Switch to create tab for editing
      
      // Show modal notification for source conversion
      if (template.source === 'file' && editSource === 'webeditor') {
        setShowSourceChangeModal(true)
        setTimeout(() => setShowSourceChangeModal(false), 2000)
        showMessage('Template loaded for editing', 'success')
      } else {
        showMessage('Template loaded for editing', 'success')
      }
    } catch (error) {
      console.error('Error loading template for edit:', error)
      showMessage('Failed to load template for editing', 'error')
    }
  }

  const handleUpdateTemplate = async () => {
    if (!editingTemplate || !formData.name || !formData.source) {
      showMessage('Please fill in required fields', 'error')
      return
    }

    setIsCreating(true)
    try {
      const templateData: {
        name: string;
        source: string;
        template_type: string;
        category: string;
        description: string;
        scope: string;
        variables?: Record<string, string>;
        use_nautobot_context?: boolean;
        git_repo_url?: string;
        git_branch?: string;
        git_path?: string;
        git_username?: string;
        git_token?: string;
        content?: string;
        filename?: string;
      } = {
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
      } else if (formData.source === 'file' && !selectedFile && formData.content) {
        // For file source without new file, keep existing content
        templateData.content = formData.content
      }

      await apiCall(`templates/${editingTemplate.id}`, {
        method: 'PUT',
        body: templateData
      })

      showMessage('Template updated successfully!', 'success')
      resetForm()
      setActiveTab('list')
      loadTemplates()
    } catch (error) {
      console.error('Error updating template:', error)
      showMessage('Failed to update template', 'error')
    } finally {
      setIsCreating(false)
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      // Auto-fill name from filename if empty
      if (!formData.name) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '')
        handleFormChange('name', nameWithoutExt)
      }
    }
  }

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.onerror = reject
      reader.readAsText(file)
    })
  }

  // Load inventories for TIG-Stack templates
  const loadInventories = useCallback(async () => {
    setIsLoadingInventories(true)
    try {
      const response = await apiCall<{ inventories: SavedInventory[] }>('inventory')
      setInventories(response.inventories || [])
    } catch (error) {
      console.error('Failed to load inventories:', error)
      showMessage('Failed to load inventories', 'error')
    } finally {
      setIsLoadingInventories(false)
    }
  }, [apiCall, showMessage])

  // Handle inventory selection
  const handleInventorySelected = useCallback((inventory: SavedInventory) => {
    setSelectedInventory({ id: inventory.id, name: inventory.name })
    setShowInventoryDialog(false)
    showMessage(`Inventory "${inventory.name}" selected`, 'success')
  }, [showMessage])

  // Handle inventory deletion
  const handleDeleteInventory = useCallback(async (inventoryId: number, inventoryName: string) => {
    try {
      await apiCall(`inventory/${inventoryId}`, { method: 'DELETE' })
      showMessage(`Inventory "${inventoryName}" deleted`, 'success')
      await loadInventories()
    } catch (error) {
      console.error('Failed to delete inventory:', error)
      showMessage('Failed to delete inventory', 'error')
    }
  }, [apiCall, showMessage, loadInventories])

  // Handle opening inventory dialog
  const handleSelectInventory = useCallback(() => {
    loadInventories()
    setShowInventoryDialog(true)
  }, [loadInventories])

  // Handle template rendering (dry run)
  const handleRenderTemplate = useCallback(async () => {
    if (!formData.name) {
      showMessage('Please provide a template name', 'error')
      return
    }

    // For TIG-Stack templates, require inventory selection
    if (formData.category === 'tig-stack' && !selectedInventory) {
      showMessage('Please select an inventory for TIG-Stack templates', 'error')
      return
    }

    setIsRendering(true)
    try {
      // TODO: Call backend API to render template
      // For now, just show a placeholder message
      showMessage('Template rendering will be implemented in backend', 'success')
      console.log('Rendering template:', {
        name: formData.name,
        category: formData.category,
        template_type: formData.template_type,
        inventory: selectedInventory
      })
    } catch (error) {
      console.error('Failed to render template:', error)
      showMessage('Failed to render template', 'error')
    } finally {
      setIsRendering(false)
    }
  }, [formData, selectedInventory, showMessage])

  const handleCreateTemplate = async () => {
    if (!formData.name || !formData.source) {
      showMessage('Please fill in required fields', 'error')
      return
    }

    setIsCreating(true)
    try {
      const templateData: {
        name: string;
        source: string;
        template_type: string;
        category: string;
        description: string;
        scope: string;
        variables?: Record<string, string>;
        use_nautobot_context?: boolean;
        git_repo_url?: string;
        git_branch?: string;
        git_path?: string;
        git_username?: string;
        git_token?: string;
        content?: string;
        filename?: string;
      } = {
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

      await apiCall('templates', {
        method: 'POST',
        body: templateData
      })

      showMessage('Template created successfully!', 'success')
      resetForm()
      loadTemplates()
    } catch (error) {
      console.error('Error creating template:', error)
      showMessage('Failed to create template', 'error')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteTemplate = async (templateId: number) => {
    if (!confirm('Are you sure you want to delete this template?')) return

    try {
      await apiCall(`templates/${templateId}`, { method: 'DELETE' })
      showMessage('Template deleted successfully!', 'success')
      loadTemplates()
    } catch (error) {
      console.error('Error deleting template:', error)
      showMessage('Failed to delete template', 'error')
    }
  }

  const handleBulkDeleteTemplates = async () => {
    if (selectedTemplates.size === 0) {
      showMessage('Please select templates to delete', 'error')
      return
    }

    const templateNames = filteredTemplates
      .filter(t => selectedTemplates.has(t.id))
      .map(t => t.name)
      .join(', ')

    if (!confirm(`Are you sure you want to delete ${selectedTemplates.size} template(s)?\n\nTemplates: ${templateNames}`)) {
      return
    }

    setIsDeleting(true)
    let successCount = 0
    let errorCount = 0

    for (const templateId of selectedTemplates) {
      try {
        await apiCall(`templates/${templateId}`, { method: 'DELETE' })
        successCount++
      } catch (error) {
        console.error(`Error deleting template ${templateId}:`, error)
        errorCount++
      }
    }

    if (successCount > 0) {
      showMessage(`Successfully deleted ${successCount} template(s)`, 'success')
    }
    if (errorCount > 0) {
      showMessage(`Failed to delete ${errorCount} template(s)`, 'error')
    }

    clearSelection()
    setIsDeleting(false)
    loadTemplates()
  }

  const handleSyncTemplate = async (templateId: number) => {
    try {
      await apiCall('templates/sync', {
        method: 'POST',
        body: { template_id: templateId }
      })
      showMessage('Template synced successfully!', 'success')
      loadTemplates()
    } catch (error) {
      console.error('Error syncing template:', error)
      showMessage('Failed to sync template', 'error')
    }
  }

  const handleViewTemplate = async (templateId: number) => {
    try {
      const response = await apiCall<{ content: string }>(`templates/${templateId}/content`)
      
      // Open in new window for preview
      const previewWindow = window.open('', '_blank', 'width=800,height=600')
      if (previewWindow) {
        // Escape HTML content to prevent XSS attacks
        const safeContent = escapeHtml(response.content)

        previewWindow.document.write(`
          <html>
            <head>
              <title>Template Preview</title>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body { font-family: monospace; margin: 20px; background: #f5f5f5; }
                pre { background: white; padding: 20px; border-radius: 8px; overflow: auto; box-shadow: 0 2px 4px rgba(0,0,0,0.1); white-space: pre-wrap; word-wrap: break-word; }
                h2 { color: #333; margin-bottom: 20px; }
              </style>
            </head>
            <body>
              <h2>Template Preview (Read-Only)</h2>
              <pre>${safeContent}</pre>
            </body>
          </html>
        `)
        previewWindow.document.close()
      }
    } catch (error) {
      console.error('Error viewing template:', error)
      showMessage('Failed to load template content', 'error')
    }
  }

  // Import functionality
  const scanImportDirectory = async () => {
    setImportLoading(true)
    try {
      const response = await apiCall<{ templates: ImportableTemplate[] }>('templates/scan-import')
      const templatesWithSelection = response.templates.map(template => ({
        ...template,
        selected: true // Default to selected
      }))
      setImportableTemplates(templatesWithSelection)
      setImportResults({ success: [], failed: [] })
      showMessage(`Found ${templatesWithSelection.length} importable templates`, 'success')
    } catch (error) {
      console.error('Error scanning import directory:', error)
      showMessage('Failed to scan import directory', 'error')
      setImportableTemplates([])
    } finally {
      setImportLoading(false)
    }
  }

  const toggleImportableTemplateSelection = (filePath: string) => {
    setImportableTemplates(prev => 
      prev.map(template => 
        template.file_path === filePath 
          ? { ...template, selected: !template.selected }
          : template
      )
    )
  }

  const toggleSelectAll = () => {
    const allSelected = importableTemplates.every(t => t.selected)
    setImportableTemplates(prev => 
      prev.map(template => ({ ...template, selected: !allSelected }))
    )
  }

  const importSelectedTemplates = async () => {
    const selectedTemplates = importableTemplates.filter(t => t.selected)
    if (selectedTemplates.length === 0) {
      showMessage('Please select at least one template to import', 'error')
      return
    }

    setImportLoading(true)
    setImportProgress({ current: 0, total: selectedTemplates.length })
    
    try {
      // Use yaml_bulk import for YAML files
      const response = await apiCall<TemplateImportResponse>('templates/import', {
        method: 'POST',
        body: { 
          source_type: 'yaml_bulk',
          yaml_file_paths: selectedTemplates.map(t => t.file_path),
          overwrite_existing: false
        }
      })
      
      setImportResults({ 
        success: response.imported_templates || [], 
        failed: response.failed_templates || [] 
      })
      
      if (response.imported_templates && response.imported_templates.length > 0) {
        showMessage(`Successfully imported ${response.imported_templates.length} templates`, 'success')
        loadTemplates() // Refresh the templates list
      }
      
      if (response.failed_templates && response.failed_templates.length > 0) {
        showMessage(`Failed to import ${response.failed_templates.length} templates`, 'error')
      }
      
    } catch (error) {
      console.error('Error importing templates:', error)
      showMessage('Failed to import templates', 'error')
    } finally {
      setImportLoading(false)
    }
  }

  const getSourceBadgeVariant = (source: string) => {
    switch (source) {
      case 'git': return 'default'
      case 'file': return 'secondary'
      case 'webeditor': return 'outline'
      default: return 'secondary'
    }
  }

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'git': return GitBranch
      case 'file': return Upload
      case 'webeditor': return Code
      default: return FileCode
    }
  }

  // Filter templates
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = !filterCategory || filterCategory === '__all__' || template.category === filterCategory
    const matchesSource = !filterSource || filterSource === '__all__' || template.source === filterSource
    
    return matchesSearch && matchesCategory && matchesSource
  })

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <FileCode className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Template Management</h1>
            <p className="text-gray-600">Manage configuration templates for network devices</p>
          </div>
        </div>
      </div>

      {/* Status Message */}
      {message && (
        <div className={cn(
          "p-4 rounded-lg border",
          message.includes('success') 
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-red-50 border-red-200 text-red-800"
        )}>
          {message}
        </div>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="list" className="flex items-center space-x-2">
            <FileCode className="h-4 w-4" />
            <span>Templates List</span>
          </TabsTrigger>
          <TabsTrigger value="create" className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Create Template</span>
          </TabsTrigger>
          <TabsTrigger value="import" className="flex items-center space-x-2">
            <Download className="h-4 w-4" />
            <span>Import Templates</span>
          </TabsTrigger>
        </TabsList>

        {/* Templates List Tab */}
        <TabsContent value="list" className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-3 pl-8 pr-6 -mx-6 -mt-6 mb-6">
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <FileCode className="h-4 w-4" />
                Templates List
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters and Bulk Actions */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search templates..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Categories</SelectItem>
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterSource} onValueChange={setFilterSource}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Sources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Sources</SelectItem>
                    <SelectItem value="git">Git Repository</SelectItem>
                    <SelectItem value="file">File Upload</SelectItem>
                    <SelectItem value="webeditor">Web Editor</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  onClick={loadTemplates}
                  disabled={loadingState === 'loading'}
                  className="flex items-center space-x-2"
                >
                  <RefreshCw className={cn("h-4 w-4", loadingState === 'loading' && "animate-spin")} />
                  <span>Refresh</span>
                </Button>
              </div>

              {/* Bulk Actions */}
              {selectedTemplates.size > 0 && (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center space-x-4">
                    <span className="text-sm font-medium text-blue-900">
                      {selectedTemplates.size} template(s) selected
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearSelection}
                      className="text-blue-700 border-blue-300 hover:bg-blue-100"
                    >
                      Clear Selection
                    </Button>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDeleteTemplates}
                    disabled={isDeleting}
                    className="flex items-center space-x-2"
                  >
                    {isDeleting ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    <span>{isDeleting ? 'Deleting...' : 'Delete Selected'}</span>
                  </Button>
                </div>
              )}

              {/* Templates Table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={toggleSelectAllTemplates}
                              className="flex items-center justify-center w-4 h-4"
                              disabled={filteredTemplates.length === 0}
                            >
                              {selectedTemplates.size === filteredTemplates.length && filteredTemplates.length > 0 ? (
                                <CheckSquare className="h-4 w-4 text-blue-600" />
                              ) : selectedTemplates.size > 0 ? (
                                <Square className="h-4 w-4 text-blue-600 bg-blue-100" />
                              ) : (
                                <Square className="h-4 w-4 text-gray-400" />
                              )}
                            </button>
                          </div>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {loadingState === 'loading' ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-4 text-center">
                            <RefreshCw className="h-5 w-5 animate-spin mx-auto" />
                            <span className="ml-2">Loading templates...</span>
                          </td>
                        </tr>
                      ) : filteredTemplates.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                            No templates found
                          </td>
                        </tr>
                      ) : (
                        filteredTemplates.map((template) => {
                          const SourceIcon = getSourceIcon(template.source)
                          const isSelected = selectedTemplates.has(template.id)
                          return (
                            <tr 
                              key={template.id} 
                              className={cn(
                                "hover:bg-gray-50 transition-colors",
                                isSelected && "bg-blue-50"
                              )}
                            >
                              <td className="px-4 py-4">
                                <button
                                  onClick={() => toggleTemplateSelection(template.id)}
                                  className="flex items-center justify-center w-4 h-4"
                                >
                                  {isSelected ? (
                                    <CheckSquare className="h-4 w-4 text-blue-600" />
                                  ) : (
                                    <Square className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                                  )}
                                </button>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="font-medium text-gray-900">{template.name}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <Badge variant={getSourceBadgeVariant(template.source)} className="flex items-center space-x-1 w-fit">
                                  <SourceIcon className="h-3 w-3" />
                                  <span>{template.source}</span>
                                </Badge>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {template.template_type}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {template.category || '-'}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                                {template.description || '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center space-x-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleViewTemplate(template.id)}
                                    title="View Template"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEditTemplate(template)}
                                    title="Edit Template"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  {template.source === 'git' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleSyncTemplate(template.id)}
                                      title="Sync from Git"
                                    >
                                      <Sync className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDeleteTemplate(template.id)}
                                    title="Delete Template"
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Create Template Tab */}
        <TabsContent value="create" className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-3 pl-8 pr-6 -mx-6 -mt-6 mb-6">
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <Plus className="h-4 w-4" />
                {editingTemplate ? `Edit Template: ${editingTemplate.name}` : 'Create New Template'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="template-name">
                    Template Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="template-name"
                    placeholder="e.g., cisco-ios-base"
                    value={formData.name}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                    className="border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500 shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="template-type">Template Type</Label>
                  <Select value={formData.template_type} onValueChange={(value) => handleFormChange('template_type', value)}>
                    <SelectTrigger className="h-8 text-sm border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="jinja2">Jinja2</SelectItem>
                      <SelectItem value="text">Plain Text</SelectItem>
                      <SelectItem value="textfsm">TextFSM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="template-category">Category</Label>
                  <Select value={formData.category} onValueChange={(value) => handleFormChange('category', value)}>
                    <SelectTrigger className="h-8 text-sm border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
                      <SelectValue placeholder="Select category..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No Category</SelectItem>
                      {/* Canonical categories only to avoid duplicates from the API */}
                      {['ansible', 'onboarding', 'parser', 'netmiko', 'tig-stack'].map(cat => (
                        <SelectItem key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1).replace('-', ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="template-source">Source <span className="text-red-500">*</span></Label>
                  <Select value={formData.source} onValueChange={(value: string) => handleFormChange('source', value)}>
                    <SelectTrigger className="h-8 text-sm border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
                      <SelectValue placeholder="Select source..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="git">Git Repository</SelectItem>
                      <SelectItem value="file">File Upload</SelectItem>
                      <SelectItem value="webeditor">Web Editor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-3">
                  <Label htmlFor="template-description">Description</Label>
                  <Input
                    id="template-description"
                    placeholder="Brief description"
                    value={formData.description}
                    onChange={(e) => handleFormChange('description', e.target.value)}
                    className="border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500 shadow-sm"
                  />
                </div>
              </div>

              {/* Template Scope */}
              <div className="flex items-center space-x-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <Checkbox
                  id="template-scope"
                  checked={formData.scope === 'global'}
                  onCheckedChange={(checked) =>
                    handleFormChange('scope', checked ? 'global' : 'private')
                  }
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="template-scope"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    This template is global
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Global templates are visible to all users. Private templates are only visible to you.
                  </p>
                </div>
              </div>

              {/* Source-specific configurations */}
              {formData.source === 'git' && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2 text-blue-700">
                      <GitBranch className="h-5 w-5" />
                      <span>Git Repository Configuration</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Repository URL <span className="text-red-500">*</span></Label>
                        <Input
                          placeholder="https://github.com/user/repo.git"
                          value={formData.git_repo_url}
                          onChange={(e) => handleFormChange('git_repo_url', e.target.value)}
                          className="border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500 shadow-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Branch</Label>
                        <Input
                          placeholder="main"
                          value={formData.git_branch}
                          onChange={(e) => handleFormChange('git_branch', e.target.value)}
                          className="border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500 shadow-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>File Path</Label>
                        <Input
                          placeholder="templates/template.j2"
                          value={formData.git_path}
                          onChange={(e) => handleFormChange('git_path', e.target.value)}
                          className="border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500 shadow-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Username (if private)</Label>
                        <Input
                          value={formData.git_username}
                          onChange={(e) => handleFormChange('git_username', e.target.value)}
                          className="border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500 shadow-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Personal Access Token (if private)</Label>
                      <Input
                        type="password"
                        value={formData.git_token}
                        onChange={(e) => handleFormChange('git_token', e.target.value)}
                        className="border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500 shadow-sm"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {formData.source === 'file' && (
                <Card className="bg-green-50 border-green-200">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2 text-green-700">
                      <Upload className="h-5 w-5" />
                      <span>File Upload</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Label>Template File</Label>
                      <Input
                        type="file"
                        accept=".txt,.conf,.cfg,.j2,.jinja2,.textfsm"
                        onChange={handleFileChange}
                        className="border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500 shadow-sm"
                      />
                      {selectedFile && (
                        <p className="text-sm text-gray-600">
                          Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {formData.source === 'webeditor' && (
                <Card className="bg-yellow-50 border-yellow-200">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2 text-yellow-700">
                      <Code className="h-5 w-5" />
                      <span>Web Editor</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Label>Template Content <span className="text-red-500">*</span></Label>
                      <textarea
                        className="w-full h-64 p-3 border-2 bg-white border-gray-300 rounded-md font-mono text-sm focus:border-blue-500"
                        placeholder="Enter your template content here..."
                        value={formData.content}
                        onChange={(e) => handleFormChange('content', e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-6 border-t gap-3">
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={resetForm}
                    className="flex items-center space-x-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>{editingTemplate ? 'Cancel Edit' : 'Reset'}</span>
                  </Button>

                  {/* Select Inventory button - show only for TIG-Stack templates */}
                  {formData.category === 'tig-stack' && (
                    <Button
                      variant="outline"
                      onClick={handleSelectInventory}
                      className="flex items-center space-x-2 border-purple-300 text-purple-700 hover:bg-purple-50"
                    >
                      <FolderOpen className="h-4 w-4" />
                      <span>
                        {selectedInventory ? `Inventory: ${selectedInventory.name}` : 'Select Inventory'}
                      </span>
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {/* Render Template button - show only for Jinja2 templates */}
                  {formData.template_type === 'jinja2' && (
                    <Button
                      variant="outline"
                      onClick={handleRenderTemplate}
                      disabled={isRendering || !formData.name || (formData.category === 'tig-stack' && !selectedInventory)}
                      className="flex items-center space-x-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                    >
                      {isRendering && <RefreshCw className="h-4 w-4 animate-spin" />}
                      {!isRendering && <Play className="h-4 w-4" />}
                      <span>{isRendering ? 'Rendering...' : 'Render Template'}</span>
                    </Button>
                  )}

                  <Button
                    onClick={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
                    disabled={isCreating || !formData.name || !formData.source}
                    className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white"
                  >
                    {isCreating && <RefreshCw className="h-4 w-4 animate-spin" />}
                    <Save className="h-4 w-4" />
                    <span>
                      {isCreating
                        ? (editingTemplate ? 'Updating...' : 'Creating...')
                        : (editingTemplate ? 'Update Template' : 'Create Template')
                      }
                    </span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Import Templates Tab */}
        <TabsContent value="import" className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-3 pl-8 pr-6 -mx-6 -mt-6 mb-6">
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <Download className="h-4 w-4" />
                Import Templates from YAML Files
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Import Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-blue-900 mb-1">Template Import Instructions</h3>
                    <p className="text-blue-800 text-sm">
                      This feature scans the <code className="bg-blue-100 px-1 rounded">./contributing-data</code> directory 
                      for YAML files containing template definitions. Each YAML file should have properties like name, source, type, 
                      category, and description. Perfect for initial setup or bulk template imports.
                    </p>
                  </div>
                </div>
              </div>

              {/* Scan Button */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-1">Available Templates</h3>
                  <p className="text-gray-600 text-sm">
                    {importableTemplates.length > 0 
                      ? `Found ${importableTemplates.length} importable templates`
                      : 'Click "Scan Directory" to discover available templates'
                    }
                  </p>
                </div>
                <Button 
                  onClick={scanImportDirectory}
                  disabled={importLoading}
                  className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  {importLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  <span>Scan Directory</span>
                </Button>
              </div>

              {/* Import Progress */}
              {importLoading && importProgress.total > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <Loader2 className="h-5 w-5 text-yellow-600 animate-spin" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-yellow-900">
                          Importing Templates
                        </span>
                        <span className="text-sm text-yellow-700">
                          {importProgress.current} of {importProgress.total}
                        </span>
                      </div>
                      <div className="w-full bg-yellow-200 rounded-full h-2">
                        <div 
                          className="bg-yellow-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Import Results */}
              {(importResults.success.length > 0 || importResults.failed.length > 0) && (
                <div className="space-y-3">
                  {importResults.success.length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-green-900 mb-2">Successfully Imported ({importResults.success.length})</h4>
                          <div className="flex flex-wrap gap-2">
                            {importResults.success.map(name => (
                              <Badge key={name} variant="outline" className="bg-green-100 text-green-800 border-green-300">
                                {name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {importResults.failed.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-red-900 mb-2">Failed to Import ({importResults.failed.length})</h4>
                          <div className="flex flex-wrap gap-2">
                            {importResults.failed.map(name => (
                              <Badge key={name} variant="outline" className="bg-red-100 text-red-800 border-red-300">
                                {name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Templates Table */}
              {importableTemplates.length > 0 && (
                <div className="space-y-4">
                  {/* Selection Controls */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={toggleSelectAll}
                        className="flex items-center space-x-2"
                      >
                        {importableTemplates.every(t => t.selected) ? (
                          <CheckSquare className="h-4 w-4" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                        <span>
                          {importableTemplates.every(t => t.selected) ? 'Deselect All' : 'Select All'}
                        </span>
                      </Button>
                      <span className="text-sm text-gray-600">
                        {importableTemplates.filter(t => t.selected).length} of {importableTemplates.length} selected
                      </span>
                    </div>
                    <Button 
                      onClick={importSelectedTemplates}
                      disabled={importLoading || importableTemplates.filter(t => t.selected).length === 0}
                      className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white"
                    >
                      {importLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      <span>Import Selected Templates</span>
                    </Button>
                  </div>

                  {/* Templates Table */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left">
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={toggleSelectAll}
                                  className="flex items-center justify-center w-4 h-4"
                                >
                                  {importableTemplates.every(t => t.selected) ? (
                                    <CheckSquare className="h-4 w-4 text-blue-600" />
                                  ) : (
                                    <Square className="h-4 w-4 text-gray-400" />
                                  )}
                                </button>
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Select</span>
                              </div>
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {importableTemplates.map((template) => (
                            <tr 
                              key={template.file_path} 
                              className={cn(
                                "hover:bg-gray-50 transition-colors",
                                template.selected && "bg-blue-50"
                              )}
                            >
                              <td className="px-4 py-4">
                                <button
                                  onClick={() => toggleImportableTemplateSelection(template.file_path)}
                                  className="flex items-center justify-center w-4 h-4"
                                >
                                  {template.selected ? (
                                    <CheckSquare className="h-4 w-4 text-blue-600" />
                                  ) : (
                                    <Square className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                                  )}
                                </button>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="font-medium text-gray-900">{template.name}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <Badge variant={getSourceBadgeVariant(template.source)}>
                                  {template.source}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {template.template_type}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {template.category || '-'}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                                {template.description || '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {template.file_path}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!importLoading && importableTemplates.length === 0 && (
                <div className="text-center py-12">
                  <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Download className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Templates Found</h3>
                  <p className="text-gray-600 mb-4 max-w-md mx-auto">
                    No YAML template files were found in the import directory. Make sure template files are placed in 
                    <code className="bg-gray-100 px-1 rounded mx-1">./contributing-data</code> and click &quot;Scan Directory&quot;.
                  </p>
                  <Button 
                    onClick={scanImportDirectory}
                    variant="outline"
                    className="flex items-center space-x-2 border-green-600 text-green-600 hover:bg-green-600 hover:text-white"
                  >
                    <Search className="h-4 w-4" />
                    <span>Scan Directory</span>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Source Change Modal Notification */}
      {showSourceChangeModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-white border border-blue-200 shadow-lg rounded-lg p-6 max-w-md mx-4 pointer-events-auto animate-in fade-in-0 zoom-in-95 duration-200">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Code className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-900 mb-1">
                  Source Changed to Web Editor
                </h3>
                <p className="text-sm text-gray-600">
                  Template source changed from File Upload to Web Editor to enable content editing. 
                  You can now modify the template content directly below.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Selection Dialog for TIG-Stack Templates */}
      <LoadInventoryDialog
        show={showInventoryDialog}
        onClose={() => setShowInventoryDialog(false)}
        onLoad={handleInventorySelected}
        onDelete={handleDeleteInventory}
        inventories={inventories}
        isLoading={isLoadingInventories}
      />
    </div>
  )
}
