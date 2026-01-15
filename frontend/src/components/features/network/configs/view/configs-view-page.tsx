'use client'

import { useState, useCallback, useEffect } from 'react'
import { Eye, RotateCcw, FolderTree } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useApi } from '@/hooks/use-api'
import { useGitTreeQuery } from '@/hooks/queries/use-git-tree-query'
import { FileTree } from './components/file-tree'
import { FileList } from './components/file-list'
import { ResizableLayout } from './components/resizable-layout'
import { FileHistoryDialog } from './dialogs/file-history-dialog'
import { FileDiffDialog } from './dialogs/file-diff-dialog'
import type { Repository, FileWithCommit } from './types'

const EMPTY_ARRAY: Repository[] = []

export default function ConfigsViewPage() {
  const { apiCall } = useApi()

  // State
  const [repositories, setRepositories] = useState<Repository[]>(EMPTY_ARRAY)
  const [selectedRepository, setSelectedRepository] = useState<number | null>(null)
  const [selectedDirectoryPath, setSelectedDirectoryPath] = useState<string>('')
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

  const handleShowHistory = useCallback((file: FileWithCommit) => {
    setFileHistoryDialog({
      isOpen: true,
      filePath: file.path,
    })
  }, [])

  const handleCloseHistory = useCallback(() => {
    setFileHistoryDialog({
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderTree className="h-5 w-5" />
            Repository Selection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Label htmlFor="repository-select" className="text-sm font-medium">
              Select Repository:
            </Label>
            <Select
              value={selectedRepository?.toString() || ""}
              onValueChange={handleRepositoryChange}
            >
              <SelectTrigger className="w-64">
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
            {repositories.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No config repositories found. Configure repositories in Settings → Git Management.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

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
        <Card className="h-[calc(100vh-400px)] min-h-[600px]">
          <CardContent className="p-0 h-full">
            <ResizableLayout
              defaultLeftWidth={300}
              minLeftWidth={200}
              maxLeftWidth={600}
              leftPanel={
                <div className="flex flex-col h-full overflow-hidden border-r">
                  <div className="bg-muted/50 px-4 py-2 border-b flex-shrink-0">
                    <h3 className="text-sm font-semibold">Directory Structure</h3>
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
                      />
                    )}
                  </div>
                </div>
              }
              rightPanel={
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="bg-muted/50 px-4 py-2 border-b flex-shrink-0">
                    <h3 className="text-sm font-semibold">
                      Files in: {selectedDirectoryPath || '/'}
                    </h3>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <FileList
                      repoId={selectedRepository}
                      directoryPath={selectedDirectoryPath}
                      onShowHistory={handleShowHistory}
                    />
                  </div>
                </div>
              }
            />
          </CardContent>
        </Card>
      )}

      {/* File History Dialog */}
      <FileHistoryDialog
        isOpen={fileHistoryDialog.isOpen}
        onClose={handleCloseHistory}
        repoId={selectedRepository}
        filePath={fileHistoryDialog.filePath}
        onCompare={handleCompare}
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
