'use client'

import { useState, useCallback, useEffect } from 'react'
import { Eye, RotateCcw, FolderTree, Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useApi } from '@/hooks/use-api'
import { useAuthStore } from '@/lib/auth-store'
import { useGitTreeQuery } from '@/hooks/queries/use-git-tree-query'
import { FileTree } from './components/file-tree'
import { FileList } from './components/file-list'
import { ResizableLayout } from './components/resizable-layout'
import { FileHistoryDialog } from './dialogs/file-history-dialog'
import { FileDiffDialog } from './dialogs/file-diff-dialog'
import { FileViewDialog } from './dialogs/file-view-dialog'
import type { Repository, FileWithCommit } from './types'

const EMPTY_ARRAY: Repository[] = []

export default function ConfigsViewPage() {
  const { apiCall } = useApi()
  const { token } = useAuthStore()

  // State
  const [repositories, setRepositories] = useState<Repository[]>(EMPTY_ARRAY)
  const [selectedRepository, setSelectedRepository] = useState<number | null>(null)
  const [selectedDirectoryPath, setSelectedDirectoryPath] = useState<string>('')
  const [filterText, setFilterText] = useState<string>('')
  const [globalSearchText, setGlobalSearchText] = useState<string>('')
  const [searchResults, setSearchResults] = useState<{directories: Set<string>, files: Array<{name: string, path: string, directory: string}>} | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // File history dialog state
  const [fileHistoryDialog, setFileHistoryDialog] = useState<{
    isOpen: boolean
    filePath: string | null
  }>({
    isOpen: false,
    filePath: null,
  })

  // File view dialog state
  const [fileViewDialog, setFileViewDialog] = useState<{
    isOpen: boolean
    filePath: string | null
  }>({
    isOpen: false,
    filePath: null,
  })

  // File diff dialog state
  const [fileDiffDialog, setFileDiffDialog] = useState<{
    isOpen: boolean
    commit1: string | null
    commit2: string | null
    filePath: string | null
  }>({
    isOpen: false,
    commit1: null,
    commit2: null,
    filePath: null,
  })

  // Fetch tree data
  const { data: treeData, isLoading: treeLoading, error: treeError, refetch: refetchTree } = useGitTreeQuery(
    selectedRepository,
    { enabled: !!selectedRepository }
  )

  // Load repositories
  const loadRepositories = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiCall<{ repositories: Repository[] }>('git-repositories/')
      if (response?.repositories) {
        // Filter only device_configs repositories
        const configRepos = response.repositories.filter(repo => repo.category === 'device_configs')
        setRepositories(configRepos)

        // Auto-select first repository if available
        if (configRepos.length > 0 && configRepos[0] && selectedRepository === null) {
          setSelectedRepository(configRepos[0].id)
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load repositories'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [apiCall, selectedRepository])

  // Load repositories on mount
  useEffect(() => {
    loadRepositories()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handlers
  const handleRepositoryChange = useCallback((value: string) => {
    const repoId = value ? parseInt(value) : null
    setSelectedRepository(repoId)
    setSelectedDirectoryPath('') // Reset to root directory
  }, [])

  const handleDirectorySelect = useCallback((path: string) => {
    setSelectedDirectoryPath(path)
  }, [])

  // Handle global search
  const handleGlobalSearch = useCallback(async (searchText: string) => {
    setGlobalSearchText(searchText)
    
    if (!selectedRepository || !searchText.trim()) {
      setSearchResults(null)
      return
    }

    try {
      setIsSearching(true)
      const response = await apiCall<{
        success: boolean
        data: {
          files: Array<{name: string, path: string, directory: string}>
          filtered_count: number
        }
      }>(`git/${selectedRepository}/files/search?query=${encodeURIComponent(searchText)}&limit=1000`)
      
      if (response?.data?.files) {
        // Extract unique directories from search results
        const directories = new Set<string>()
        response.data.files.forEach(file => {
          if (file.directory) {
            directories.add(file.directory)
            // Also add parent directories
            const parts = file.directory.split('/')
            let currentPath = ''
            parts.forEach(part => {
              currentPath = currentPath ? `${currentPath}/${part}` : part
              directories.add(currentPath)
            })
          } else {
            directories.add('') // Root directory
          }
        })
        
        setSearchResults({
          directories,
          files: response.data.files
        })
      }
    } catch (err) {
      console.error('Search failed:', err)
      setSearchResults(null)
    } finally {
      setIsSearching(false)
    }
  }, [selectedRepository, apiCall])

  // Debounce global search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleGlobalSearch(globalSearchText)
    }, 300)
    return () => clearTimeout(timer)
  }, [globalSearchText, handleGlobalSearch])

  const handleShowHistory = useCallback((file: FileWithCommit) => {
    setFileHistoryDialog({
      isOpen: true,
      filePath: file.path,
    })
  }, [])

  const handleViewFile = useCallback((file: FileWithCommit) => {
    setFileViewDialog({
      isOpen: true,
      filePath: file.path,
    })
  }, [])

  const handleDownloadFile = useCallback(async (file: FileWithCommit) => {
    if (!selectedRepository || !file.path) return

    try {
      const headers: Record<string, string> = {
        'Accept': 'text/plain',
      }
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(`/api/proxy/git/${selectedRepository}/file-content?path=${encodeURIComponent(file.path)}`, {
        headers,
      })
      
      if (!response.ok) {
        throw new Error('Failed to download file')
      }
      
      // The proxy returns JSON-encoded text, so parse it first
      const content = await response.json()
      const blob = new Blob([content], { type: 'text/plain' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Download failed:', err)
      alert('Failed to download file')
    }
  }, [selectedRepository, token])

  const handleCloseHistory = useCallback(() => {
    setFileHistoryDialog({
      isOpen: false,
      filePath: null,
    })
  }, [])

  const handleCloseViewFile = useCallback(() => {
    setFileViewDialog({
      isOpen: false,
      filePath: null,
    })
  }, [])

  const handleCompare = useCallback((commit1: string, commit2: string, filePath: string) => {
    setFileDiffDialog({
      isOpen: true,
      commit1,
      commit2,
      filePath,
    })
  }, [])

  const handleCloseDiff = useCallback(() => {
    setFileDiffDialog({
      isOpen: false,
      commit1: null,
      commit2: null,
      filePath: null,
    })
  }, [])

  const handleRefresh = useCallback(() => {
    loadRepositories()
    if (selectedRepository) {
      refetchTree()
    }
  }, [loadRepositories, selectedRepository, refetchTree])

  if (loading && repositories.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading repositories...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Eye className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Config File Browser</h1>
            <p className="text-gray-600 mt-1">Browse and compare configuration files from Git repositories</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center space-x-2">
          <Button
            onClick={handleRefresh}
            variant="outline"
            disabled={loading}
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2" />
            ) : (
              <RotateCcw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* Repository Selection */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <FolderTree className="h-4 w-4" />
            <span className="text-sm font-medium">Repository Selection</span>
          </div>
          <div className="text-xs text-blue-100">
            Select a Git repository to browse device configuration files
          </div>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50">
          <div className="flex items-center gap-4">
            <Label htmlFor="repository-select" className="text-sm font-medium whitespace-nowrap">
              Select Repository:
            </Label>
            <Select
              value={selectedRepository?.toString() || ""}
              onValueChange={handleRepositoryChange}
            >
              <SelectTrigger className="w-96 border-2 border-gray-400 shadow-sm" id="repository-select">
                <SelectValue placeholder="Select a config repository..." />
              </SelectTrigger>
              <SelectContent>
                {repositories.map((repo) => (
                  <SelectItem key={repo.id} value={repo.id.toString()}>
                    {repo.name} {repo.description && `- ${repo.description}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRepository && (
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search files in repository..."
                  value={globalSearchText}
                  onChange={(e) => setGlobalSearchText(e.target.value)}
                  className="pl-9 border-2 border-gray-300 focus:border-blue-400"
                />
                {isSearching && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                  </div>
                )}
              </div>
            )}
            {repositories.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No config repositories found. Configure repositories in Settings → Git Management.
              </p>
            )}
          </div>
          {searchResults && searchResults.files.length > 0 && (
            <div className="mt-3 text-sm text-muted-foreground">
              Found {searchResults.files.length} matching file{searchResults.files.length !== 1 ? 's' : ''} in {searchResults.directories.size} director{searchResults.directories.size !== 1 ? 'ies' : 'y'}
            </div>
          )}
          {globalSearchText && searchResults && searchResults.files.length === 0 && (
            <div className="mt-3 text-sm text-amber-600">
              No files found matching "{globalSearchText}"
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {(error || treeError) && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive">
              <span>{error || (treeError instanceof Error ? treeError.message : 'Error loading tree')}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* File Browser */}
      {selectedRepository && (
        <div className="shadow-lg border-0 p-0 bg-white rounded-lg h-[calc(100vh-400px)] min-h-[600px] flex flex-col">
          <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg flex-shrink-0">
            <div className="flex items-center space-x-2">
              <FolderTree className="h-4 w-4" />
              <span className="text-sm font-medium">Configuration File Browser</span>
            </div>
            <div className="text-xs text-blue-100">
              Browse directory structure and view configuration files
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <ResizableLayout
              defaultLeftWidth={300}
              minLeftWidth={200}
              maxLeftWidth={600}
              leftPanel={
                <div className="flex flex-col h-full overflow-hidden border-r">
                  <div className="bg-gray-100 px-4 py-2 border-b flex-shrink-0">
                    <h3 className="text-sm font-medium text-gray-700">Directory Structure</h3>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    {treeLoading ? (
                      <div className="flex items-center justify-center h-64">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                          <p className="mt-2 text-sm text-muted-foreground">Loading tree...</p>
                        </div>
                      </div>
                    ) : (
                      <FileTree
                        tree={treeData || null}
                        selectedPath={selectedDirectoryPath}
                        onDirectorySelect={handleDirectorySelect}
                        highlightedDirectories={searchResults?.directories}
                      />
                    )}
                  </div>
                </div>
              }
              rightPanel={
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 border-b flex-shrink-0">
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="text-sm font-medium text-gray-700">
                        Files in: {selectedDirectoryPath || '/'}
                      </h3>
                      <div className="relative w-64">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Filter files..."
                          value={filterText}
                          onChange={(e) => setFilterText(e.target.value)}
                          className="pl-8 h-8 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <FileList
                      repoId={selectedRepository}
                      directoryPath={selectedDirectoryPath}
                      filterText={filterText}
                      onShowHistory={handleShowHistory}
                      onViewFile={handleViewFile}
                      onDownloadFile={handleDownloadFile}
                    />
                  </div>
                </div>
              }
            />
          </div>
        </div>
      )}

      {/* File History Dialog */}
      <FileHistoryDialog
        isOpen={fileHistoryDialog.isOpen}
        onClose={handleCloseHistory}
        repoId={selectedRepository}
        filePath={fileHistoryDialog.filePath}
        onCompare={handleCompare}
      />

      {/* File View Dialog */}
      <FileViewDialog
        isOpen={fileViewDialog.isOpen}
        onClose={handleCloseViewFile}
        repoId={selectedRepository}
        filePath={fileViewDialog.filePath}
        onDownload={() => {
          if (fileViewDialog.filePath) {
            handleDownloadFile({ path: fileViewDialog.filePath, name: fileViewDialog.filePath.split('/').pop() || '' } as FileWithCommit)
          }
        }}
      />

      {/* File Diff Dialog */}
      <FileDiffDialog
        isOpen={fileDiffDialog.isOpen}
        onClose={handleCloseDiff}
        repoId={selectedRepository}
        commit1={fileDiffDialog.commit1}
        commit2={fileDiffDialog.commit2}
        filePath={fileDiffDialog.filePath}
      />
    </div>
  )
}
