'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Eye, FileText, Loader2, XCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useApi } from '@/hooks/use-api'
import type { ConfigContentSearchMatch, PreviewMatch } from '../types'

interface MatchPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  repoId: number | null
  preview: PreviewMatch | null
}

function sourceBadgeClass(source: ConfigContentSearchMatch['match_source']): string {
  switch (source) {
    case 'history':
      return 'bg-purple-100 text-purple-800 border-purple-300'
    case 'diff':
      return 'bg-amber-100 text-amber-800 border-amber-300'
    default:
      return 'bg-blue-100 text-blue-800 border-blue-300'
  }
}

function highlightLine(line: string, query: string, caseSensitive: boolean): string {
  if (!query.trim()) {
    return line
  }

  const source = caseSensitive ? line : line.toLowerCase()
  const needle = caseSensitive ? query : query.toLowerCase()
  const index = source.indexOf(needle)
  if (index === -1) {
    return line
  }

  const before = line.slice(0, index)
  const match = line.slice(index, index + query.length)
  const after = line.slice(index + query.length)
  return `${before}<<mark>>${match}<</mark>>${after}`
}

export function MatchPreviewDialog({
  open,
  onOpenChange,
  preview,
  repoId,
}: MatchPreviewDialogProps) {
  const { apiCall } = useApi()
  const [content, setContent] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const matchLineRef = useRef<HTMLDivElement>(null)

  const loadContent = useCallback(async () => {
    if (!open || !repoId || !preview) {
      return
    }

    setIsLoading(true)
    setError(null)
    setContent(null)

    try {
      const { match } = preview

      if (match.match_source === 'history' && match.commit) {
        const response = await apiCall<{ content: string }>(
          `git/${repoId}/files/${match.commit}/commit?file_path=${encodeURIComponent(match.file_path)}`
        )
        setContent(response.content)
      } else if (match.match_source === 'diff' && match.commit?.includes('..')) {
        const [older, newer] = match.commit.split('..')
        const commitHash = match.change_type === 'remove' ? older : newer
        const response = await apiCall<{ content: string }>(
          `git/${repoId}/files/${commitHash}/commit?file_path=${encodeURIComponent(match.file_path)}`
        )
        setContent(response.content)
      } else {
        const response = await apiCall<string>(
          `git/${repoId}/file-content?path=${encodeURIComponent(match.file_path)}`,
          {
            method: 'GET',
            headers: { Accept: 'text/plain' },
          }
        )
        setContent(typeof response === 'string' ? response : String(response))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file content')
    } finally {
      setIsLoading(false)
    }
  }, [apiCall, open, preview, repoId])

  useEffect(() => {
    loadContent()
  }, [loadContent])

  useEffect(() => {
    if (!open) {
      setContent(null)
      setError(null)
      setIsLoading(false)
    }
  }, [open])

  const renderedLines = useMemo(() => {
    if (!content || !preview) {
      return []
    }

    return content.split('\n').map((line, index) => ({
      lineNumber: index + 1,
      line,
      isMatchLine: index + 1 === preview.match.line_number,
    }))
  }, [content, preview])

  const lineCount = content ? content.split('\n').length : 0

  useEffect(() => {
    if (!isLoading && content && preview && matchLineRef.current) {
      matchLineRef.current.scrollIntoView({ block: 'center', behavior: 'instant' })
    }
  }, [content, isLoading, preview])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[63vw] w-[63vw] h-[85vh] max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Match Preview</DialogTitle>
          <DialogDescription>
            Preview config file content around the search match
          </DialogDescription>
        </DialogHeader>

        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 pr-14 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center gap-2 min-w-0">
            <Eye className="h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <span className="text-sm font-medium">Match Preview</span>
              {preview && (
                <p className="text-xs text-blue-100 font-mono break-all">
                  {preview.match.file_path}
                </p>
              )}
            </div>
          </div>
          {preview && (
            <div className="text-xs text-blue-100 shrink-0 ml-4 text-right">
              Line {preview.match.line_number}
              {preview.match.commit ? ` · ${preview.match.commit}` : ''}
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 flex flex-col p-6 bg-gradient-to-b from-white to-gray-50 overflow-hidden">
          {preview && !isLoading && !error && (
            <div className="flex flex-wrap items-center gap-2 mb-4 shrink-0">
              <Badge className={sourceBadgeClass(preview.match.match_source)}>
                {preview.match.match_source}
              </Badge>
              {preview.match.change_type && (
                <Badge variant="outline">{preview.match.change_type}</Badge>
              )}
              {preview.query && (
                <span className="text-xs text-muted-foreground">
                  Search:{' '}
                  <code className="font-mono bg-muted px-1.5 py-0.5 rounded">
                    {preview.query}
                  </code>
                </span>
              )}
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              <span className="ml-2 text-sm text-muted-foreground">
                Loading file content...
              </span>
            </div>
          )}

          {error && (
            <Alert className="bg-red-50 border-red-200" role="alert">
              <XCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}

          {!isLoading && !error && content && preview && (
            <div className="shadow-lg border-0 p-0 bg-white rounded-lg flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center gap-2 rounded-t-lg shrink-0">
                <FileText className="h-4 w-4" />
                <span className="text-sm font-medium">File Content</span>
                <span className="text-xs text-blue-100 ml-auto">
                  {lineCount} line{lineCount !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex-1 min-h-0 overflow-auto p-3 bg-gradient-to-b from-white to-gray-50">
                  <pre className="text-xs font-mono leading-relaxed min-w-max">
                    {renderedLines.map(({ lineNumber, line, isMatchLine }) => {
                      const highlighted = highlightLine(line, preview.query, false)
                      const parts = highlighted.split(/<<mark>>|<\/mark>>/)

                      return (
                        <div
                          key={lineNumber}
                          ref={isMatchLine ? matchLineRef : undefined}
                          className={
                            isMatchLine
                              ? 'bg-amber-50 -mx-3 px-3 py-px border-l-4 border-amber-500 whitespace-pre'
                              : 'whitespace-pre'
                          }
                        >
                          <span className="inline-block min-w-[3.5rem] text-right text-muted-foreground mr-3 select-none tabular-nums">
                            {lineNumber}
                          </span>
                          {parts.map((part, partIndex) => {
                            const isHighlighted = partIndex % 2 === 1
                            const key = `${lineNumber}-${partIndex}`

                            if (isHighlighted) {
                              return (
                                <mark
                                  key={key}
                                  className="bg-amber-200 text-amber-900 px-0.5 rounded-sm"
                                >
                                  {part}
                                </mark>
                              )
                            }

                            return <span key={key}>{part}</span>
                          })}
                        </div>
                      )
                    })}
                  </pre>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-background shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
