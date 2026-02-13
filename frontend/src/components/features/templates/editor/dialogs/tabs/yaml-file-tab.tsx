'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RefreshCw, Download } from 'lucide-react'
import { useApi } from '@/hooks/use-api'

interface GitRepository {
  id: number
  name: string
}

interface GitRepositoriesResponse {
  repositories: GitRepository[]
}

interface FileSearchResult {
  name: string
  path: string
  directory: string
}

interface FileSearchResponse {
  success: boolean
  data: {
    files: FileSearchResult[]
    filtered_count: number
  }
}

interface ParsedFileResponse {
  parsed: unknown
  file_path: string
}

interface YamlFileTabProps {
  onAdd: (name: string, value: string) => void
  existingVariableNames: string[]
}

export function YamlFileTab({ onAdd, existingVariableNames }: YamlFileTabProps) {
  const { apiCall } = useApi()
  const [repos, setRepos] = useState<GitRepository[]>([])
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [selectedRepoId, setSelectedRepoId] = useState<string>('')
  const [fileQuery, setFileQuery] = useState('')
  const [files, setFiles] = useState<FileSearchResult[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [selectedFilePath, setSelectedFilePath] = useState('')
  const [variableName, setVariableName] = useState('')
  const [fetching, setFetching] = useState(false)

  // Fetch git repositories on mount
  useEffect(() => {
    let cancelled = false
    const fetchRepos = async () => {
      setLoadingRepos(true)
      try {
        const response = await apiCall<GitRepositoriesResponse>('git-repositories')
        if (!cancelled && response.repositories) {
          setRepos(response.repositories)
        }
      } catch {
        // Silently handle - repos will be empty
      } finally {
        if (!cancelled) setLoadingRepos(false)
      }
    }
    fetchRepos()
    return () => { cancelled = true }
  }, [apiCall])

  // Search files when repo changes or query changes
  useEffect(() => {
    if (!selectedRepoId) {
      setFiles([])
      return
    }
    let cancelled = false
    const searchFiles = async () => {
      setLoadingFiles(true)
      try {
        const query = fileQuery || '.yml'
        const response = await apiCall<FileSearchResponse>(
          `git/${selectedRepoId}/files/search?query=${encodeURIComponent(query)}&limit=30`
        )
        if (!cancelled && response.success) {
          setFiles(response.data.files)
        }
      } catch {
        if (!cancelled) setFiles([])
      } finally {
        if (!cancelled) setLoadingFiles(false)
      }
    }
    const timer = setTimeout(searchFiles, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [apiCall, selectedRepoId, fileQuery])

  // Auto-suggest variable name from file path
  useEffect(() => {
    if (selectedFilePath) {
      const filename = selectedFilePath.split('/').pop() || ''
      const baseName = filename.replace(/\.(ya?ml|json)$/i, '')
      setVariableName(baseName)
    }
  }, [selectedFilePath])

  const nameError = variableName && existingVariableNames.includes(variableName)
    ? 'A variable with this name already exists'
    : ''

  const canFetch = selectedRepoId && selectedFilePath && variableName.trim() && !nameError

  const handleFetch = useCallback(async () => {
    if (!canFetch) return
    setFetching(true)
    try {
      const response = await apiCall<ParsedFileResponse>(
        `git/${selectedRepoId}/file-content-parsed?path=${encodeURIComponent(selectedFilePath)}`
      )
      const jsonValue = JSON.stringify(response.parsed, null, 2)
      onAdd(variableName.trim(), jsonValue)
    } catch (error) {
      // Error will be caught by apiCall's built-in error handling
      console.error('Failed to fetch and parse YAML file:', error)
    } finally {
      setFetching(false)
    }
  }, [canFetch, apiCall, selectedRepoId, selectedFilePath, variableName, onAdd])

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Git Repository</Label>
        <Select value={selectedRepoId} onValueChange={setSelectedRepoId}>
          <SelectTrigger>
            <SelectValue placeholder={loadingRepos ? 'Loading...' : 'Select a repository'} />
          </SelectTrigger>
          <SelectContent>
            {repos.map((repo) => (
              <SelectItem key={repo.id} value={String(repo.id)}>
                {repo.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedRepoId && (
        <div className="space-y-2">
          <Label>Search Files</Label>
          <Input
            placeholder="Search for YAML files..."
            value={fileQuery}
            onChange={(e) => setFileQuery(e.target.value)}
          />
          {loadingFiles && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Searching...
            </div>
          )}
          {!loadingFiles && files.length > 0 && (
            <Select value={selectedFilePath} onValueChange={setSelectedFilePath}>
              <SelectTrigger>
                <SelectValue placeholder="Select a file" />
              </SelectTrigger>
              <SelectContent>
                {files.map((file) => (
                  <SelectItem key={file.path} value={file.path}>
                    {file.path}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {!loadingFiles && files.length === 0 && fileQuery && (
            <p className="text-xs text-muted-foreground">No files found</p>
          )}
        </div>
      )}

      {selectedFilePath && (
        <div className="space-y-2">
          <Label htmlFor="yaml-var-name">Variable Name</Label>
          <Input
            id="yaml-var-name"
            value={variableName}
            onChange={(e) => setVariableName(e.target.value)}
            className={nameError ? 'border-red-300' : ''}
          />
          {nameError && (
            <p className="text-xs text-red-500">{nameError}</p>
          )}
        </div>
      )}

      <Button onClick={handleFetch} disabled={!canFetch || fetching} className="w-full">
        {fetching ? (
          <RefreshCw className="h-4 w-4 animate-spin mr-1" />
        ) : (
          <Download className="h-4 w-4 mr-1" />
        )}
        {fetching ? 'Fetching...' : 'Fetch & Add'}
      </Button>
    </div>
  )
}
