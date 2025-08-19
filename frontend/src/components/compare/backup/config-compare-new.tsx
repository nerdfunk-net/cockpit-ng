'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  File, 
  GitCommit, 
  GitBranch,
  RefreshCw,
  XCircle,
  Settings
} from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { useApi } from '@/hooks/use-api'
import { devLogin } from '@/lib/auth-debug'
import FileCompare from './file-compare'
import GitCompare from './git-compare'

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

type ComparisonMode = 'files' | 'git'

export default function ConfigCompare() {
  const { apiCall } = useApi()
  const { isAuthenticated, token } = useAuthStore()
  
  // Core state
  const [authReady, setAuthReady] = useState(false)
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [selectedRepository, setSelectedRepository] = useState<Repository | null>(null)
  const [repositoryStatus, setRepositoryStatus] = useState<'loading' | 'ready' | 'error' | 'syncing'>('loading')
  const [syncingRepo, setSyncingRepo] = useState(false)
  const [fontSize, setFontSize] = useState(12)
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('files')

  // Authentication effect
  useEffect(() => {
    console.log('Compare: Component mounted, checking authentication...')
    
    // Check localStorage first
    const storedToken = localStorage.getItem('auth_token')
    const storedUser = localStorage.getItem('auth_user')
    
    if (storedToken && storedUser) {
      console.log('Compare: Stored token exists:', !!storedToken)
      console.log('Compare: Stored user exists:', !!storedUser)
      
      try {
        const user = JSON.parse(storedUser)
        if (user && user.username) {
          console.log('Compare: Restoring authentication from localStorage:', user.username)
          useAuthStore.getState().login(user, storedToken)
          setAuthReady(true)
          setTimeout(() => {
            loadRepositories(true)
          }, 100)
          return
        }
      } catch (error) {
        console.error('Compare: Error parsing stored user info:', error)
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_user')
      }
    }

    // Check auth store state
    console.log('Compare: Auth store state:', {
      isAuthenticated,
      hasToken: !!token
    })

    if (isAuthenticated && token) {
      console.log('Compare: Auth store has valid authentication')
      setAuthReady(true)
      loadRepositories()
    } else {
      console.log('Compare: No authentication found, trying dev login...')
      devLogin().then((newAuthState) => {
        if (newAuthState.isAuthenticated && newAuthState.token) {
          console.log('Compare: Dev login successful')
          setAuthReady(true)
          loadRepositories(true)
        } else {
          console.log('Compare: Dev login failed, user needs to login manually')
          setRepositoryStatus('error')
        }
      }).catch((error) => {
        console.error('Compare: Dev login error:', error)
        setRepositoryStatus('error')
      })
    }
  }, [isAuthenticated, token])

  // Load repositories and set up auth state
  useEffect(() => {
    if (isAuthenticated && token && !authReady) {
      setAuthReady(true)
      loadRepositories()
    }
  }, [isAuthenticated, token, authReady])

  // Load font size from localStorage
  useEffect(() => {
    const storedFontSize = localStorage.getItem('diff_font_size')
    if (storedFontSize) {
      setFontSize(parseInt(storedFontSize))
    }
  }, [])

  const loadRepositories = async (forceLoad = false) => {
    console.log('Compare: loadRepositories called, authReady =', authReady, 'forceLoad =', forceLoad)
    
    if (!authReady && !forceLoad) {
      console.log('Compare: Authentication not ready, skipping repository load')
      return
    }

    try {
      console.log('Compare: Starting repository load...')
      setRepositoryStatus('loading')
      
      console.log('Compare: Auth state check:', {
        isAuthenticated: useAuthStore.getState().isAuthenticated,
        hasToken: !!useAuthStore.getState().token
      })

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
      default:
        return <FileCompare />
    }
  }

  // Loading state
  if (repositoryStatus === 'loading') {
    return (
      <div className="container mx-auto p-6">
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
      <div className="container mx-auto p-6">
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
                        loadRepositories(true)
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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configuration Compare</h1>
          <p className="text-gray-600">Compare configuration files and track changes across Git history</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={fontSize.toString()} onValueChange={(value) => {
            setFontSize(parseInt(value))
            localStorage.setItem('diff_font_size', value)
          }}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10px</SelectItem>
              <SelectItem value="11">11px</SelectItem>
              <SelectItem value="12">12px</SelectItem>
              <SelectItem value="13">13px</SelectItem>
              <SelectItem value="14">14px</SelectItem>
              <SelectItem value="16">16px</SelectItem>
            </SelectContent>
          </Select>
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
          </div>
        </CardContent>
      </Card>

      {/* Dynamic Content */}
      {renderContent()}
    </div>
  )
}
