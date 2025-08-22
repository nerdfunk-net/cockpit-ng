'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  File, 
  GitCommit, 
  History,
  GitBranch,
  RefreshCw,
  XCircle,
  Settings,
  ChevronDown
} from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { useApi } from '@/hooks/use-api'
import FileCompare from './file-compare'
import GitCompare from './git-compare'
import FileHistoryCompare from './file-history-compare'

interface Repository {
  id: number
  name: string
  category: string
  url: string
  branch: string
  status: string
}

interface GitRepositoryListResponse {
  repositories: Repository[]
}

type ComparisonMode = 'files' | 'git' | 'history'

export default function ConfigCompare() {
  const { apiCall } = useApi()
  const { isAuthenticated, token } = useAuthStore()
  
  // Core state
  const [authReady, setAuthReady] = useState(false)
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [selectedRepository, setSelectedRepository] = useState<Repository | null>(null)
  const [repositoryStatus, setRepositoryStatus] = useState<'loading' | 'ready' | 'error' | 'syncing'>('loading')
  const [syncingRepo, setSyncingRepo] = useState(false)
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('files')

  // Authentication effect - simplified since DashboardLayout handles auth
  useEffect(() => {
    if (isAuthenticated && token) {
      console.log('Compare: Authentication ready, loading repositories')
      setAuthReady(true)
      loadRepositories()
    }
  }, [isAuthenticated, token])

  const loadRepositories = async () => {
    try {
      console.log('Compare: Loading repositories...')
      setRepositoryStatus('loading')

      const response = await apiCall<GitRepositoryListResponse>('git-repositories')
      console.log('Compare: API response received:', response)
      
      // Filter to only show repositories with category "configs"
      const allRepositories = response.repositories || []
      const configRepositories = allRepositories.filter(repo => repo.category === 'configs')
      console.log('Compare: Filtered config repositories:', configRepositories)
      
      setRepositories(configRepositories)
      if (configRepositories && configRepositories.length > 0) {
        console.log('Compare: Auto-selecting first config repository:', configRepositories[0])
        await selectRepository(configRepositories[0])
        setRepositoryStatus('ready')
      } else {
        console.log('Compare: No config repositories found')
        setRepositoryStatus('error')
      }
    } catch (error) {
      console.error('Compare: Error loading repositories:', error)
      setRepositoryStatus('error')
    }
  }

  const selectRepository = async (repo: Repository) => {
    setSelectedRepository(repo)
    try {
      await apiCall(`git-repositories/selected/${repo.id}`, { method: 'POST' })
    } catch (error) {
      console.error('Error selecting repository:', error)
    }
  }

  const syncRepository = async () => {
    if (!selectedRepository) return

    setSyncingRepo(true)
    try {
      await apiCall(`git-repositories/${selectedRepository.id}/sync`, { method: 'POST' })
      
      await selectRepository(selectedRepository)
      setRepositoryStatus('ready')
    } catch (error) {
      console.error('Error syncing repository:', error)
    } finally {
      setSyncingRepo(false)
    }
  }

  const renderContent = () => {
    switch (comparisonMode) {
      case 'files':
        return <FileCompare />
      case 'git':
        return <GitCompare />
      case 'history':
        return <FileHistoryCompare />
      default:
        return <FileCompare />
    }
  }

  // Loading state
  if (repositoryStatus === 'loading') {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin" />
              Loading Configuration Compare
            </CardTitle>
            <CardDescription>
              {!authReady ? 'Establishing authentication...' : 'Initializing comparison tools and loading repository data...'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // Error state
  if (repositoryStatus === 'error') {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              {!authReady ? 'Authentication Required' : 'No Repositories Available'}
            </CardTitle>
            <CardDescription>
              {!authReady 
                ? 'Please log in to access the configuration compare tool.'
                : 'No Git repositories with category "configs" found. Please configure at least one config repository to use the compare functionality.'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!authReady ? (
              <div className="flex items-center gap-2">
                <Button onClick={async () => {
                  console.log('Compare: Manual auth button clicked')
                  try {
                    const authState = useAuthStore.getState()
                    console.log('Compare: Current auth state before manual auth:', {
                      isAuthenticated: authState.isAuthenticated,
                      hasToken: !!authState.token
                    })
                    
                    setTimeout(async () => {
                      const authState = useAuthStore.getState()
                      if (authState.isAuthenticated && authState.token) {
                        setAuthReady(true)
                        loadRepositories()
                      } else {
                        console.log('Compare: Manual auth failed')
                      }
                    }, 1000)
                  } catch (error) {
                    console.error('Compare: Manual auth error:', error)
                  }
                }}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Auto Login
                </Button>
                <Button variant="outline" onClick={() => window.location.href = '/login'}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Go to Login
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button onClick={() => loadRepositories()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
                <Button variant="outline" onClick={() => window.location.href = '/settings/git'}>
                  <Settings className="h-4 w-4 mr-2" />
                  Configure Repositories
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Configuration Compare</h1>
          <p className="text-gray-600 mt-1">Compare configuration files and track changes across Git history</p>
        </div>
        
        {/* Quick Actions */}
        <div className="flex items-center space-x-2">
          <Button 
            onClick={() => loadRepositories()}
            variant="outline"
            disabled={!authReady}
          >
            {!authReady ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* Repository Selection */}
      {repositories.length > 0 && (
        <Card className="shadow-lg border-0 overflow-hidden p-0">
          <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2 text-sm font-medium">
                <GitBranch className="h-3 w-3" />
                <span>Config Repository</span>
              </CardTitle>
              {selectedRepository && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={syncRepository}
                  disabled={syncingRepo}
                  className="bg-white/20 border-white/30 text-white hover:bg-white/30 h-5 px-1.5 text-xs"
                >
                  {syncingRepo ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="py-1.5 px-3 bg-gradient-to-b from-white to-gray-50">
            <div className="flex items-center gap-2">
              {repositories.length > 1 ? (
                <div className="flex-1">
                  <Select 
                    value={selectedRepository?.id.toString() || ''} 
                    onValueChange={(value) => {
                      const repo = repositories.find(r => r.id.toString() === value)
                      if (repo) selectRepository(repo)
                    }}
                  >
                    <SelectTrigger className="h-7 text-sm border-gray-200">
                      <SelectValue>
                        {selectedRepository ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium">{selectedRepository.name}</span>
                            <span className="text-gray-500 text-xs">({selectedRepository.branch})</span>
                          </div>
                        ) : 'Select repository'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {repositories.map((repo) => (
                        <SelectItem key={repo.id} value={repo.id.toString()}>
                          <div className="flex items-center gap-1.5">
                            <GitBranch className="h-3 w-3" />
                            <span className="font-medium">{repo.name}</span>
                            <span className="text-gray-500 text-xs">({repo.branch})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="flex-1 flex items-center gap-1.5">
                  <span className="font-medium text-sm">{selectedRepository?.name}</span>
                  <span className="text-gray-500 text-xs">({selectedRepository?.branch})</span>
                </div>
              )}
              
              {selectedRepository && (
                <div className="text-xs text-gray-400 truncate max-w-48 hidden sm:block">
                  {selectedRepository.url}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mode Selection */}
      <Card className="shadow-lg border-0 overflow-hidden p-0">
        <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-3">
          <CardTitle className="flex items-center space-x-2 text-sm font-medium">
            <Settings className="h-3 w-3" />
            <span>Comparison Mode</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="py-1.5 px-3 bg-gradient-to-b from-white to-gray-50">
          <div className="flex flex-wrap gap-1.5">
            <Button
              key="mode-files"
              variant={comparisonMode === 'files' ? 'default' : 'outline'}
              onClick={() => setComparisonMode('files')}
              className="flex items-center gap-1.5 h-7 px-2 text-xs"
            >
              <File className="h-3 w-3" />
              Files
            </Button>
            <Button
              key="mode-git"
              variant={comparisonMode === 'git' ? 'default' : 'outline'}
              onClick={() => setComparisonMode('git')}
              className="flex items-center gap-1.5 h-7 px-2 text-xs"
            >
              <GitCommit className="h-3 w-3" />
              Git Commits
            </Button>
            <Button
              key="mode-history"
              variant={comparisonMode === 'history' ? 'default' : 'outline'}
              onClick={() => setComparisonMode('history')}
              className="flex items-center gap-1.5 h-7 px-2 text-xs"
            >
              <History className="h-3 w-3" />
              File History
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dynamic Content */}
      {renderContent()}
    </div>
  )
}
