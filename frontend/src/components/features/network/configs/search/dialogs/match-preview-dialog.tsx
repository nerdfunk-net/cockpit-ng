'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useApi } from '@/hooks/use-api'
import type { PreviewMatch } from '../types'

interface MatchPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  repoId: number | null
  preview: PreviewMatch | null
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
  repoId,
  preview,
}: MatchPreviewDialogProps) {
  const { apiCall } = useApi()
  const [content, setContent] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Match Preview
          </DialogTitle>
          <DialogDescription>
            {preview && (
              <span className="font-mono text-xs block mt-1">{preview.match.file_path}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        )}

        {error && (
          <div className="text-center py-8 text-destructive text-sm" role="alert">
            {error}
          </div>
        )}

        {!isLoading && !error && content && preview && (
          <ScrollArea className="flex-1 max-h-[60vh] rounded-lg border">
            <pre className="text-sm font-mono p-4">
              {renderedLines.map(({ lineNumber, line, isMatchLine }) => {
                const highlighted = highlightLine(line, preview.query, false)
                const parts = highlighted.split(/<<mark>>|<\/mark>>/)

                return (
                  <div
                    key={lineNumber}
                    className={
                      isMatchLine
                        ? 'bg-amber-100 -mx-4 px-4 py-0.5 border-l-4 border-amber-500'
                        : undefined
                    }
                  >
                    <span className="inline-block w-10 text-right text-muted-foreground mr-3 select-none">
                      {lineNumber}
                    </span>
                    {(() => {
                      let offset = 0
                      let isMark = false

                      return parts.map(part => {
                        const key = `${lineNumber}-${offset}`
                        offset += part.length
                        const node = isMark ? (
                          <mark key={key} className="bg-yellow-300 px-0.5 rounded-sm">
                            {part}
                          </mark>
                        ) : (
                          <span key={key}>{part}</span>
                        )
                        isMark = !isMark
                        return node
                      })
                    })()}
                  </div>
                )
              })}
            </pre>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
