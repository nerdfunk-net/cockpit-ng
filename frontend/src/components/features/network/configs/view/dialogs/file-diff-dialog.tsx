'use client'

import { useMemo } from 'react'
import { GitCompare } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useFileDiffQuery } from '@/hooks/queries/use-file-diff-query'

interface FileDiffDialogProps {
  isOpen: boolean
  onClose: () => void
  repoId: number | null
  commit1: string | null
  commit2: string | null
  filePath: string | null
}

export function FileDiffDialog({
  isOpen,
  onClose,
  repoId,
  commit1,
  commit2,
  filePath,
}: FileDiffDialogProps) {
  const { data, isLoading, error } = useFileDiffQuery(
    repoId,
    commit1,
    commit2,
    filePath,
    { enabled: isOpen }
  )

  const getLineClassName = useMemo(() => {
    return (type: string): string => {
      switch (type) {
        case 'insert':
          return 'bg-green-50 dark:bg-green-950/30'
        case 'delete':
          return 'bg-red-50 dark:bg-red-950/30'
        case 'replace':
          return 'bg-yellow-50 dark:bg-yellow-950/30'
        default:
          return ''
      }
    }
  }, [])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            File Comparison
          </DialogTitle>
          <DialogDescription>
            {filePath && (
              <span className="font-mono text-xs">{filePath}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Loading diff...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center text-destructive">
              <p className="text-sm">Error loading diff</p>
              <p className="text-xs text-muted-foreground mt-1">
                {error instanceof Error ? error.message : 'Unknown error'}
              </p>
            </div>
          </div>
        )}

        {data && (
          <>
            {/* Commit info header */}
            <div className="grid grid-cols-2 gap-4 px-6 pb-4 border-b flex-shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    {data.commit1}
                  </Badge>
                  <span className="text-sm font-medium">(Old)</span>
                </div>
                <p className="text-xs text-muted-foreground">{data.left_file}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    {data.commit2}
                  </Badge>
                  <span className="text-sm font-medium">(New)</span>
                </div>
                <p className="text-xs text-muted-foreground">{data.right_file}</p>
              </div>
            </div>

            {/* Diff content */}
            <ScrollArea className="flex-1 h-[60vh]">
              <div className="grid grid-cols-2 divide-x">
                {/* Left side (old) */}
                <div className="font-mono text-xs">
                  {data.left_lines.map((line, idx) => (
                    <div
                      key={`left-${idx}`}
                      className={`flex ${getLineClassName(line.type)}`}
                    >
                      <span className="px-2 py-1 text-muted-foreground select-none w-12 text-right flex-shrink-0">
                        {line.line_number}
                      </span>
                      <span className="px-2 py-1 flex-1 whitespace-pre-wrap break-all">
                        {line.content || ' '}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Right side (new) */}
                <div className="font-mono text-xs">
                  {data.right_lines.map((line, idx) => (
                    <div
                      key={`right-${idx}`}
                      className={`flex ${getLineClassName(line.type)}`}
                    >
                      <span className="px-2 py-1 text-muted-foreground select-none w-12 text-right flex-shrink-0">
                        {line.line_number}
                      </span>
                      <span className="px-2 py-1 flex-1 whitespace-pre-wrap break-all">
                        {line.content || ' '}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollArea>

            {/* Stats footer */}
            <div className="px-6 py-4 border-t flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-green-600 dark:text-green-400">
                  +{data.stats.additions} additions
                </span>
                <span className="text-red-600 dark:text-red-400">
                  -{data.stats.deletions} deletions
                </span>
                <span className="text-muted-foreground">
                  {data.stats.changes} changes
                </span>
              </div>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
