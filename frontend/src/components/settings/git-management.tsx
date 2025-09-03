'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Textarea } from '../ui/textarea'
import { Badge } from '../ui/badge'
import { Checkbox } from '../ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog'
import { Separator } from '../ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'
import { 
  GitBranch, 
  GitCommit, 
  Github, 
  RefreshCw, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Eye,
  TestTube,
  Download,
  AlertCircle,
  CheckCircle,
  Clock,
  ExternalLink,
  Settings,
  RotateCcw
} from 'lucide-react'
import { useApi } from '../../hooks/use-api'

interface GitRepository {
  id: number
  name: string
  category: string
  url: string
  branch: string
  credential_name?: string
  path?: string
  verify_ssl: boolean
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
  last_sync?: string
  sync_status?: string
}

interface GitCredential {
  name: string
  username: string
  type: string
}

interface GitStatus {
  repository_name: string
  repository_url: string
  repository_branch: string
  sync_status: string
  exists: boolean
  is_git_repo: boolean
  is_synced: boolean
  behind_count: number
  current_branch?: string
  modified_files?: string[]
  untracked_files?: string[]
  staged_files?: string[]
  commits?: Array<{
    hash: string
    message: string
    author: string
    date: string
  }>
  branches?: string[]
}

interface GitFormData {
  name: string
  category: string
  url: string
  branch: string
  credential_name: string
  path: string
  verify_ssl: boolean
  description: string
}

const GitManagement: React.FC = () => {
  const { apiCall } = useApi()
  
  // State
  const [repositories, setRepositories] = useState<GitRepository[]>([])
  const [filteredRepositories, setFilteredRepositories] = useState<GitRepository[]>([])
  const [credentials, setCredentials] = useState<GitCredential[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  
  // Form state
  const [formData, setFormData] = useState<GitFormData>({
    name: '',
    category: '',
    url: '',
    branch: 'main',
    credential_name: '__none__',
    path: '',
    verify_ssl: true,
    description: ''
  })
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [editingRepo, setEditingRepo] = useState<GitRepository | null>(null)
  const [editFormData, setEditFormData] = useState<GitFormData>({
    name: '',
    category: '',
    url: '',
    branch: 'main',
    credential_name: '',
    path: '',
    verify_ssl: true,
    description: ''
  })
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showStatusDialog, setShowStatusDialog] = useState(false)
  const [statusData, setStatusData] = useState<GitStatus | null>(null)

  // Load data on mount
  useEffect(() => {
    loadRepositories()
    loadCredentials()
  }, [])

  // Filter repositories when search or filters change
  useEffect(() => {
    filterRepositories()
  }, [repositories, searchTerm, filterCategory, filterStatus])

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  const loadRepositories = async () => {
    try {
      const response = await apiCall<{ repositories: GitRepository[] }>('git-repositories')
      setRepositories(response.repositories || [])
    } catch (error) {
      console.error('Error loading repositories:', error)
      showMessage('Failed to load repositories', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadCredentials = async () => {
    try {
      const response = await apiCall<GitCredential[]>('credentials/?include_expired=false')
      // Filter to token type only
      setCredentials((response || []).filter(c => c.type === 'token'))
    } catch (error) {
      console.error('Error loading credentials:', error)
      // Don't show an error message for credentials - it's optional
      // Some installations might not have credentials set up yet
      setCredentials([])
    }
  }

  const filterRepositories = () => {
    const filtered = repositories.filter(repo => {
      const matchesSearch = repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           repo.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (repo.description && repo.description.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchesCategory = !filterCategory || filterCategory === '__all__' || repo.category === filterCategory
      const matchesStatus = !filterStatus || filterStatus === '__all__' ||
                           (filterStatus === 'active' && repo.is_active) ||
                           (filterStatus === 'inactive' && !repo.is_active)
      
      return matchesSearch && matchesCategory && matchesStatus
    })
    
    setFilteredRepositories(filtered)
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.category || !formData.url) {
      showMessage('Please fill in required fields', 'error')
      return
    }

    setIsSubmitting(true)
    try {
      await apiCall('git-repositories', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          credential_name: formData.credential_name === '__none__' ? null : formData.credential_name || null
        })
      })

      showMessage('Repository added successfully!', 'success')
      resetForm()
      loadRepositories()
    } catch (error) {
      showMessage('Failed to add repository', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      url: '',
      branch: 'main',
      credential_name: '__none__',
      path: '',
      verify_ssl: true,
      description: ''
    })
    setConnectionStatus(null)
  }

  const testConnection = async () => {
    if (!formData.url) {
      showMessage('Please enter a repository URL first', 'error')
      return
    }

    setIsTestingConnection(true)
    setConnectionStatus(null)

    try {
      const response = await apiCall<{ success: boolean; message: string }>('git-repositories/test', {
        method: 'POST',
        body: JSON.stringify({
          url: formData.url,
          branch: formData.branch || 'main',
          credential_name: formData.credential_name === '__none__' ? null : formData.credential_name || null,
          verify_ssl: formData.verify_ssl
        })
      })

      setConnectionStatus({
        type: response.success ? 'success' : 'error',
        text: response.message
      })
    } catch (error) {
      setConnectionStatus({
        type: 'error',
        text: 'Connection test failed'
      })
    } finally {
      setIsTestingConnection(false)
    }
  }

  const editRepository = (repo: GitRepository) => {
    setEditingRepo(repo)
    setEditFormData({
      name: repo.name,
      category: repo.category,
      url: repo.url,
      branch: repo.branch,
      credential_name: repo.credential_name || '__none__',
      path: repo.path || '',
      verify_ssl: repo.verify_ssl,
      description: repo.description || ''
    })
    setShowEditDialog(true)
  }

  const saveRepositoryEdit = async () => {
    if (!editingRepo) return

    setIsSubmitting(true)
    try {
      await apiCall(`git-repositories/${editingRepo.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...editFormData,
          credential_name: editFormData.credential_name === '__none__' ? null : editFormData.credential_name || null,
          is_active: editingRepo.is_active
        })
      })

      showMessage('Repository updated successfully!', 'success')
      setShowEditDialog(false)
      setEditingRepo(null)
      loadRepositories()
    } catch (error) {
      console.error('Error updating repository:', error)
      showMessage('Failed to update repository', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const deleteRepository = async (repo: GitRepository) => {
    if (!confirm(`Are you sure you want to delete "${repo.name}"?`)) {
      return
    }

    try {
      await apiCall(`git-repositories/${repo.id}`, { method: 'DELETE' })
      showMessage('Repository deleted successfully!', 'success')
      loadRepositories()
    } catch (error) {
      showMessage('Failed to delete repository', 'error')
    }
  }

  const syncRepository = async (repo: GitRepository) => {
    try {
      await apiCall(`git-repositories/${repo.id}/sync`, { method: 'POST' })
      showMessage('Repository synced successfully!', 'success')
      loadRepositories()
    } catch (error) {
      showMessage('Failed to sync repository', 'error')
    }
  }

  const removeAndSyncRepository = async (repo: GitRepository) => {
    if (!confirm(`Are you sure you want to remove and re-clone "${repo.name}"? This will permanently delete the local copy and create a fresh clone.`)) {
      return
    }

    try {
      await apiCall(`git-repositories/${repo.id}/remove-and-sync`, { method: 'POST' })
      showMessage('Repository removed and re-cloned successfully!', 'success')
      loadRepositories()
    } catch (error) {
      showMessage('Failed to remove and sync repository', 'error')
    }
  }

  const showRepositoryStatus = async (repo: GitRepository) => {
    try {
      setStatusData(null)
      setShowStatusDialog(true)
      
      const response = await apiCall<{ success: boolean; data: GitStatus }>(`git-repositories/${repo.id}/status`)
      if (response.success) {
        setStatusData(response.data)
      } else {
        throw new Error('Failed to load repository status')
      }
    } catch (error) {
      showMessage('Failed to load repository status', 'error')
      setShowStatusDialog(false)
    }
  }

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case 'configs': return 'bg-blue-100 text-blue-800 hover:bg-blue-200'
      case 'templates': return 'bg-purple-100 text-purple-800 hover:bg-purple-200'
      case 'onboarding': return 'bg-green-100 text-green-800 hover:bg-green-200'
      default: return 'bg-gray-100 text-gray-800 hover:bg-gray-200'
    }
  }

  const getStatusBadgeColor = (isActive: boolean) => {
    return isActive 
      ? 'bg-green-100 text-green-800 hover:bg-green-200'
      : 'bg-red-100 text-red-800 hover:bg-red-200'
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString()
  }

  const truncateUrl = (url: string) => {
    return url.length > 50 ? url.substring(0, 47) + '...' : url
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
          <Github className="h-6 w-6" />
          Git Repository Management
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage Git repositories for configurations, templates, and other resources
        </p>
      </div>

      {/* Status Message */}
      {message && (
        <div className={`p-4 rounded-md ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list" className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Repository List
          </TabsTrigger>
          <TabsTrigger value="add" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Repository
          </TabsTrigger>
        </TabsList>

        {/* Repository List Tab */}
        <TabsContent value="list" className="space-y-4">
          {/* Filters */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 pl-8 pr-4 -mx-6 -mt-6 mb-1">
              <CardTitle className="flex items-center gap-2 text-white text-sm font-semibold">
                <Search className="h-4 w-4" />
                Repository Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-1 pb-2">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-1.5">
                <div>
                  <Label htmlFor="search" className="text-xs font-medium text-gray-700 mb-0 block">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-1.5 top-1 h-2.5 w-2.5 text-gray-400" />
                    <Input
                      id="search"
                      placeholder="Search repositories..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-6 h-6 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="filter-category" className="text-xs font-medium text-gray-700 mb-0 block">Category</Label>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger id="filter-category" className="h-6 text-xs">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Categories</SelectItem>
                      <SelectItem value="configs">Configs</SelectItem>
                      <SelectItem value="templates">Templates</SelectItem>
                      <SelectItem value="onboarding">Onboarding</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="filter-status" className="text-xs font-medium text-gray-700 mb-0 block">Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger id="filter-status" className="h-6 text-xs">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-700 mb-0 block">Actions</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button onClick={loadRepositories} variant="outline" size="sm" className="h-6 px-1.5 text-xs w-full">
                          <RefreshCw className="h-2.5 w-2.5 mr-0.5" />
                          Refresh
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Reload repository list</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Repositories Table */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 pl-8 pr-4 -mx-6 -mt-6 mb-1">
              <CardTitle className="flex items-center gap-2 text-white text-sm font-semibold">
                <GitBranch className="h-4 w-4" />
                Managed Repositories ({filteredRepositories.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                  <p className="text-gray-500 mt-2">Loading repositories...</p>
                </div>
              ) : filteredRepositories.length === 0 ? (
                <div className="text-center py-8">
                  <Github className="h-12 w-12 mx-auto text-gray-400" />
                  <p className="text-gray-500 mt-2">No repositories found</p>
                  <p className="text-sm text-gray-400">Add a repository to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredRepositories.map((repo) => (
                    <div key={repo.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            <h3 className="font-medium text-gray-900">{repo.name}</h3>
                            <Badge className={getCategoryBadgeColor(repo.category)}>
                              {repo.category}
                            </Badge>
                            <Badge className={getStatusBadgeColor(repo.is_active)}>
                              {repo.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <ExternalLink className="h-4 w-4" />
                              <a 
                                href={repo.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="hover:text-blue-600 underline"
                              >
                                {truncateUrl(repo.url)}
                              </a>
                            </div>
                            <div className="flex items-center gap-1">
                              <GitBranch className="h-4 w-4" />
                              {repo.branch}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              Last sync: {formatDate(repo.last_sync)}
                            </div>
                          </div>
                          {repo.description && (
                            <p className="text-sm text-gray-600">{repo.description}</p>
                          )}
                        </div>
                        <TooltipProvider>
                          <div className="flex items-center gap-2 ml-4">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  onClick={() => editRepository(repo)}
                                  variant="outline"
                                  size="sm"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Edit repository settings</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  onClick={() => syncRepository(repo)}
                                  variant="outline"
                                  size="sm"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Sync repository (pull latest changes)</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  onClick={() => removeAndSyncRepository(repo)}
                                  variant="outline"
                                  size="sm"
                                  className="text-orange-600 hover:text-orange-700"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Remove and re-clone repository</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  onClick={() => showRepositoryStatus(repo)}
                                  variant="outline"
                                  size="sm"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>View repository status and details</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  onClick={() => deleteRepository(repo)}
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Delete repository</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Add Repository Tab */}
        <TabsContent value="add" className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-3 pl-8 pr-6 -mx-6 -mt-6 mb-6">
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <Plus className="h-4 w-4" />
                Add New Git Repository
              </CardTitle>
              <CardDescription className="text-blue-50 text-sm">
                Configure a new Git repository for configurations, templates, or other resources
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleFormSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-semibold text-gray-800">Repository Name *</Label>
                    <Input
                      id="name"
                      placeholder="My Config Repository"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="border-2 border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
                      required
                    />
                    <p className="text-xs text-gray-600">Unique name to identify this repository</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-sm font-semibold text-gray-800">Category *</Label>
                    <Select 
                      value={formData.category} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger id="category" className="border-2 border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200">
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="configs">Configs</SelectItem>
                        <SelectItem value="templates">Templates</SelectItem>
                        <SelectItem value="onboarding">Onboarding</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-600">Purpose of this repository</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="url" className="text-sm font-semibold text-gray-800">Repository URL *</Label>
                    <Input
                      id="url"
                      type="url"
                      placeholder="https://github.com/username/repo.git"
                      value={formData.url}
                      onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                      className="border-2 border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
                      required
                    />
                    <p className="text-xs text-gray-600">Git repository URL</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="branch" className="text-sm font-semibold text-gray-800">Default Branch</Label>
                    <Input
                      id="branch"
                      placeholder="main"
                      value={formData.branch}
                      onChange={(e) => setFormData(prev => ({ ...prev, branch: e.target.value }))}
                      className="border-2 border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
                    />
                    <p className="text-xs text-gray-600">Default branch to use</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="credential" className="text-sm font-semibold text-gray-800">Credential</Label>
                  <Select 
                    value={formData.credential_name} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, credential_name: value }))}
                  >
                    <SelectTrigger id="credential" className="border-2 border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200">
                      <SelectValue placeholder="No credential (public repo)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No credential (public repo)</SelectItem>
                      {credentials.map((cred) => (
                        <SelectItem key={cred.name} value={cred.name}>
                          {cred.name} ({cred.username})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-600">Select a stored token credential to use for this repository</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="path" className="text-sm font-semibold text-gray-800">Path</Label>
                    <Input
                      id="path"
                      placeholder="configs/"
                      value={formData.path}
                      onChange={(e) => setFormData(prev => ({ ...prev, path: e.target.value }))}
                      className="border-2 border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
                    />
                    <p className="text-xs text-gray-600">Path within repository (leave empty for root)</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 pt-6">
                      <Checkbox
                        id="verify-ssl"
                        checked={formData.verify_ssl}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, verify_ssl: !!checked }))}
                        className="border-2 border-gray-400 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      />
                      <Label htmlFor="verify-ssl" className="text-sm font-semibold text-gray-800">Verify SSL certificates</Label>
                    </div>
                    <p className="text-xs text-gray-600">Disable for self-signed certificates</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-semibold text-gray-800">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Optional description for this repository"
                    rows={3}
                    value={formData.description}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="border-2 border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 resize-none"
                  />
                </div>

                <Separator />

                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">Test Connection</h4>
                  <p className="text-sm text-blue-700 mb-3">
                    Verify that the repository can be accessed with the provided settings.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            onClick={testConnection}
                            variant="outline"
                            disabled={isTestingConnection || !formData.url}
                            className="border-blue-300 text-blue-600 hover:bg-blue-50"
                          >
                            {isTestingConnection ? (
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <TestTube className="h-4 w-4 mr-2" />
                            )}
                            Test Connection
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Verify repository access with current settings</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    {connectionStatus && (
                      <div className={`flex items-center gap-2 text-sm ${
                        connectionStatus.type === 'success' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {connectionStatus.type === 'success' ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <AlertCircle className="h-4 w-4" />
                        )}
                        {connectionStatus.text}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex gap-4">
                    <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700">
                      {isSubmitting ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Add Repository
                    </Button>
                    <Button type="button" onClick={resetForm} variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50">
                      Reset Form
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Repository Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Git Repository</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Repository Name</Label>
                <Input
                  id="edit-name"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-category">Category</Label>
                <Select 
                  value={editFormData.category} 
                  onValueChange={(value) => setEditFormData(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger id="edit-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="configs">Configs</SelectItem>
                    <SelectItem value="templates">Templates</SelectItem>
                    <SelectItem value="onboarding">Onboarding</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="edit-url">Repository URL</Label>
                <Input
                  id="edit-url"
                  type="url"
                  value={editFormData.url}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, url: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-branch">Default Branch</Label>
                <Input
                  id="edit-branch"
                  value={editFormData.branch}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, branch: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-credential">Credential</Label>
              <Select 
                value={editFormData.credential_name} 
                onValueChange={(value) => setEditFormData(prev => ({ ...prev, credential_name: value }))}
              >
                <SelectTrigger id="edit-credential">
                  <SelectValue placeholder="No credential (public repo)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No credential (public repo)</SelectItem>
                  {credentials.map((cred) => (
                    <SelectItem key={cred.name} value={cred.name}>
                      {cred.name} ({cred.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="edit-path">Path</Label>
                <Input
                  id="edit-path"
                  value={editFormData.path}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, path: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2 pt-6">
                  <Checkbox
                    id="edit-verify-ssl"
                    checked={editFormData.verify_ssl}
                    onCheckedChange={(checked) => setEditFormData(prev => ({ ...prev, verify_ssl: !!checked }))}
                  />
                  <Label htmlFor="edit-verify-ssl">Verify SSL certificates</Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                rows={3}
                value={editFormData.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-4">
              <Button onClick={() => setShowEditDialog(false)} variant="outline">
                Cancel
              </Button>
              <Button onClick={saveRepositoryEdit} disabled={isSubmitting} className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700">
                {isSubmitting ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Settings className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Repository Status Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCommit className="h-5 w-5" />
              Git Repository Status
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {!statusData ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                <p className="text-gray-500 mt-2">Loading repository status...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Repository Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <AlertCircle className="h-5 w-5" />
                        Repository Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="font-medium">Name:</span>
                        <span>{statusData.repository_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Branch:</span>
                        <Badge variant="outline">{statusData.current_branch || statusData.repository_branch}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Status:</span>
                        <div className={`flex items-center gap-2 ${
                          statusData.is_synced ? 'text-green-600' : 'text-yellow-600'
                        }`}>
                          {statusData.is_synced ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <AlertCircle className="h-4 w-4" />
                          )}
                          {statusData.is_synced ? 'Clean working directory' : 'Modified files present'}
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">URL:</span>
                        <a 
                          href={statusData.repository_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="h-4 w-4" />
                          View Repository
                        </a>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <GitBranch className="h-5 w-5" />
                        Available Branches
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {statusData.branches && statusData.branches.length > 0 ? (
                        <div className="space-y-2">
                          {statusData.branches.map((branch) => (
                            <div key={branch} className={`flex items-center gap-2 ${
                              branch === statusData.current_branch ? 'text-blue-600 font-medium' : ''
                            }`}>
                              <GitBranch className="h-4 w-4" />
                              {branch}
                              {branch === statusData.current_branch && (
                                <Badge variant="outline" className="text-xs">current</Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500">No branches available</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Working Directory Changes */}
                {(!statusData.is_synced && (statusData.modified_files?.length || statusData.untracked_files?.length || statusData.staged_files?.length)) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Edit className="h-5 w-5" />
                        Working Directory Changes
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {statusData.modified_files && statusData.modified_files.length > 0 && (
                        <div>
                          <h6 className="font-medium text-yellow-600 mb-2">Modified Files:</h6>
                          <div className="space-y-1">
                            {statusData.modified_files.map((file) => (
                              <div key={file} className="flex items-center gap-2 text-sm">
                                <Edit className="h-4 w-4 text-yellow-500" />
                                {file}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {statusData.untracked_files && statusData.untracked_files.length > 0 && (
                        <div>
                          <h6 className="font-medium text-blue-600 mb-2">Untracked Files:</h6>
                          <div className="space-y-1">
                            {statusData.untracked_files.map((file) => (
                              <div key={file} className="flex items-center gap-2 text-sm">
                                <Plus className="h-4 w-4 text-blue-500" />
                                {file}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {statusData.staged_files && statusData.staged_files.length > 0 && (
                        <div>
                          <h6 className="font-medium text-green-600 mb-2">Staged Files:</h6>
                          <div className="space-y-1">
                            {statusData.staged_files.map((file) => (
                              <div key={file} className="flex items-center gap-2 text-sm">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                {file}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Recent Commits */}
                {statusData.commits && statusData.commits.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <GitCommit className="h-5 w-5" />
                        Recent Commits
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {statusData.commits.slice(0, 10).map((commit) => (
                          <div key={commit.hash} className="border-l-2 border-gray-200 pl-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono text-xs">
                                  {commit.hash.substring(0, 8)}
                                </Badge>
                                <span className="text-sm text-gray-600">{commit.author}</span>
                              </div>
                              <span className="text-sm text-gray-500">
                                {new Date(commit.date).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm mt-1">{commit.message}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default GitManagement
