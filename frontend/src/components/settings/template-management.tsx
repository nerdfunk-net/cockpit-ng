'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useApi } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
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
  RotateCcw
} from 'lucide-react'

interface Template {
  id: number
  name: string
  source: 'git' | 'file' | 'webeditor'
  template_type: string
  category: string
  description: string
  updated_at: string
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
  git_repo_url?: string
  git_branch?: string
  git_path?: string
  git_username?: string
  git_token?: string
  filename?: string
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
  
  // Form state
  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    source: '',
    template_type: 'jinja2',
    category: '__none__',
    description: '',
    content: '',
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

  useEffect(() => {
    loadTemplates()
    loadCategories()
  }, [])

  const loadTemplates = async () => {
    setLoadingState('loading')
    try {
      const response = await apiCall<{ templates: Template[] }>('templates')
      setTemplates(response.templates || [])
      setLoadingState('success')
    } catch (error) {
      console.error('Error loading templates:', error)
      setLoadingState('error')
      showMessage('Failed to load templates', 'error')
    }
  }

  const loadCategories = async () => {
    try {
      const response = await apiCall<string[]>('templates/categories')
      setCategories(response || [])
    } catch (error) {
      console.error('Error loading categories:', error)
    }
  }

  const showMessage = (msg: string, type: 'success' | 'error') => {
    setMessage(msg)
    setTimeout(() => setMessage(''), 5000)
  }

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
      git_repo_url: '',
      git_branch: 'main',
      git_path: '',
      git_username: '',
      git_token: ''
    })
    setSelectedFile(null)
    setEditingTemplate(null)
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
      const templateData: any = {
        name: formData.name,
        source: formData.source,
        template_type: formData.template_type,
        category: formData.category === '__none__' ? '' : formData.category,
        description: formData.description
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

  const handleCreateTemplate = async () => {
    if (!formData.name || !formData.source) {
      showMessage('Please fill in required fields', 'error')
      return
    }

    setIsCreating(true)
    try {
      const templateData: any = {
        name: formData.name,
        source: formData.source,
        template_type: formData.template_type,
        category: formData.category === '__none__' ? '' : formData.category,
        description: formData.description
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
        previewWindow.document.write(`
          <html>
            <head>
              <title>Template Preview</title>
              <style>
                body { font-family: monospace; margin: 20px; background: #f5f5f5; }
                pre { background: white; padding: 20px; border-radius: 8px; overflow: auto; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                h2 { color: #333; margin-bottom: 20px; }
              </style>
            </head>
            <body>
              <h2>Template Preview</h2>
              <pre>${response.content}</pre>
            </body>
          </html>
        `)
      }
    } catch (error) {
      console.error('Error viewing template:', error)
      showMessage('Failed to load template content', 'error')
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
              {/* Filters */}
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

              {/* Templates Table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Updated</th>
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
                          return (
                            <tr key={template.id} className="hover:bg-gray-50">
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
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {new Date(template.updated_at).toLocaleDateString()}
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
          <Card>
            <CardHeader>
              <CardTitle>
                {editingTemplate ? `Edit Template: ${editingTemplate.name}` : 'Create New Template'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="template-name">
                    Template Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="template-name"
                    placeholder="e.g., cisco-ios-base"
                    value={formData.name}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-source">
                    Source <span className="text-red-500">*</span>
                  </Label>
                  <Select value={formData.source} onValueChange={(value: any) => handleFormChange('source', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="git">Git Repository</SelectItem>
                      <SelectItem value="file">File Upload</SelectItem>
                      <SelectItem value="webeditor">Web Editor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="template-type">Template Type</Label>
                  <Select value={formData.template_type} onValueChange={(value) => handleFormChange('template_type', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="jinja2">Jinja2</SelectItem>
                      <SelectItem value="text">Plain Text</SelectItem>
                      <SelectItem value="textfsm">TextFSM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-category">Category</Label>
                  <Select value={formData.category} onValueChange={(value) => handleFormChange('category', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No Category</SelectItem>
                      {categories.map(category => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                      <SelectItem value="inventory">Inventory</SelectItem>
                      <SelectItem value="parser">Parser</SelectItem>
                      <SelectItem value="onboarding">Onboarding</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-description">Description</Label>
                  <Input
                    id="template-description"
                    placeholder="Brief description"
                    value={formData.description}
                    onChange={(e) => handleFormChange('description', e.target.value)}
                  />
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
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Branch</Label>
                        <Input
                          placeholder="main"
                          value={formData.git_branch}
                          onChange={(e) => handleFormChange('git_branch', e.target.value)}
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
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Username (if private)</Label>
                        <Input
                          value={formData.git_username}
                          onChange={(e) => handleFormChange('git_username', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Personal Access Token (if private)</Label>
                      <Input
                        type="password"
                        value={formData.git_token}
                        onChange={(e) => handleFormChange('git_token', e.target.value)}
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
                        className="w-full h-64 p-3 border border-gray-300 rounded-md font-mono text-sm"
                        placeholder="Enter your template content here..."
                        value={formData.content}
                        onChange={(e) => handleFormChange('content', e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-6 border-t">
                <Button
                  variant="outline"
                  onClick={resetForm}
                  className="flex items-center space-x-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>{editingTemplate ? 'Cancel Edit' : 'Reset'}</span>
                </Button>
                <Button
                  onClick={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
                  disabled={isCreating || !formData.name || !formData.source}
                  className="flex items-center space-x-2"
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Import Templates Tab */}
        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bulk Import Templates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Download className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium mb-2">Import Feature Coming Soon</h3>
                <p>Bulk import functionality will be available in the next update.</p>
              </div>
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
    </div>
  )
}
