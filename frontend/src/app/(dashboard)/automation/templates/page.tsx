'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useApi } from '@/hooks/use-api'
import { useAuthStore } from '@/lib/auth-store'
import { FileCode, Plus, Edit, Trash2, Eye, Search, RefreshCw, User, Calendar, Globe, Lock } from 'lucide-react'

interface Template {
  id: number
  name: string
  description: string
  content: string
  scope: 'global' | 'private'
  created_by?: string
  category: string
  template_type: string
  source: string
  updated_at: string
}

function UserTemplatesContent() {
  const { apiCall } = useApi()
  const user = useAuthStore((state) => state.user)
  const username = user?.username
  const permissions = typeof user?.permissions === 'number' ? user.permissions : 0
  const isAdmin = (permissions & 16) !== 0 // Check admin permission bit

  // State
  const [templates, setTemplates] = useState<Template[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('list')
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [message, setMessage] = useState('')
  const [viewingTemplate, setViewingTemplate] = useState<Template | null>(null)
  const [showViewDialog, setShowViewDialog] = useState(false)

  // Form state - Default scope based on admin status
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    content: '',
    scope: (isAdmin ? 'global' : 'private') as 'global' | 'private'
  })

  useEffect(() => {
    loadTemplates()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const response = await apiCall<{ templates: Template[] }>('templates?category=netmiko')
      setTemplates(response.templates || [])
    } catch (error) {
      console.error('Error loading templates:', error)
      showMessage('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  const showMessage = (msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), 5000)
  }

  const handleFormChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      content: '',
      scope: isAdmin ? 'global' : 'private'
    })
    setEditingTemplate(null)
  }

  const handleCreateTemplate = async () => {
    if (!formData.name.trim() || !formData.content.trim()) {
      showMessage('Please fill in name and content')
      return
    }

    try {
      const templateData = {
        name: formData.name,
        source: 'webeditor',
        template_type: 'jinja2',
        category: 'netmiko',
        description: formData.description,
        content: formData.content,
        scope: formData.scope
      }

      await apiCall('templates', {
        method: 'POST',
        body: templateData
      })

      showMessage('Template created successfully!')
      resetForm()
      setActiveTab('list')
      await loadTemplates()
    } catch (error) {
      console.error('Error creating template:', error)
      showMessage('Failed to create template: ' + (error as Error).message)
    }
  }

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return

    try {
      await apiCall(`templates/${editingTemplate.id}`, {
        method: 'PUT',
        body: {
          name: formData.name,
          description: formData.description,
          content: formData.content,
          scope: formData.scope
        }
      })

      showMessage('Template updated successfully!')
      resetForm()
      setActiveTab('list')
      await loadTemplates()
    } catch (error) {
      console.error('Error updating template:', error)
      showMessage('Failed to update template: ' + (error as Error).message)
    }
  }

  const handleEditTemplate = async (template: Template) => {
    try {
      // Load full template content
      const response = await apiCall<Template>(`templates/${template.id}`)

      setFormData({
        name: response.name,
        description: response.description || '',
        content: response.content || '',
        scope: response.scope || 'global'
      })

      setEditingTemplate(template)
      setActiveTab('create')
    } catch (error) {
      console.error('Error loading template:', error)
      showMessage('Failed to load template for editing')
    }
  }

  const handleDeleteTemplate = async (templateId: number) => {
    if (!confirm('Are you sure you want to delete this template?')) return

    try {
      await apiCall(`templates/${templateId}`, {
        method: 'DELETE'
      })

      showMessage('Template deleted successfully!')
      await loadTemplates()
    } catch (error) {
      console.error('Error deleting template:', error)
      showMessage('Failed to delete template: ' + (error as Error).message)
    }
  }

  const handleViewTemplate = async (templateId: number) => {
    try {
      const response = await apiCall<Template>(`templates/${templateId}`)
      setViewingTemplate(response)
      setShowViewDialog(true)
    } catch (error) {
      console.error('Error viewing template:', error)
      showMessage('Failed to view template')
    }
  }

  // Check if user can edit a template (only their own templates)
  const canEditTemplate = (template: Template): boolean => {
    console.log('canEditTemplate check:', {
      templateName: template.name,
      createdBy: template.created_by,
      currentUsername: username,
      canEdit: template.created_by === username
    })
    return template.created_by === username
  }

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <FileCode className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Netmiko Templates</h1>
            <p className="text-gray-600">Create and manage your Jinja2 templates for network automation</p>
          </div>
        </div>
      </div>

      {/* Status Message */}
      {message && (
        <div className={`p-4 rounded-lg border ${
          message.includes('success')
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message}
        </div>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="list">
            <FileCode className="h-4 w-4 mr-2" />
            My Templates
          </TabsTrigger>
          <TabsTrigger value="create">
            <Plus className="h-4 w-4 mr-2" />
            {editingTemplate ? 'Edit Template' : 'Create Template'}
          </TabsTrigger>
        </TabsList>

        {/* List Tab */}
        <TabsContent value="list" className="space-y-4">
          <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
            <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
              <div className="flex items-center space-x-2">
                <FileCode className="h-4 w-4" />
                <span className="text-sm font-medium">Templates</span>
              </div>
            </div>
            <div className="p-6 bg-gradient-to-b from-white to-gray-50">
              {/* Search */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search templates..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Templates List */}
              <div className="space-y-3">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
                    <span className="ml-2 text-gray-600">Loading templates...</span>
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No templates found. Create your first template!
                  </div>
                ) : (
                  filteredTemplates.map(template => (
                    <Card key={template.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-lg">{template.name}</h3>
                              <Badge variant={template.scope === 'global' ? 'default' : 'outline'}>
                                {template.scope}
                              </Badge>
                            </div>
                            {template.description && (
                              <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                            )}
                            <p className="text-xs text-gray-500">
                              Updated: {new Date(template.updated_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewTemplate(template.id)}
                              title="View"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {canEditTemplate(template) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditTemplate(template)}
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {canEditTemplate(template) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteTemplate(template.id)}
                                title="Delete"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Create/Edit Tab */}
        <TabsContent value="create" className="space-y-4">
          <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
            <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
              <div className="flex items-center space-x-2">
                {editingTemplate ? <Edit className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                <span className="text-sm font-medium">
                  {editingTemplate ? 'Edit Template' : 'Create Template'}
                </span>
              </div>
            </div>
            <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., interface-configuration"
                  value={formData.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="Brief description of this template"
                  value={formData.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
                />
              </div>

              {/* Template Content */}
              <div className="space-y-2">
                <Label htmlFor="content">Template Content (Jinja2) *</Label>
                <Textarea
                  id="content"
                  placeholder="Enter your Jinja2 template here...&#10;&#10;Example:&#10;interface {{ user_variables.interface_name }}&#10; description {{ nautobot.name }}"
                  value={formData.content}
                  onChange={(e) => handleFormChange('content', e.target.value)}
                  rows={15}
                  className="font-mono text-sm border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
                />
                <p className="text-xs text-gray-500">
                  Use <code className="bg-gray-100 px-1 rounded">{'{{ user_variables.var_name }}'}</code> for user variables
                  and <code className="bg-gray-100 px-1 rounded">{'{{ nautobot.field }}'}</code> for device data
                </p>
              </div>

              {/* Scope - Only show for admin users */}
              {isAdmin && (
                <div className="flex items-center space-x-2 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                  <Checkbox
                    id="scope"
                    checked={formData.scope === 'global'}
                    onCheckedChange={(checked) => handleFormChange('scope', checked ? 'global' : 'private')}
                  />
                  <div className="flex-1">
                    <label htmlFor="scope" className="text-sm font-medium cursor-pointer text-blue-900">
                      Make this template global
                    </label>
                    <p className="text-xs text-blue-700 mt-1">
                      Global templates are visible to all users. Uncheck to keep it private (visible only to you).
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    resetForm()
                    setActiveTab('list')
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {editingTemplate ? 'Update Template' : 'Create Template'}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* View Template Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <FileCode className="h-6 w-6 text-blue-600" />
              {viewingTemplate?.name}
            </DialogTitle>
            <DialogDescription>
              Template details and content
            </DialogDescription>
          </DialogHeader>

          {viewingTemplate && (
            <div className="space-y-4">
              {/* Metadata Section - Compact */}
              <div className="grid grid-cols-4 gap-3">
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border text-sm">
                  {viewingTemplate.scope === 'global' ? (
                    <>
                      <Globe className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      <Badge variant="default" className="text-xs">Global</Badge>
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 text-purple-600 flex-shrink-0" />
                      <Badge variant="outline" className="text-xs">Private</Badge>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border text-sm">
                  <User className="h-4 w-4 text-gray-600 flex-shrink-0" />
                  <span className="text-gray-700 truncate">{viewingTemplate.created_by || 'Unknown'}</span>
                </div>

                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border text-sm">
                  <Calendar className="h-4 w-4 text-gray-600 flex-shrink-0" />
                  <span className="text-gray-700 truncate">
                    {new Date(viewingTemplate.updated_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border text-sm">
                  <FileCode className="h-4 w-4 text-gray-600 flex-shrink-0" />
                  <span className="text-gray-700 truncate">{viewingTemplate.template_type}</span>
                </div>
              </div>

              {/* Description - Compact */}
              {viewingTemplate.description && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-gray-700">{viewingTemplate.description}</p>
                </div>
              )}

              {/* Template Content - Larger */}
              <Card className="flex-1">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 py-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileCode className="h-4 w-4" />
                    Template Content
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="bg-gray-900 rounded-lg p-4 overflow-auto max-h-[500px]">
                    <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                      {viewingTemplate.content}
                    </pre>
                  </div>
                  <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-xs text-blue-800">
                      <strong>Tip:</strong> Use{' '}
                      <code className="bg-blue-100 px-1 rounded">{'{{ user_variables.var_name }}'}</code> for
                      custom variables and{' '}
                      <code className="bg-blue-100 px-1 rounded">{'{{ nautobot.field }}'}</code> for device data
                      from Nautobot.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                {canEditTemplate(viewingTemplate) && (
                  <Button
                    onClick={() => {
                      setShowViewDialog(false)
                      handleEditTemplate(viewingTemplate)
                    }}
                    variant="outline"
                    className="gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Edit Template
                  </Button>
                )}
                <Button onClick={() => setShowViewDialog(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function UserTemplatesPage() {
  return <UserTemplatesContent />
}
