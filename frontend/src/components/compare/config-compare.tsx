'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  File, 
  GitCommit, 
  History,
  GitBranch,
  RefreshCw,
  XCircle,
  Settings
} from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { useApi } from '@/hooks/use-api'
import FileCompare from './file-compare'
import GitCompare from './git-compare'
import FileHistoryCompare from './file-history-compare'

interface Repository {
  id: number
  name: string
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
      
      const repositories = response.repositories || []
      console.log('Compare: Extracted repositories:', repositories)
      
      setRepositories(repositories)
      if (repositories && repositories.length > 0) {
        console.log('Compare: Auto-selecting first repository:', repositories[0])
        await selectRepository(repositories[0])
        setRepositoryStatus('ready')
      } else {
        console.log('Compare: No repositories found')
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
                : 'No Git repositories found. Please configure at least one repository to use the compare functionality.'
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configuration Compare</h1>
          <p className="text-gray-600">Compare configuration files and track changes across Git history</p>
        </div>
      </div>

      {/* Repository Selection */}
      {selectedRepository && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Repository: {selectedRepository.name}
            </CardTitle>
            <CardDescription className="flex items-center justify-between">
              <span>URL: {selectedRepository.url} | Branch: {selectedRepository.branch}</span>
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={syncRepository}
                  disabled={syncingRepo}
                >
                  {syncingRepo ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Sync
                </Button>
              </div>
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Mode Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Comparison Mode</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              key="mode-files"
              variant={comparisonMode === 'files' ? 'default' : 'outline'}
              onClick={() => setComparisonMode('files')}
              className="flex items-center gap-2"
            >
              <File className="h-4 w-4" />
              Files
            </Button>
            <Button
              key="mode-git"
              variant={comparisonMode === 'git' ? 'default' : 'outline'}
              onClick={() => setComparisonMode('git')}
              className="flex items-center gap-2"
            >
              <GitCommit className="h-4 w-4" />
              Git Commits
            </Button>
            <Button
              key="mode-history"
              variant={comparisonMode === 'history' ? 'default' : 'outline'}
              onClick={() => setComparisonMode('history')}
              className="flex items-center gap-2"
            >
              <History className="h-4 w-4" />
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
