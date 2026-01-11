'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  GitBranch,
  GitCommit,
  Github,
  RefreshCw,
  Plus,
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
  RotateCcw,
  Bug,
  Info,
  FileText,
  X,
  Upload
} from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { useGitRepositoriesQuery } from './hooks/use-git-repositories-query'
import { useGitMutations } from './hooks/use-git-mutations'

interface GitRepository {
  id: number
  name: string
  category: string
  url: string
  branch: string
  auth_type?: string
  credential_name?: string
  path?: string
  verify_ssl: boolean
  git_author_name?: string
  git_author_email?: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
  last_sync?: string
  sync_status?: string
}

interface GitCredential {
  id?: number
  name: string
  username: string
  type: string
  source?: string
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
    author: {
      name: string
      email: string
    }
    date: string
  }>
  branches?: string[]
}

interface GitFormData {
  name: string
  category: string
  url: string
  branch: string
  auth_type: string
  credential_name: string
  path: string
  verify_ssl: boolean
  git_author_name: string
  git_author_email: string
  description: string
}

interface DebugResult {
  success: boolean
  message?: string
  error?: string
  error_type?: string
  details?: Record<string, unknown>
  diagnostics?: {
    repository_info: Record<string, unknown>
    access_test: Record<string, unknown>
    file_system: Record<string, unknown>
    git_status: Record<string, unknown>
    ssl_info: Record<string, unknown>
    credentials: Record<string, unknown>
    push_capability?: {
      status: string
      message: string
      can_push: boolean
      has_credentials: boolean
      has_remote: boolean
    }
  }
}

const GitManagement: React.FC = () => {
  const { apiCall } = useApi()

  // TanStack Query hooks
  const { data: reposData, isLoading: loadingRepos, refetch: refetchRepositories } = useGitRepositoriesQuery()
  const {
    createRepository: createRepoMutation,
    updateRepository: updateRepoMutation,
    deleteRepository: deleteRepoMutation,
    syncRepository: syncRepoMutation,
    removeAndSyncRepository: removeAndSyncRepoMutation,
    testConnection: testConnectionMutation
  } = useGitMutations()

  // Extract repositories from query data
  const repositories = reposData?.repositories || []

  // State
  const [credentials, setCredentials] = useState<GitCredential[]>([])
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  
  // Form state
  const [formData, setFormData] = useState<GitFormData>({
    name: '',
    category: '',
    url: '',
    branch: 'main',
    auth_type: 'none',
    credential_name: '__none__',
    path: '',
    verify_ssl: true,
    git_author_name: '',
    git_author_email: '',
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
    auth_type: 'none',
    credential_name: '',
    path: '',
    verify_ssl: true,
    git_author_name: '',
    git_author_email: '',
    description: ''
  })
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showStatusDialog, setShowStatusDialog] = useState(false)
  const [statusData, setStatusData] = useState<GitStatus | null>(null)

  // Debug dialog state
  const [showDebugDialog, setShowDebugDialog] = useState(false)
  const [debugRepo, setDebugRepo] = useState<GitRepository | null>(null)
  const [debugTab, setDebugTab] = useState('diagnostics')
  const [debugLoading, setDebugLoading] = useState(false)
  const [debugResult, setDebugResult] = useState<DebugResult | null>(null)

  // Load credentials on mount (repositories loaded by TanStack Query)
  useEffect(() => {
    loadCredentials()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  const loadCredentials = async () => {
    try {
      const response = await apiCall<GitCredential[]>('credentials/?include_expired=false')
      // Load token, ssh_key, and generic type credentials for git authentication
      const filtered = (response || []).filter(c => c.type === 'token' || c.type === 'ssh_key' || c.type === 'generic')
      setCredentials(filtered)
    } catch (error) {
      console.error('Error loading credentials:', error)
      // Don't show an error message for credentials - it's optional
      // Some installations might not have credentials set up yet
      setCredentials([])
    }
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.category || !formData.url) {
      showMessage('Please fill in required fields', 'error')
      return
    }

    setIsSubmitting(true)
    try {
      // Extract credential name from "id:name" format
      const credentialName = formData.credential_name === '__none__'
        ? null
        : (formData.credential_name?.includes(':')
            ? formData.credential_name.split(':')[1]
            : formData.credential_name) || null

      await createRepoMutation.mutateAsync({
        ...formData,
        auth_type: formData.auth_type || 'none',
        credential_name: credentialName
      })

      resetForm()
    } catch {
      // Error already handled by mutation's onError
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
      auth_type: 'none',
      credential_name: '__none__',
      path: '',
      verify_ssl: true,
      git_author_name: '',
      git_author_email: '',
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
      // Extract credential name from "id:name" format (same as create/update)
      const credentialName = formData.credential_name === '__none__'
        ? null
        : (formData.credential_name?.includes(':')
            ? formData.credential_name.split(':')[1]
            : formData.credential_name) || null

      const response = await testConnectionMutation.mutateAsync({
        url: formData.url,
        branch: formData.branch || 'main',
        auth_type: formData.auth_type || 'none',
        credential_name: credentialName,
        verify_ssl: formData.verify_ssl
      })

      setConnectionStatus({
        type: response.success ? 'success' : 'error',
        text: response.message
      })
    } catch {
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
    
    // Find the matching credential and construct the "id:name" format expected by the Select component
    let credentialValue = '__none__'
    if (repo.credential_name) {
      // Determine expected credential type based on auth_type
      let expectedType = 'token'
      if (repo.auth_type === 'ssh_key') {
        expectedType = 'ssh_key'
      } else if (repo.auth_type === 'generic') {
        expectedType = 'generic'
      }
      
      const matchingCred = credentials.find(
        cred => cred.name === repo.credential_name && cred.type === expectedType
      )
      if (matchingCred?.id) {
        credentialValue = `${matchingCred.id}:${matchingCred.name}`
      } else if (matchingCred) {
        // Fallback for credentials without ID
        credentialValue = repo.credential_name
      }
    }
    
    setEditFormData({
      name: repo.name,
      category: repo.category,
      url: repo.url,
      branch: repo.branch,
      auth_type: repo.auth_type || 'none',
      credential_name: credentialValue,
      path: repo.path || '',
      verify_ssl: repo.verify_ssl,
      git_author_name: repo.git_author_name || '',
      git_author_email: repo.git_author_email || '',
      description: repo.description || ''
    })
    setShowEditDialog(true)
  }

  const saveRepositoryEdit = async () => {
    if (!editingRepo) return

    setIsSubmitting(true)
    try {
      // Extract credential name from "id:name" format
      const credentialName = editFormData.credential_name === '__none__'
        ? null
        : (editFormData.credential_name?.includes(':')
            ? editFormData.credential_name.split(':')[1]
            : editFormData.credential_name) || null

      await updateRepoMutation.mutateAsync({
        id: editingRepo.id,
        data: {
          ...editFormData,
          auth_type: editFormData.auth_type || 'none',
          credential_name: credentialName,
          is_active: editingRepo.is_active
        }
      })

      setShowEditDialog(false)
      setEditingRepo(null)
    } catch (error) {
      console.error('Error updating repository:', error)
      // Error already handled by mutation's onError
    } finally {
      setIsSubmitting(false)
    }
  }

  const deleteRepository = async (repo: GitRepository) => {
    if (!confirm(`Are you sure you want to delete "${repo.name}"?`)) {
      return
    }

    try {
      await deleteRepoMutation.mutateAsync(repo.id)
    } catch {
      // Error already handled by mutation's onError
    }
  }

  const syncRepository = async (repo: GitRepository) => {
    try {
      await syncRepoMutation.mutateAsync(repo.id)
    } catch {
      // Error already handled by mutation's onError
    }
  }

  const removeAndSyncRepository = async (repo: GitRepository) => {
    if (!confirm(`Are you sure you want to remove and re-clone "${repo.name}"? This will permanently delete the local copy and create a fresh clone.`)) {
      return
    }

    try {
      await removeAndSyncRepoMutation.mutateAsync(repo.id)
    } catch {
      // Error already handled by mutation's onError
    }
  }

  const showRepositoryStatus = async (repo: GitRepository) => {
    try {
      setStatusData(null)
      setShowStatusDialog(true)

      const response = await apiCall<{ success: boolean; data: GitStatus }>(`git/${repo.id}/status`)
      if (response.success) {
        setStatusData(response.data)
      } else {
        throw new Error('Failed to load repository status')
      }
    } catch {
      showMessage('Failed to load repository status', 'error')
      setShowStatusDialog(false)
    }
  }

  const openDebugDialog = (repo: GitRepository) => {
    setDebugRepo(repo)
    setDebugTab('diagnostics')
    setDebugResult(null)
    setShowDebugDialog(true)
  }

  const runDebugOperation = async (operation: 'read' | 'write' | 'delete' | 'push' | 'diagnostics') => {
    if (!debugRepo) return

    setDebugLoading(true)
    setDebugResult(null)

    try {
      const endpoint = operation === 'diagnostics'
        ? `git-repositories/${debugRepo.id}/debug/diagnostics`
        : `git-repositories/${debugRepo.id}/debug/${operation}`

      const method = operation === 'diagnostics' ? 'GET' : 'POST'

      const response = await apiCall(endpoint, { method })
      setDebugResult(response as DebugResult)
    } catch (error) {
      const err = error as Error
      setDebugResult({
        success: false,
        message: err.message || 'Debug operation failed',
        details: {
          error: err.message || 'Unknown error',
          error_type: 'FetchError'
        }
      })
    } finally {
      setDebugLoading(false)
    }
  }

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case 'device_configs': return 'bg-blue-100 text-blue-800 hover:bg-blue-200'
      case 'cockpit_configs': return 'bg-cyan-100 text-cyan-800 hover:bg-cyan-200'
      case 'templates': return 'bg-purple-100 text-purple-800 hover:bg-purple-200'
      case 'ansible': return 'bg-orange-100 text-orange-800 hover:bg-orange-200'
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
          {/* Repositories Table */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 pl-8 pr-8 -mx-6 -mt-6 mb-1">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-white text-sm font-semibold">
                  <GitBranch className="h-4 w-4" />
                  Managed Repositories ({repositories.length})
                </CardTitle>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={() => refetchRepositories()} variant="ghost" size="sm" className="h-6 px-2 text-xs text-white hover:bg-white/20 shrink-0">
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Refresh
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Reload repository list</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </CardHeader>
            <CardContent>
              {loadingRepos ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                  <p className="text-gray-500 mt-2">Loading repositories...</p>
                </div>
              ) : repositories.length === 0 ? (
                <div className="text-center py-8">
                  <Github className="h-12 w-12 mx-auto text-gray-400" />
                  <p className="text-gray-500 mt-2">No repositories found</p>
                  <p className="text-sm text-gray-400">Add a repository to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {repositories.map((repo) => (
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
                                  onClick={() => openDebugDialog(repo)}
                                  variant="outline"
                                  size="sm"
                                  className="text-purple-600 hover:text-purple-700"
                                >
                                  <Bug className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Debug repository (read/write/delete tests)</p>
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
                        <SelectItem value="device_configs">Device Configs</SelectItem>
                        <SelectItem value="cockpit_configs">Cockpit Configs</SelectItem>
                        <SelectItem value="templates">Templates</SelectItem>
                        <SelectItem value="ansible">Ansible</SelectItem>
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
                  <Label htmlFor="auth_type" className="text-sm font-semibold text-gray-800">Authentication Type</Label>
                  <Select 
                    value={formData.auth_type} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, auth_type: value, credential_name: '__none__' }))}
                  >
                    <SelectTrigger id="auth_type" className="border-2 border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200">
                      <SelectValue placeholder="Select authentication type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem key="create-auth-none" value="none">None (Public Repository)</SelectItem>
                      <SelectItem key="create-auth-token" value="token">Token</SelectItem>
                      <SelectItem key="create-auth-ssh" value="ssh_key">SSH Key</SelectItem>
                      <SelectItem key="create-auth-generic" value="generic">Generic (Username/Password)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-600">How to authenticate with this repository</p>
                </div>

                {formData.auth_type !== 'none' && (
                  <div className="space-y-2">
                    <Label htmlFor="credential" className="text-sm font-semibold text-gray-800">
                      {formData.auth_type === 'ssh_key' ? 'SSH Key Credential' : formData.auth_type === 'generic' ? 'Generic Credential' : 'Token Credential'}
                    </Label>
                    <Select 
                      value={formData.credential_name} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, credential_name: value }))}
                    >
                      <SelectTrigger id="credential" className="border-2 border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200">
                        <SelectValue placeholder={`Select ${formData.auth_type === 'ssh_key' ? 'SSH key' : formData.auth_type === 'generic' ? 'generic' : 'token'} credential`} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem key="create-cred-none" value="__none__">No credential selected</SelectItem>
                        {credentials
                          .filter(cred =>
                            formData.auth_type === 'ssh_key'
                              ? cred.type === 'ssh_key'
                              : formData.auth_type === 'generic'
                              ? cred.type === 'generic'
                              : cred.type === 'token'
                          )
                          .map((cred, index) => {
                            // Use ID in value to ensure uniqueness for RadixUI Select internal keys
                            const value = cred.id ? `${cred.id}:${cred.name}` : `${cred.name}-${cred.source || 'general'}-${index}`
                            const key = `create-cred-${cred.id || `${cred.name}-${cred.username}`}-${cred.type}-${cred.source || 'general'}-${index}`
                            return (
                              <SelectItem key={key} value={value}>
                                {cred.name} ({cred.username}){cred.source === 'private' ? ' [private]' : ''}
                              </SelectItem>
                            )
                          })}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-600">
                      {formData.auth_type === 'ssh_key' 
                        ? 'Select an SSH key credential for authentication' 
                        : formData.auth_type === 'generic'
                        ? 'Select a generic credential (username/password) for authentication'
                        : 'Select a token credential for authentication'}
                    </p>
                  </div>
                )}

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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="git-author-name" className="text-sm font-semibold text-gray-800">Git Author Name</Label>
                    <Input
                      id="git-author-name"
                      type="text"
                      placeholder="e.g., Network Team (optional)"
                      value={formData.git_author_name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, git_author_name: e.target.value }))}
                      className="border-2 border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
                    />
                    <p className="text-xs text-gray-600">Name used for git commits (defaults to &quot;Cockpit-NG Automation&quot;)</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="git-author-email" className="text-sm font-semibold text-gray-800">Git Author Email</Label>
                    <Input
                      id="git-author-email"
                      type="email"
                      placeholder="e.g., network@company.com (optional)"
                      value={formData.git_author_email}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, git_author_email: e.target.value }))}
                      className="border-2 border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
                    />
                    <p className="text-xs text-gray-600">Email used for git commits (defaults to &quot;noreply@cockpit-ng.local&quot;)</p>
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
                    <SelectItem value="device_configs">Device Configs</SelectItem>
                    <SelectItem value="cockpit_configs">Cockpit Configs</SelectItem>
                    <SelectItem value="templates">Templates</SelectItem>
                    <SelectItem value="ansible">Ansible</SelectItem>
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
              <Label htmlFor="edit-auth-type">Authentication Type</Label>
              <Select 
                value={editFormData.auth_type} 
                onValueChange={(value) => setEditFormData(prev => ({ ...prev, auth_type: value, credential_name: '__none__' }))}
              >
                <SelectTrigger id="edit-auth-type">
                  <SelectValue placeholder="Select authentication type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem key="edit-auth-none" value="none">None (Public Repository)</SelectItem>
                  <SelectItem key="edit-auth-token" value="token">Token</SelectItem>
                  <SelectItem key="edit-auth-ssh" value="ssh_key">SSH Key</SelectItem>
                  <SelectItem key="edit-auth-generic" value="generic">Generic (Username/Password)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editFormData.auth_type !== 'none' && (
              <div className="space-y-2">
                <Label htmlFor="edit-credential">
                  {editFormData.auth_type === 'ssh_key' ? 'SSH Key Credential' : editFormData.auth_type === 'generic' ? 'Generic Credential' : 'Token Credential'}
                </Label>
                <Select 
                  value={editFormData.credential_name} 
                  onValueChange={(value) => setEditFormData(prev => ({ ...prev, credential_name: value }))}
                >
                  <SelectTrigger id="edit-credential">
                    <SelectValue placeholder={`Select ${editFormData.auth_type === 'ssh_key' ? 'SSH key' : editFormData.auth_type === 'generic' ? 'generic' : 'token'} credential`} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem key="edit-cred-none" value="__none__">No credential selected</SelectItem>
                    {credentials
                      .filter(cred =>
                        editFormData.auth_type === 'ssh_key'
                          ? cred.type === 'ssh_key'
                          : editFormData.auth_type === 'generic'
                          ? cred.type === 'generic'
                          : cred.type === 'token'
                      )
                      .map((cred, index) => {
                        // Use ID in value to ensure uniqueness for RadixUI Select internal keys
                        const value = cred.id ? `${cred.id}:${cred.name}` : `${cred.name}-${cred.source || 'general'}-${index}`
                        const key = `edit-cred-${cred.id || `${cred.name}-${cred.username}`}-${cred.type}-${cred.source || 'general'}-${index}`
                        return (
                          <SelectItem key={key} value={value}>
                            {cred.name} ({cred.username}){cred.source === 'private' ? ' [private]' : ''}
                          </SelectItem>
                        )
                      })}
                  </SelectContent>
                </Select>
              </div>
            )}

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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="edit-git-author-name">Git Author Name</Label>
                <Input
                  id="edit-git-author-name"
                  type="text"
                  placeholder="e.g., Network Team (optional)"
                  value={editFormData.git_author_name}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, git_author_name: e.target.value }))}
                />
                <p className="text-xs text-gray-600">Name used for git commits (defaults to &quot;Cockpit-NG Automation&quot;)</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-git-author-email">Git Author Email</Label>
                <Input
                  id="edit-git-author-email"
                  type="email"
                  placeholder="e.g., network@company.com (optional)"
                  value={editFormData.git_author_email}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, git_author_email: e.target.value }))}
                />
                <p className="text-xs text-gray-600">Email used for git commits (defaults to &quot;noreply@cockpit-ng.local&quot;)</p>
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

      {/* Debug Dialog */}
      <Dialog open={showDebugDialog} onOpenChange={setShowDebugDialog}>
        <DialogContent className="!max-w-[90vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5 text-purple-600" />
              Debug Repository: {debugRepo?.name}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={debugTab} onValueChange={setDebugTab} className="space-y-4">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="diagnostics" className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                Diagnostics
              </TabsTrigger>
              <TabsTrigger value="read" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Read Test
              </TabsTrigger>
              <TabsTrigger value="write" className="flex items-center gap-2">
                <Edit className="h-4 w-4" />
                Write Test
              </TabsTrigger>
              <TabsTrigger value="delete" className="flex items-center gap-2">
                <X className="h-4 w-4" />
                Delete Test
              </TabsTrigger>
              <TabsTrigger value="push" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Push Test
              </TabsTrigger>
            </TabsList>

            {/* Diagnostics Tab */}
            <TabsContent value="diagnostics" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Repository Diagnostics</CardTitle>
                  <CardDescription>
                    Comprehensive diagnostic information about repository access, permissions, and configuration
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    onClick={() => runDebugOperation('diagnostics')}
                    disabled={debugLoading}
                    className="w-full"
                  >
                    {debugLoading ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Info className="h-4 w-4 mr-2" />
                    )}
                    Run Diagnostics
                  </Button>

                  {debugResult && (
                    <div className="space-y-4">
                      <div className={`p-4 rounded-md ${
                        debugResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                      }`}>
                        <div className="flex items-center gap-2">
                          {debugResult.success ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-red-600" />
                          )}
                          <span className={`font-medium ${
                            debugResult.success ? 'text-green-800' : 'text-red-800'
                          }`}>
                            {debugResult.success ? 'Diagnostics Complete' : 'Diagnostics Failed'}
                          </span>
                        </div>
                      </div>

                      {debugResult.diagnostics && (
                        <div className="space-y-4">
                          {/* Repository Info */}
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm">Repository Information</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2 text-sm">
                                {Object.entries(debugResult.diagnostics.repository_info).map(([key, value]) => (
                                  <div key={key} className="flex justify-between">
                                    <span className="font-medium text-gray-700">{key}:</span>
                                    <span className="text-gray-900">{String(value)}</span>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>

                          {/* Access Test */}
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm">Access Test</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2 text-sm">
                                {Object.entries(debugResult.diagnostics.access_test).map(([key, value]) => (
                                  <div key={key} className="flex justify-between">
                                    <span className="font-medium text-gray-700">{key}:</span>
                                    <span className={
                                      key === 'accessible' ? (value ? 'text-green-600' : 'text-red-600') : 'text-gray-900'
                                    }>{String(value)}</span>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>

                          {/* File System Permissions */}
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm">File System Permissions</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2 text-sm">
                                {Object.entries(debugResult.diagnostics.file_system).map(([key, value]) => (
                                  <div key={key} className="flex justify-between">
                                    <span className="font-medium text-gray-700">{key}:</span>
                                    <span className={
                                      typeof value === 'boolean' ? (value ? 'text-green-600' : 'text-red-600') : 'text-gray-900'
                                    }>{String(value)}</span>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>

                          {/* Git Status */}
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm">Git Status</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2 text-sm">
                                {Object.entries(debugResult.diagnostics.git_status).map(([key, value]) => (
                                  <div key={key} className="flex justify-between">
                                    <span className="font-medium text-gray-700">{key}:</span>
                                    <span className="text-gray-900">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>

                          {/* SSL Info */}
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm">SSL/TLS Configuration</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2 text-sm">
                                {Object.entries(debugResult.diagnostics.ssl_info).map(([key, value]) => (
                                  <div key={key} className="flex justify-between">
                                    <span className="font-medium text-gray-700">{key}:</span>
                                    <span className="text-gray-900">{String(value)}</span>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>

                          {/* Credentials */}
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm">Credentials</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2 text-sm">
                                {Object.entries(debugResult.diagnostics.credentials).map(([key, value]) => (
                                  <div key={key} className="flex justify-between">
                                    <span className="font-medium text-gray-700">{key}:</span>
                                    <span className={
                                      key.startsWith('has_') ? (value ? 'text-green-600' : 'text-red-600') : 'text-gray-900'
                                    }>{String(value)}</span>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>

                          {/* Push Capability */}
                          {debugResult.diagnostics.push_capability && (
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm flex items-center gap-2">
                                  <Upload className="h-4 w-4" />
                                  Push Capability
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between items-center">
                                    <span className="font-medium text-gray-700">Status:</span>
                                    <span className={
                                      debugResult.diagnostics.push_capability.can_push
                                        ? 'text-green-600 font-medium'
                                        : 'text-red-600 font-medium'
                                    }>
                                      {debugResult.diagnostics.push_capability.status}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="font-medium text-gray-700">Message:</span>
                                    <span className="text-gray-900 text-right max-w-[60%]">
                                      {debugResult.diagnostics.push_capability.message}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="font-medium text-gray-700">Can Push:</span>
                                    <span className={
                                      debugResult.diagnostics.push_capability.can_push
                                        ? 'text-green-600'
                                        : 'text-red-600'
                                    }>
                                      {String(debugResult.diagnostics.push_capability.can_push)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="font-medium text-gray-700">Has Credentials:</span>
                                    <span className={
                                      debugResult.diagnostics.push_capability.has_credentials
                                        ? 'text-green-600'
                                        : 'text-red-600'
                                    }>
                                      {String(debugResult.diagnostics.push_capability.has_credentials)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="font-medium text-gray-700">Has Remote:</span>
                                    <span className={
                                      debugResult.diagnostics.push_capability.has_remote
                                        ? 'text-green-600'
                                        : 'text-red-600'
                                    }>
                                      {String(debugResult.diagnostics.push_capability.has_remote)}
                                    </span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Read Test Tab */}
            <TabsContent value="read" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Read Test</CardTitle>
                  <CardDescription>
                    Test reading a file from the repository to verify read permissions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    onClick={() => runDebugOperation('read')}
                    disabled={debugLoading}
                    className="w-full"
                  >
                    {debugLoading ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4 mr-2" />
                    )}
                    Test Read Operation
                  </Button>

                  {debugResult && (
                    <div className="space-y-4">
                      <div className={`p-4 rounded-md ${
                        debugResult.success ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
                      }`}>
                        <div className="flex items-start gap-2">
                          {debugResult.success ? (
                            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                          )}
                          <div>
                            <div className={`font-medium ${
                              debugResult.success ? 'text-green-800' : 'text-yellow-800'
                            }`}>
                              {debugResult.message}
                            </div>
                            {debugResult.details?.suggestion != null && (
                              <div className="text-sm text-gray-600 mt-1">
                                {String(debugResult.details.suggestion)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {debugResult.details && (
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Details</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2 text-sm">
                              {Object.entries(debugResult.details).map(([key, value]) => (
                                <div key={key} className="space-y-1">
                                  <div className="flex justify-between">
                                    <span className="font-medium text-gray-700">{key}:</span>
                                  </div>
                                  {key === 'content' && typeof value === 'string' ? (
                                    <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">{value}</pre>
                                  ) : (
                                    <span className="text-gray-900 break-all">{String(value)}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Write Test Tab */}
            <TabsContent value="write" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Write Test</CardTitle>
                  <CardDescription>
                    Test writing a file to the repository to verify write permissions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    onClick={() => runDebugOperation('write')}
                    disabled={debugLoading}
                    className="w-full"
                  >
                    {debugLoading ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Edit className="h-4 w-4 mr-2" />
                    )}
                    Test Write Operation
                  </Button>

                  {debugResult && (
                    <div className="space-y-4">
                      <div className={`p-4 rounded-md ${
                        debugResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                      }`}>
                        <div className="flex items-start gap-2">
                          {debugResult.success ? (
                            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                          )}
                          <div>
                            <div className={`font-medium ${
                              debugResult.success ? 'text-green-800' : 'text-red-800'
                            }`}>
                              {debugResult.message}
                            </div>
                            {debugResult.details?.suggestion != null && (
                              <div className="text-sm text-gray-600 mt-1">
                                {String(debugResult.details.suggestion)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {debugResult.details && (
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Details</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2 text-sm">
                              {Object.entries(debugResult.details).map(([key, value]) => (
                                <div key={key} className="flex justify-between">
                                  <span className="font-medium text-gray-700">{key}:</span>
                                  <span className="text-gray-900 break-all">{String(value)}</span>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Delete Test Tab */}
            <TabsContent value="delete" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Delete Test</CardTitle>
                  <CardDescription>
                    Test deleting the test file from the repository
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    onClick={() => runDebugOperation('delete')}
                    disabled={debugLoading}
                    variant="destructive"
                    className="w-full"
                  >
                    {debugLoading ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <X className="h-4 w-4 mr-2" />
                    )}
                    Test Delete Operation
                  </Button>

                  {debugResult && (
                    <div className="space-y-4">
                      <div className={`p-4 rounded-md ${
                        debugResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                      }`}>
                        <div className="flex items-start gap-2">
                          {debugResult.success ? (
                            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                          )}
                          <div>
                            <div className={`font-medium ${
                              debugResult.success ? 'text-green-800' : 'text-red-800'
                            }`}>
                              {debugResult.message}
                            </div>
                            {debugResult.details?.suggestion != null && (
                              <div className="text-sm text-gray-600 mt-1">
                                {String(debugResult.details.suggestion)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {debugResult.details && (
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Details</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2 text-sm">
                              {Object.entries(debugResult.details).map(([key, value]) => (
                                <div key={key} className="flex justify-between">
                                  <span className="font-medium text-gray-700">{key}:</span>
                                  <span className="text-gray-900 break-all">{String(value)}</span>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Push Test Tab */}
            <TabsContent value="push" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Push Test</CardTitle>
                  <CardDescription>
                    Test pushing changes to the remote repository (creates a commit and pushes to remote)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                      <div className="text-sm text-yellow-800">
                        <div className="font-medium mb-1">Important:</div>
                        <ul className="list-disc list-inside space-y-1">
                          <li>This will create a real commit and push to the remote repository</li>
                          <li>Requires write access and valid credentials</li>
                          <li>Test file: <code className="bg-yellow-100 px-1 rounded">.cockpit_debug_test.txt</code></li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={() => runDebugOperation('push')}
                    disabled={debugLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {debugLoading ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Test Push Operation
                  </Button>

                  {debugResult && (
                    <div className="space-y-4">
                      <div className={`p-4 rounded-md ${
                        debugResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                      }`}>
                        <div className="flex items-start gap-2">
                          {debugResult.success ? (
                            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                          )}
                          <div>
                            <div className={`font-medium ${
                              debugResult.success ? 'text-green-800' : 'text-red-800'
                            }`}>
                              {debugResult.message}
                            </div>
                            {debugResult.details?.suggestion != null && (
                              <div className="text-sm text-gray-600 mt-1">
                                {String(debugResult.details.suggestion)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {debugResult.details && (
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Details</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2 text-sm">
                              {Object.entries(debugResult.details).map(([key, value]) => (
                                <div key={key} className="space-y-1">
                                  <div className="flex justify-between">
                                    <span className="font-medium text-gray-700">{key}:</span>
                                  </div>
                                  {key === 'commit_message' && typeof value === 'string' ? (
                                    <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">{value}</pre>
                                  ) : (
                                    <span className="text-gray-900 break-all">{String(value)}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
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
                                <span className="text-sm text-gray-600">
                                  {commit.author?.name || 'Unknown'}
                                </span>
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
