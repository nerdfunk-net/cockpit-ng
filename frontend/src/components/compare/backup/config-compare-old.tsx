'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  GitBranch, 
  FileSearch, 
  GitCompare, 
  Download, 
  RefreshCw, 
  Settings, 
  History,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  GitCommit,
  File,
  Eye,
  EyeOff,
  Folder,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  Minus,
  Search,
  Archive
} from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { useAuthStore } from '@/lib/auth-store'
import { checkDevAuth } from '@/lib/auth-debug'

interface Repository {
  id: number
  name: string
  category: string
  url: string
  branch: string
  username?: string
  credential_name?: string
  path: string
  verify_ssl: boolean
  description: string
  is_active: boolean
  created_at: string
  updated_at: string
  last_sync?: string
  sync_status?: string
}

interface GitRepositoryListResponse {
  repositories: Repository[]
  total: number
}

interface FileItem {
  name: string
  path: string
  directory?: string
}

interface Commit {
  hash: string
  author: string
  date: string
  message: string
  short_hash: string
}

interface Branch {
  name: string
  current: boolean
}

interface DiffLine {
  type: 'added' | 'removed' | 'modified' | 'unchanged'
  lineNumber: number
  content: string
  leftLineNumber?: number
  rightLineNumber?: number
}

interface ComparisonResult {
  title: string
  leftFile: string
  rightFile: string
  differences: DiffLine[]
  stats: {
    added: number
    removed: number
    modified: number
    unchanged: number
  }
}

interface ComparisonMode {
  mode: 'files' | 'git' | 'history'
}

export default function ConfigCompare() {
  const { apiCall } = useApi()
  const { isAuthenticated, token } = useAuthStore()
  
  // Repository state
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [selectedRepository, setSelectedRepository] = useState<Repository | null>(null)
  const [repositoryStatus, setRepositoryStatus] = useState<'loading' | 'ready' | 'error' | 'syncing'>('loading')
  const [authReady, setAuthReady] = useState(false)
  
  // File search state
  const [leftFiles, setLeftFiles] = useState<FileItem[]>([])
  const [rightFiles, setRightFiles] = useState<FileItem[]>([])
  const [selectedLeftFile, setSelectedLeftFile] = useState<FileItem | null>(null)
  const [selectedRightFile, setSelectedRightFile] = useState<FileItem | null>(null)
  const [leftFileSearch, setLeftFileSearch] = useState('')
  const [rightFileSearch, setRightFileSearch] = useState('')
  const [showLeftResults, setShowLeftResults] = useState(false)
  const [showRightResults, setShowRightResults] = useState(false)
  
  // Git state
  const [branches, setBranches] = useState<Branch[]>([])
  const [commits, setCommits] = useState<Commit[]>([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [leftCommit, setLeftCommit] = useState('')
  const [rightCommit, setRightCommit] = useState('')
  const [gitFiles, setGitFiles] = useState<FileItem[]>([])
  const [selectedGitFile, setSelectedGitFile] = useState<FileItem | null>(null)
  const [gitFileSearch, setGitFileSearch] = useState('')
  const [showGitResults, setShowGitResults] = useState(false)
  
  // History state
  const [historyBranch, setHistoryBranch] = useState('')
  const [historyCommit, setHistoryCommit] = useState('')
  const [historyFiles, setHistoryFiles] = useState<FileItem[]>([])
  const [selectedHistoryFile, setSelectedHistoryFile] = useState<FileItem | null>(null)
  const [historyFileSearch, setHistoryFileSearch] = useState('')
  const [showHistoryResults, setShowHistoryResults] = useState(false)
  const [fileHistory, setFileHistory] = useState<Commit[]>([])
  const [selectedHistoryRows, setSelectedHistoryRows] = useState<string[]>([])
  const [showFileHistory, setShowFileHistory] = useState(false)
  
  // Comparison state
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode['mode']>('files')
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null)
  const [showComparison, setShowComparison] = useState(false)
  const [hideUnchanged, setHideUnchanged] = useState(false)
  const [fontSize, setFontSize] = useState(12)
  const [currentDiffIndex, setCurrentDiffIndex] = useState(0)
  
  // Loading states
  const [loading, setLoading] = useState(false)
  const [syncingRepo, setSyncingRepo] = useState(false)
  
  // Refs for search dropdowns
  const leftSearchRef = useRef<HTMLDivElement>(null)
  const rightSearchRef = useRef<HTMLDivElement>(null)
  const gitSearchRef = useRef<HTMLDivElement>(null)
  const historySearchRef = useRef<HTMLDivElement>(null)

  // Load repositories on mount
  useEffect(() => {
    console.log('Compare: Component mounted, checking authentication...')
    
    const initializeAuth = async () => {
      // First check if we have a token in localStorage (like the old version)
      const storedToken = localStorage.getItem('auth_token')
      const storedUser = localStorage.getItem('user_info')
      
      console.log('Compare: Stored token exists:', !!storedToken)
      console.log('Compare: Stored user exists:', !!storedUser)
      
      if (storedToken && storedUser) {
        try {
          // Parse and validate stored user
          const user = JSON.parse(storedUser)
          console.log('Compare: Restoring authentication from localStorage:', user.username)
          
          // Update auth store with stored credentials
          const { login } = useAuthStore.getState()
          login(storedToken, {
            id: user.username || user.id,
            username: user.username,
            email: user.email || `${user.username}@demo.com`
          })
          
          setAuthReady(true)
          loadRepositories(true)
          return
        } catch (error) {
          console.error('Compare: Error parsing stored user info:', error)
          // Clear invalid data
          localStorage.removeItem('auth_token')
          localStorage.removeItem('user_info')
        }
      }
      
      // If no stored auth, check current auth state
      const authState = useAuthStore.getState()
      console.log('Compare: Auth store state:', {
        isAuthenticated: authState.isAuthenticated,
        hasToken: !!authState.token,
        hasUser: !!authState.user
      })
      
      if (authState.isAuthenticated && authState.token) {
        console.log('Compare: Auth store has valid authentication')
        setAuthReady(true)
        loadRepositories(true)
      } else {
        console.log('Compare: No authentication found, trying dev login...')
        // Try development login as fallback
        try {
          await checkDevAuth()
          const newAuthState = useAuthStore.getState()
          if (newAuthState.isAuthenticated && newAuthState.token) {
            console.log('Compare: Dev login successful')
            setAuthReady(true)
            loadRepositories(true)
          } else {
            console.log('Compare: Dev login failed, user needs to login manually')
            setAuthReady(false)
            setRepositoryStatus('error')
          }
        } catch (error) {
          console.error('Compare: Dev login error:', error)
          setAuthReady(false)
          setRepositoryStatus('error')
        }
      }
    }
    
    initializeAuth()
  }, [])

  // Watch for authentication changes
  useEffect(() => {
    if (isAuthenticated && token && !authReady) {
      setAuthReady(true)
      loadRepositories(true)
    }
  }, [isAuthenticated, token, authReady])

  // Load saved preferences
  useEffect(() => {
    const savedFontSize = localStorage.getItem('diff_font_size')
    if (savedFontSize) {
      setFontSize(parseInt(savedFontSize))
    }
  }, [])

  // Close search dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (leftSearchRef.current && !leftSearchRef.current.contains(event.target as Node)) {
        setShowLeftResults(false)
      }
      if (rightSearchRef.current && !rightSearchRef.current.contains(event.target as Node)) {
        setShowRightResults(false)
      }
      if (gitSearchRef.current && !gitSearchRef.current.contains(event.target as Node)) {
        setShowGitResults(false)
      }
      if (historySearchRef.current && !historySearchRef.current.contains(event.target as Node)) {
        setShowHistoryResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
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
      
      // Double-check auth state before API call
      const authState = useAuthStore.getState()
      console.log('Compare: Auth state check:', {
        isAuthenticated: authState.isAuthenticated,
        hasToken: !!authState.token,
        tokenLength: authState.token?.length || 0
      })
      
      const response = await apiCall<GitRepositoryListResponse>('git-repositories')
      console.log('Compare: API response received:', response)
      
      // Extract repositories from the response
      const repositories = response?.repositories || []
      console.log('Compare: Extracted repositories:', repositories)
      setRepositories(repositories)
      
      if (repositories && repositories.length > 0) {
        setRepositoryStatus('ready')
        console.log('Compare: Auto-selecting first repository:', repositories[0])
        // Auto-select first repository if available
        const firstRepo = repositories[0]
        await selectRepository(firstRepo)
      } else {
        console.log('Compare: No repositories found')
        setRepositoryStatus('error')
      }
    } catch (error: any) {
      console.error('Compare: Error loading repositories:', error)
      if (error.message?.includes('401') || error.message?.includes('403')) {
        console.log('Compare: Authentication error, resetting auth state')
        setRepositoryStatus('error')
        setAuthReady(false)
        // Could redirect to login or show auth error
      } else {
        console.log('Compare: Non-auth error')
        setRepositoryStatus('error')
      }
    }
  }

  const selectRepository = async (repo: Repository) => {
    setSelectedRepository(repo)
    setRepositoryStatus('loading')
    
    try {
      console.log('Compare: Setting selected repository on backend:', repo.id)
      // First, set this repository as selected on the backend
      await apiCall(`git-repositories/selected/${repo.id}`, { method: 'POST' })
      console.log('Compare: Repository selected on backend successfully')
      
      // Then load Git data for the repository
      await Promise.all([
        loadFiles(),
        loadBranches(),
        loadGitFiles()
      ])
      setRepositoryStatus('ready')
    } catch (error) {
      console.error('Error loading repository data:', error)
      setRepositoryStatus('error')
    }
  }

  const syncRepository = async () => {
    if (!selectedRepository) return
    
    setSyncingRepo(true)
    try {
      await apiCall(`git-repositories/${selectedRepository.id}/sync`, { method: 'POST' })
      // Reload data after sync
      await selectRepository(selectedRepository)
    } catch (error) {
      console.error('Error syncing repository:', error)
    } finally {
      setSyncingRepo(false)
    }
  }

  const loadFiles = async () => {
    try {
      const response = await apiCall<FileItem[]>('files/list')
      const files = response || []
      setLeftFiles(files)
      setRightFiles(files)
    } catch (error: any) {
      console.error('Error loading files:', error)
      if (error.message?.includes('401') || error.message?.includes('403')) {
        setRepositoryStatus('error')
      }
    }
  }

  const loadBranches = async () => {
    try {
      const response = await apiCall<Branch[]>('git/branches')
      setBranches(response || [])
      
      // Auto-select current branch
      const currentBranch = response?.find(b => b.current)
      if (currentBranch) {
        setSelectedBranch(currentBranch.name)
        setHistoryBranch(currentBranch.name)
        await loadCommitsForBranch(currentBranch.name)
      }
    } catch (error: any) {
      console.error('Error loading branches:', error)
      if (error.message?.includes('401') || error.message?.includes('403')) {
        setRepositoryStatus('error')
      }
    }
  }

  const loadCommitsForBranch = async (branch: string) => {
    try {
      const response = await apiCall<Commit[]>(`git/commits/${branch}`)
      setCommits(response || [])
    } catch (error: any) {
      console.error('Error loading commits:', error)
      if (error.message?.includes('401') || error.message?.includes('403')) {
        setRepositoryStatus('error')
      }
    }
  }

  const loadGitFiles = async () => {
    try {
      const response = await apiCall<FileItem[]>('git/status')
      setGitFiles(response || [])
    } catch (error: any) {
      console.error('Error loading git files:', error)
      if (error.message?.includes('401') || error.message?.includes('403')) {
        setRepositoryStatus('error')
      }
    }
  }

  const searchFiles = (query: string, files: FileItem[]) => {
    if (!query.trim()) return []
    
    const lowercaseQuery = query.toLowerCase()
    return files.filter(file => 
      file.name.toLowerCase().includes(lowercaseQuery) ||
      file.path.toLowerCase().includes(lowercaseQuery)
    ).slice(0, 10) // Limit results
  }

  const handleFileSelect = (file: FileItem, side: 'left' | 'right') => {
    if (side === 'left') {
      setSelectedLeftFile(file)
      setLeftFileSearch(file.name)
      setShowLeftResults(false)
    } else {
      setSelectedRightFile(file)
      setRightFileSearch(file.name)
      setShowRightResults(false)
    }
  }

  const handleGitFileSelect = (file: FileItem) => {
    setSelectedGitFile(file)
    setGitFileSearch(file.name)
    setShowGitResults(false)
  }

  const handleHistoryFileSelect = (file: FileItem) => {
    setSelectedHistoryFile(file)
    setHistoryFileSearch(file.name)
    setShowHistoryResults(false)
  }

  const loadFileHistory = async (file: FileItem) => {
    if (!file || !historyBranch) return
    
    try {
      const response = await apiCall<Commit[]>(`git/file-history/${encodeURIComponent(file.path)}?branch=${historyBranch}`)
      setFileHistory(response || [])
      setShowFileHistory(true)
    } catch (error) {
      console.error('Error loading file history:', error)
    }
  }

  const compareFiles = async () => {
    if (!selectedLeftFile || !selectedRightFile) return
    
    setLoading(true)
    try {
      const response = await apiCall<ComparisonResult>('files/compare', {
        method: 'POST',
        body: JSON.stringify({
          left_file: selectedLeftFile.path,
          right_file: selectedRightFile.path
        })
      })
      
      setComparisonResult(response)
      setShowComparison(true)
      setCurrentDiffIndex(0)
    } catch (error: any) {
      console.error('Error comparing files:', error)
      if (error.message?.includes('401') || error.message?.includes('403')) {
        setRepositoryStatus('error')
      }
    } finally {
      setLoading(false)
    }
  }

  const compareGitCommits = async () => {
    if (!leftCommit || !rightCommit || !selectedGitFile || 
        leftCommit.trim() === '' || rightCommit.trim() === '') return
    
    setLoading(true)
    try {
      const response = await apiCall<ComparisonResult>('git/diff', {
        method: 'POST',
        body: JSON.stringify({
          left_commit: leftCommit,
          right_commit: rightCommit,
          file_path: selectedGitFile.path
        })
      })
      
      setComparisonResult(response)
      setShowComparison(true)
      setCurrentDiffIndex(0)
    } catch (error: any) {
      console.error('Error comparing git commits:', error)
      if (error.message?.includes('401') || error.message?.includes('403')) {
        setRepositoryStatus('error')
      }
    } finally {
      setLoading(false)
    }
  }

  const compareHistoryCommits = async () => {
    if (selectedHistoryRows.length !== 2 || !selectedHistoryFile) return
    
    setLoading(true)
    try {
      const [olderCommit, newerCommit] = selectedHistoryRows.sort((a, b) => 
        fileHistory.findIndex(c => c.hash === b) - fileHistory.findIndex(c => c.hash === a)
      )
      
      const response = await apiCall<ComparisonResult>('git/diff', {
        method: 'POST',
        body: JSON.stringify({
          left_commit: olderCommit,
          right_commit: newerCommit,
          file_path: selectedHistoryFile.path
        })
      })
      
      setComparisonResult(response)
      setShowComparison(true)
      setCurrentDiffIndex(0)
    } catch (error) {
      console.error('Error comparing history commits:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportDiff = async () => {
    if (!comparisonResult) return
    
    try {
      const response = await apiCall('files/export-diff', {
        method: 'POST',
        body: JSON.stringify({
          left_file: comparisonResult.leftFile,
          right_file: comparisonResult.rightFile,
          format: 'unified'
        })
      })
      
      // Create download
      const blob = new Blob([response.content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `diff-${Date.now()}.patch`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting diff:', error)
    }
  }

  const navigateDiff = (direction: 'prev' | 'next') => {
    if (!comparisonResult) return
    
    const diffs = comparisonResult.differences.filter(d => d.type !== 'unchanged')
    const maxIndex = diffs.length - 1
    
    if (direction === 'next') {
      setCurrentDiffIndex(Math.min(currentDiffIndex + 1, maxIndex))
    } else {
      setCurrentDiffIndex(Math.max(currentDiffIndex - 1, 0))
    }
  }

  const getDiffLineClass = (type: DiffLine['type']) => {
    switch (type) {
      case 'added':
        return 'bg-green-50 border-l-4 border-green-500 text-green-900'
      case 'removed':
        return 'bg-red-50 border-l-4 border-red-500 text-red-900'
      case 'modified':
        return 'bg-yellow-50 border-l-4 border-yellow-500 text-yellow-900'
      default:
        return 'bg-white'
    }
  }

  const getDiffIcon = (type: DiffLine['type']) => {
    switch (type) {
      case 'added':
        return <Plus className="h-3 w-3 text-green-600" />
      case 'removed':
        return <Minus className="h-3 w-3 text-red-600" />
      case 'modified':
        return <RotateCcw className="h-3 w-3 text-yellow-600" />
      default:
        return null
    }
  }

  const canCompare = () => {
    switch (comparisonMode) {
      case 'files':
        return selectedLeftFile && selectedRightFile
      case 'git':
        return leftCommit && leftCommit.trim() !== '' && 
               rightCommit && rightCommit.trim() !== '' && 
               selectedGitFile
      case 'history':
        return selectedHistoryRows.length === 2 && selectedHistoryFile
      default:
        return false
    }
  }

  const handleCompare = () => {
    switch (comparisonMode) {
      case 'files':
        compareFiles()
        break
      case 'git':
        compareGitCommits()
        break
      case 'history':
        compareHistoryCommits()
        break
    }
  }

  if (!authReady || repositoryStatus === 'loading') {
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
                : 'No Git repositories are configured. Please configure at least one repository in the settings.'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!authReady ? (
              <div className="space-y-4">
                <Button onClick={async () => {
                  console.log('Compare: Manual auth button clicked')
                  try {
                    await checkDevAuth()
                    // Wait a moment for auth to process
                    setTimeout(() => {
                      const authState = useAuthStore.getState()
                      console.log('Compare: Auth state after manual login:', {
                        isAuthenticated: authState.isAuthenticated,
                        hasToken: !!authState.token
                      })
                      
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
                }} className="mr-2">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Auto Login
                </Button>
                <Button variant="outline" onClick={() => window.location.href = '/login'}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Go to Login
                </Button>
              </div>
            ) : (
              <>
                <Button onClick={() => loadRepositories()} className="mr-2">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
                <Button variant="outline" onClick={() => window.location.href = '/settings/git'}>
                  <Settings className="h-4 w-4 mr-2" />
                  Configure Repositories
                </Button>
              </>
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
        <Card key="repository-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Repository: {selectedRepository.name}
            </CardTitle>
            <CardDescription className="flex items-center justify-between">
              <span>URL: {selectedRepository.url} | Branch: {selectedRepository.branch}</span>
              <div className="flex items-center gap-2">
                <Badge variant={repositoryStatus === 'ready' ? 'default' : 'secondary'}>
                  {repositoryStatus === 'ready' ? 'Ready' : 'Loading'}
                </Badge>
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

      {/* Comparison Mode Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Comparison Mode</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={comparisonMode} onValueChange={(value) => setComparisonMode(value as ComparisonMode['mode'])}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="files" className="flex items-center gap-2">
                <File key="files-icon" className="h-4 w-4" />
                <span key="files-text">Files</span>
              </TabsTrigger>
              <TabsTrigger value="git" className="flex items-center gap-2">
                <GitCommit key="git-icon" className="h-4 w-4" />
                <span key="git-text">Git Commits</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History key="history-icon" className="h-4 w-4" />
                <span key="history-text">File History</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="files" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left File Selection */}
                <div className="space-y-2" ref={leftSearchRef}>
                  <Label>Source File</Label>
                  <div className="relative">
                    <Input
                      placeholder="Search for source file..."
                      value={leftFileSearch}
                      onChange={(e) => {
                        setLeftFileSearch(e.target.value)
                        setShowLeftResults(e.target.value.length > 0)
                      }}
                      onFocus={() => setShowLeftResults(leftFileSearch.length > 0)}
                    />
                    {showLeftResults && (
                      <div className="absolute top-full left-0 right-0 z-10 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {searchFiles(leftFileSearch, leftFiles).map((file) => (
                          <div
                            key={file.path}
                            className="p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            onClick={() => handleFileSelect(file, 'left')}
                          >
                            <div className="font-medium text-sm">{file.name}</div>
                            <div className="text-xs text-gray-500">{file.path}</div>
                          </div>
                        ))}
                        {searchFiles(leftFileSearch, leftFiles).length === 0 && (
                          <div key="no-left-files" className="p-2 text-sm text-gray-500">No files found</div>
                        )}
                      </div>
                    )}
                  </div>
                  {selectedLeftFile && (
                    <div className="text-sm text-gray-600 bg-blue-50 p-2 rounded">
                      Selected: {selectedLeftFile.path}
                    </div>
                  )}
                </div>

                {/* Right File Selection */}
                <div className="space-y-2" ref={rightSearchRef}>
                  <Label>Target File</Label>
                  <div className="relative">
                    <Input
                      placeholder="Search for target file..."
                      value={rightFileSearch}
                      onChange={(e) => {
                        setRightFileSearch(e.target.value)
                        setShowRightResults(e.target.value.length > 0)
                      }}
                      onFocus={() => setShowRightResults(rightFileSearch.length > 0)}
                    />
                    {showRightResults && (
                      <div className="absolute top-full left-0 right-0 z-10 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {searchFiles(rightFileSearch, rightFiles).map((file) => (
                          <div
                            key={file.path}
                            className="p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            onClick={() => handleFileSelect(file, 'right')}
                          >
                            <div className="font-medium text-sm">{file.name}</div>
                            <div className="text-xs text-gray-500">{file.path}</div>
                          </div>
                        ))}
                        {searchFiles(rightFileSearch, rightFiles).length === 0 && (
                          <div key="no-right-files" className="p-2 text-sm text-gray-500">No files found</div>
                        )}
                      </div>
                    )}
                  </div>
                  {selectedRightFile && (
                    <div className="text-sm text-gray-600 bg-blue-50 p-2 rounded">
                      Selected: {selectedRightFile.path}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="git" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Branch</Label>
                  <Select value={selectedBranch || '__none__'} onValueChange={(value) => {
                    const newValue = value === '__none__' ? '' : value
                    setSelectedBranch(newValue)
                    if (newValue) {
                      loadCommitsForBranch(newValue)
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select branch...</SelectItem>
                      {branches.map((branch) => (
                        <SelectItem key={branch.name} value={branch.name}>
                          {branch.name} {branch.current && '(current)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Source Commit</Label>
                  <Select value={leftCommit || '__none__'} onValueChange={(value) => {
                    setLeftCommit(value === '__none__' ? '' : value)
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source commit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select source commit...</SelectItem>
                      {commits.map((commit) => (
                        <SelectItem key={commit.hash} value={commit.hash}>
                          {commit.short_hash} - {commit.message.substring(0, 50)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Target Commit</Label>
                  <Select value={rightCommit || '__none__'} onValueChange={(value) => {
                    setRightCommit(value === '__none__' ? '' : value)
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select target commit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select target commit...</SelectItem>
                      {commits.map((commit) => (
                        <SelectItem key={commit.hash} value={commit.hash}>
                          {commit.short_hash} - {commit.message.substring(0, 50)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2" ref={gitSearchRef}>
                <Label>File to Compare</Label>
                <div className="relative">
                  <Input
                    placeholder="Search for file..."
                    value={gitFileSearch}
                    onChange={(e) => {
                      setGitFileSearch(e.target.value)
                      setShowGitResults(e.target.value.length > 0)
                    }}
                    onFocus={() => setShowGitResults(gitFileSearch.length > 0)}
                  />
                  {showGitResults && (
                    <div className="absolute top-full left-0 right-0 z-10 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {searchFiles(gitFileSearch, gitFiles).map((file) => (
                        <div
                          key={file.path}
                          className="p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                          onClick={() => handleGitFileSelect(file)}
                        >
                          <div className="font-medium text-sm">{file.name}</div>
                          <div className="text-xs text-gray-500">{file.path}</div>
                        </div>
                      ))}
                      {searchFiles(gitFileSearch, gitFiles).length === 0 && (
                        <div key="no-git-files" className="p-2 text-sm text-gray-500">No files found</div>
                      )}
                    </div>
                  )}
                </div>
                {selectedGitFile && (
                  <div className="text-sm text-gray-600 bg-blue-50 p-2 rounded">
                    Selected: {selectedGitFile.path}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Branch</Label>
                  <Select value={historyBranch || '__none__'} onValueChange={(value) => {
                    const newValue = value === '__none__' ? '' : value
                    setHistoryBranch(newValue)
                    if (newValue) {
                      loadCommitsForBranch(newValue)
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select branch...</SelectItem>
                      {branches.map((branch) => (
                        <SelectItem key={branch.name} value={branch.name}>
                          {branch.name} {branch.current && '(current)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2" ref={historySearchRef}>
                  <Label>File</Label>
                  <div className="relative">
                    <Input
                      placeholder="Search for file..."
                      value={historyFileSearch}
                      onChange={(e) => {
                        setHistoryFileSearch(e.target.value)
                        setShowHistoryResults(e.target.value.length > 0)
                      }}
                      onFocus={() => setShowHistoryResults(historyFileSearch.length > 0)}
                    />
                    {showHistoryResults && (
                      <div className="absolute top-full left-0 right-0 z-10 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {searchFiles(historyFileSearch, gitFiles).map((file) => (
                          <div
                            key={file.path}
                            className="p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            onClick={() => handleHistoryFileSelect(file)}
                          >
                            <div className="font-medium text-sm">{file.name}</div>
                            <div className="text-xs text-gray-500">{file.path}</div>
                          </div>
                        ))}
                        {searchFiles(historyFileSearch, gitFiles).length === 0 && (
                          <div key="no-history-files" className="p-2 text-sm text-gray-500">No files found</div>
                        )}
                      </div>
                    )}
                  </div>
                  {selectedHistoryFile && (
                    <div className="text-sm text-gray-600 bg-blue-50 p-2 rounded">
                      Selected: {selectedHistoryFile.path}
                    </div>
                  )}
                </div>
              </div>

              {selectedHistoryFile && historyBranch && (
                <div key="show-history-button" className="space-y-2">
                  <Button 
                    onClick={() => loadFileHistory(selectedHistoryFile)}
                    disabled={!selectedHistoryFile}
                  >
                    <History className="h-4 w-4 mr-2" />
                    Show File History
                  </Button>
                </div>
              )}

              {showFileHistory && fileHistory.length > 0 && (
                <Card key="file-history-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      File History: {selectedHistoryFile?.name}
                    </CardTitle>
                    <CardDescription>
                      Select two commits to compare (selected: {selectedHistoryRows.length}/2)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {fileHistory.map((commit, index) => (
                        <div
                          key={commit.hash}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedHistoryRows.includes(commit.hash)
                              ? 'bg-blue-50 border-blue-300'
                              : 'hover:bg-gray-50'
                          }`}
                          onClick={() => {
                            if (selectedHistoryRows.includes(commit.hash)) {
                              setSelectedHistoryRows(prev => prev.filter(h => h !== commit.hash))
                            } else if (selectedHistoryRows.length < 2) {
                              setSelectedHistoryRows(prev => [...prev, commit.hash])
                            }
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {selectedHistoryRows.includes(commit.hash) && (
                                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                              )}
                              <div>
                                <div className="font-mono text-sm">{commit.short_hash}</div>
                                <div className="text-sm text-gray-600">{commit.author}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium">{commit.message}</div>
                              <div className="text-xs text-gray-500">{new Date(commit.date).toLocaleString()}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Compare Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button 
                onClick={handleCompare} 
                disabled={!canCompare() || loading}
                className="flex items-center gap-2"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <GitCompare className="h-4 w-4" />
                )}
                Compare
              </Button>
              
              {comparisonResult && (
                <Button 
                  key="export-diff-button"
                  variant="outline" 
                  onClick={exportDiff}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export Diff
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHideUnchanged(!hideUnchanged)}
                className="flex items-center gap-2"
              >
                {hideUnchanged ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                {hideUnchanged ? 'Show' : 'Hide'} Unchanged
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Results */}
      {showComparison && comparisonResult && (
        <Card key="comparison-results-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <GitCompare className="h-5 w-5" />
                  {comparisonResult.title}
                </CardTitle>
                <CardDescription>
                  {comparisonResult.leftFile} ↔ {comparisonResult.rightFile}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-sm text-gray-600">
                  <span className="text-green-600">+{comparisonResult.stats.added}</span>
                  {' '}
                  <span className="text-red-600">-{comparisonResult.stats.removed}</span>
                  {' '}
                  <span className="text-yellow-600">~{comparisonResult.stats.modified}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigateDiff('prev')}
                    disabled={currentDiffIndex === 0}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigateDiff('next')}
                    disabled={currentDiffIndex >= comparisonResult.differences.filter(d => d.type !== 'unchanged').length - 1}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowComparison(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div 
              className="border rounded-lg overflow-auto font-mono text-sm"
              style={{ fontSize: `${fontSize}px`, maxHeight: '600px' }}
            >
              {comparisonResult.differences
                .filter(line => !hideUnchanged || line.type !== 'unchanged')
                .map((line, index) => (
                <div
                  key={`diff-${line.leftLineNumber || 'none'}-${line.rightLineNumber || 'none'}-${line.type}-${index}`}
                  className={`flex items-start gap-2 p-2 ${getDiffLineClass(line.type)}`}
                >
                  <div className="flex-shrink-0 w-6 flex justify-center">
                    {getDiffIcon(line.type)}
                  </div>
                  <div className="flex-shrink-0 w-16 text-gray-500 text-right text-xs">
                    <div>{line.leftLineNumber || ''}</div>
                    <div>{line.rightLineNumber || ''}</div>
                  </div>
                  <div className="flex-1 whitespace-pre-wrap break-all">
                    {line.content}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
