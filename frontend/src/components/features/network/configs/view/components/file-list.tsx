'use client'

import { useMemo } from 'react'
import { FileText, History, Clock, Eye, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useDirectoryFilesQuery } from '@/hooks/queries/use-directory-files-query'
import type { FileWithCommit } from '../types'

interface FileListProps {
  repoId: number | null
  directoryPath: string
  filterText?: string
  onShowHistory: (file: FileWithCommit) => void
  onViewFile: (file: FileWithCommit) => void
  onDownloadFile: (file: FileWithCommit) => void
}

export function FileList({ repoId, directoryPath, filterText = '', onShowHistory, onViewFile, onDownloadFile }: FileListProps) {
  const { data, isLoading, error } = useDirectoryFilesQuery(repoId, {
    path: directoryPath,
    enabled: !!repoId,
  })

  const formatFileSize = useMemo(() => {
    return (bytes: number): string => {
      if (bytes === 0) return '0 B'
      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
    }
  }, [])

  const formatRelativeTime = useMemo(() => {
    return (timestamp: number): string => {
      const now = Date.now() / 1000
      const diffInSeconds = now - timestamp

      if (diffInSeconds < 60) return 'just now'
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
      if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`
      if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`
      return `${Math.floor(diffInSeconds / 31536000)} years ago`
    }
  }, [])

  const filteredFiles = useMemo(() => {
    const files = data?.files
    if (!files) return []
    if (!filterText.trim()) return files

    const searchTerm = filterText.toLowerCase()
    return files.filter(file =>
      file.name.toLowerCase().includes(searchTerm)
    )
  }, [data, filterText])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading files...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-destructive">
          <p className="text-sm">Error loading files</p>
          <p className="text-xs text-muted-foreground mt-1">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      </div>
    )
  }

  if (!data || !data.directory_exists) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">Directory not found</p>
      </div>
    )
  }

  if (data.files.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">No files in this directory</p>
      </div>
    )
  }

  if (filteredFiles.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">
          No files match &quot;{filterText}&quot;
        </p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full w-full">
      <div className="p-4 min-w-0">
        <table className="w-full">
          <thead className="border-b sticky top-0 bg-background z-10">
            <tr>
              <th className="text-left p-3 font-semibold text-sm">File Name</th>
              <th className="text-left p-3 font-semibold text-sm w-24">Size</th>
              <th className="text-left p-3 font-semibold text-sm">Last Commit</th>
              <th className="text-left p-3 font-semibold text-sm w-40">Date</th>
              <th className="text-left p-3 font-semibold text-sm w-40">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredFiles.map((file) => (
              <tr
                key={file.path}
                className="hover:bg-muted/50 transition-colors"
              >
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    <span className="font-medium text-sm truncate" title={file.name}>
                      {file.name}
                    </span>
                  </div>
                </td>
                <td className="p-3">
                  <span className="text-sm text-muted-foreground font-mono">
                    {formatFileSize(file.size)}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {file.last_commit.short_hash && (
                      <Badge variant="outline" className="font-mono text-xs">
                        {file.last_commit.short_hash}
                      </Badge>
                    )}
                    <span className="text-sm text-muted-foreground truncate max-w-xs" title={file.last_commit.message}>
                      {file.last_commit.message}
                    </span>
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {file.last_commit.timestamp > 0 ? (
                      <span>{formatRelativeTime(file.last_commit.timestamp)}</span>
                    ) : (
                      <span>-</span>
                    )}
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onViewFile(file)}
                      title="View file content"
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onShowHistory(file)}
                      disabled={!file.last_commit.hash}
                      title="View file history"
                    >
                      <History className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDownloadFile(file)}
                      title="Download file"
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ScrollArea>
  )
}
