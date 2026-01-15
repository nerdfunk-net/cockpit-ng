'use client'

import { useMemo, useState } from 'react'
import { GitCompare, Eye, EyeOff, Columns2, List } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useFileDiffQuery } from '@/hooks/queries/use-file-diff-query'
import { getLeftLineClass, getRightLineClass } from '@/lib/compare-utils'

interface FileDiffDialogProps {
  isOpen: boolean
  onClose: () => void
  repoId: number | null
  commit1: string | null
  commit2: string | null
  filePath: string | null
}

interface UnifiedLine {
  leftLineNumber: number | null
  rightLineNumber: number | null
  content: string
  type: 'equal' | 'delete' | 'insert' | 'replace-delete' | 'replace-insert'
  isChange: boolean
}

export function FileDiffDialog({
  isOpen,
  onClose,
  repoId,
  commit1,
  commit2,
  filePath,
}: FileDiffDialogProps) {
  const [viewMode, setViewMode] = useState<'unified' | 'side-by-side'>('unified')
  const [showChangesOnly, setShowChangesOnly] = useState(false)

  const { data, isLoading, error } = useFileDiffQuery(
    repoId,
    commit1,
    commit2,
    filePath,
    { enabled: isOpen }
  )

  // Convert side-by-side diff to unified view
  const unifiedLines = useMemo(() => {
    if (!data) return []

    const unified: UnifiedLine[] = []
    let leftIdx = 0
    let rightIdx = 0

    while (leftIdx < data.left_lines.length || rightIdx < data.right_lines.length) {
      const leftLine = data.left_lines[leftIdx]
      const rightLine = data.right_lines[rightIdx]

      if (!leftLine && rightLine) {
        // Only right line exists (insertion)
        unified.push({
          leftLineNumber: null,
          rightLineNumber: rightLine.line_number,
          content: rightLine.content,
          type: 'insert',
          isChange: true,
        })
        rightIdx++
      } else if (leftLine && !rightLine) {
        // Only left line exists (deletion)
        unified.push({
          leftLineNumber: leftLine.line_number,
          rightLineNumber: null,
          content: leftLine.content,
          type: 'delete',
          isChange: true,
        })
        leftIdx++
      } else if (leftLine && rightLine) {
        if (leftLine.type === 'equal' && rightLine.type === 'equal') {
          // Both lines are equal
          unified.push({
            leftLineNumber: leftLine.line_number,
            rightLineNumber: rightLine.line_number,
            content: leftLine.content,
            type: 'equal',
            isChange: false,
          })
          leftIdx++
          rightIdx++
        } else if (leftLine.type === 'delete' && rightLine.type === 'insert') {
          // Replacement: show deletion then insertion
          unified.push({
            leftLineNumber: leftLine.line_number,
            rightLineNumber: null,
            content: leftLine.content,
            type: 'replace-delete',
            isChange: true,
          })
          unified.push({
            leftLineNumber: null,
            rightLineNumber: rightLine.line_number,
            content: rightLine.content,
            type: 'replace-insert',
            isChange: true,
          })
          leftIdx++
          rightIdx++
        } else if (leftLine.type === 'replace' && rightLine.type === 'replace') {
          // Both marked as replace
          unified.push({
            leftLineNumber: leftLine.line_number,
            rightLineNumber: null,
            content: leftLine.content,
            type: 'replace-delete',
            isChange: true,
          })
          unified.push({
            leftLineNumber: null,
            rightLineNumber: rightLine.line_number,
            content: rightLine.content,
            type: 'replace-insert',
            isChange: true,
          })
          leftIdx++
          rightIdx++
        } else if (leftLine.type === 'delete') {
          unified.push({
            leftLineNumber: leftLine.line_number,
            rightLineNumber: null,
            content: leftLine.content,
            type: 'delete',
            isChange: true,
          })
          leftIdx++
        } else if (rightLine.type === 'insert') {
          unified.push({
            leftLineNumber: null,
            rightLineNumber: rightLine.line_number,
            content: rightLine.content,
            type: 'insert',
            isChange: true,
          })
          rightIdx++
        } else {
          // Fallback: treat as equal
          unified.push({
            leftLineNumber: leftLine.line_number,
            rightLineNumber: rightLine.line_number,
            content: leftLine.content,
            type: 'equal',
            isChange: false,
          })
          leftIdx++
          rightIdx++
        }
      }
    }

    return unified
  }, [data])

  // Filter lines based on showChangesOnly toggle
  const displayLines = useMemo(() => {
    if (!showChangesOnly) return unifiedLines

    const filtered: UnifiedLine[] = []
    const contextLines = 3 // Show 3 lines of context around changes

    for (let i = 0; i < unifiedLines.length; i++) {
      const line = unifiedLines[i]
      if (line && line.isChange) {
        // Add context before
        for (let j = Math.max(0, i - contextLines); j < i; j++) {
          const contextLine = unifiedLines[j]
          if (contextLine && !filtered.includes(contextLine)) {
            filtered.push(contextLine)
          }
        }
        // Add the change line
        filtered.push(line)
        // Add context after
        for (let j = i + 1; j <= Math.min(unifiedLines.length - 1, i + contextLines); j++) {
          const contextLine = unifiedLines[j]
          if (contextLine && !filtered.includes(contextLine)) {
            filtered.push(contextLine)
          }
        }
      }
    }

    return filtered
  }, [unifiedLines, showChangesOnly])

  const getLineClassName = (type: string): string => {
    switch (type) {
      case 'insert':
      case 'replace-insert':
        return 'bg-green-50 dark:bg-green-950/30 border-l-4 border-green-500'
      case 'delete':
      case 'replace-delete':
        return 'bg-red-50 dark:bg-red-950/30 border-l-4 border-red-500'
      default:
        return 'hover:bg-muted/50'
    }
  }

  const getLinePrefix = (type: string): string => {
    switch (type) {
      case 'insert':
      case 'replace-insert':
        return '+'
      case 'delete':
      case 'replace-delete':
        return '-'
      default:
        return ' '
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="!max-w-none flex flex-col p-0 overflow-auto"
        style={{ resize: 'both', width: '80vw', height: '85vh', minWidth: '600px', minHeight: '400px' }}
      >
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
            <div className="px-6 pb-4 border-b flex-shrink-0 space-y-3">
              <div className="grid grid-cols-2 gap-4">
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

              {/* Toggle buttons */}
              <div className="flex items-center justify-between">
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
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setViewMode(viewMode === 'unified' ? 'side-by-side' : 'unified')}
                  >
                    {viewMode === 'unified' ? (
                      <>
                        <Columns2 className="h-4 w-4 mr-2" />
                        Side by Side
                      </>
                    ) : (
                      <>
                        <List className="h-4 w-4 mr-2" />
                        Unified
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowChangesOnly(!showChangesOnly)}
                  >
                    {showChangesOnly ? (
                      <>
                        <Eye className="h-4 w-4 mr-2" />
                        Show All Lines
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-4 w-4 mr-2" />
                        Show Changes Only
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Unified diff content */}
            {viewMode === 'unified' && (
              <ScrollArea className="flex-1 h-[60vh]">
                <div className="font-mono text-xs">
                  {displayLines.map((line, idx) => (
                    <div
                      key={`unified-${idx}`}
                      className={`flex ${getLineClassName(line.type)}`}
                    >
                      <span className="px-2 py-1 text-muted-foreground select-none w-12 text-right flex-shrink-0 border-r">
                        {line.leftLineNumber || ''}
                      </span>
                      <span className="px-2 py-1 text-muted-foreground select-none w-12 text-right flex-shrink-0 border-r">
                        {line.rightLineNumber || ''}
                      </span>
                      <span className="px-2 py-1 text-muted-foreground select-none w-8 flex-shrink-0">
                        {getLinePrefix(line.type)}
                      </span>
                      <span className="px-2 py-1 flex-1 whitespace-pre-wrap break-all">
                        {line.content || ' '}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {/* Side-by-side diff content */}
            {viewMode === 'side-by-side' && (
              <ScrollArea className="flex-1 h-[60vh]">
                <div className="font-mono text-xs">
                  {/* Side-by-side header */}
                  <div className="grid grid-cols-2 bg-gray-100 dark:bg-gray-800 border-b sticky top-0">
                    <div className="p-2 border-r font-semibold text-gray-700 dark:text-gray-300">
                      {data.commit1}: {data.left_file}
                    </div>
                    <div className="p-2 font-semibold text-gray-700 dark:text-gray-300">
                      {data.commit2}: {data.right_file}
                    </div>
                  </div>

                  {/* Side-by-side rows */}
                  {(() => {
                    const maxLines = Math.max(data.left_lines.length, data.right_lines.length)
                    const rows = []
                    
                    for (let i = 0; i < maxLines; i++) {
                      const leftLine = data.left_lines[i]
                      const rightLine = data.right_lines[i]
                      
                      // Skip if both lines are equal and showChangesOnly is true
                      if (showChangesOnly && leftLine?.type === 'equal' && rightLine?.type === 'equal') {
                        continue
                      }
                      
                      rows.push(
                        <div key={`side-by-side-row-${i}`} className="grid grid-cols-2 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                          {/* Left side (old commit) */}
                          <div className={`flex items-start border-r ${getLeftLineClass(leftLine?.type || 'equal')}`}>
                            <div className="flex-shrink-0 w-12 text-gray-500 text-right text-xs p-1 bg-gray-50 dark:bg-gray-800 border-r">
                              {leftLine?.line_number || ''}
                            </div>
                            <div className="flex-1 p-2 whitespace-pre-wrap break-all min-h-[1.4em]">
                              {leftLine?.content || ' '}
                            </div>
                          </div>

                          {/* Right side (new commit) */}
                          <div className={`flex items-start ${getRightLineClass(rightLine?.type || 'equal')}`}>
                            <div className="flex-shrink-0 w-12 text-gray-500 text-right text-xs p-1 bg-gray-50 dark:bg-gray-800 border-r">
                              {rightLine?.line_number || ''}
                            </div>
                            <div className="flex-1 p-2 whitespace-pre-wrap break-all min-h-[1.4em]">
                              {rightLine?.content || ' '}
                            </div>
                          </div>
                        </div>
                      )
                    }
                    
                    return rows
                  })()}
                </div>
              </ScrollArea>
            )}

            {/* Footer */}
            <div className="px-6 py-4 border-t flex items-center justify-between flex-shrink-0">
              <div className="text-sm text-muted-foreground">
                {viewMode === 'unified' 
                  ? `Showing ${displayLines.length} of ${unifiedLines.length} lines`
                  : `Showing ${(() => {
                      if (!showChangesOnly) return Math.max(data.left_lines.length, data.right_lines.length)
                      let count = 0
                      const maxLines = Math.max(data.left_lines.length, data.right_lines.length)
                      for (let i = 0; i < maxLines; i++) {
                        const leftLine = data.left_lines[i]
                        const rightLine = data.right_lines[i]
                        if (!(leftLine?.type === 'equal' && rightLine?.type === 'equal')) {
                          count++
                        }
                      }
                      return count
                    })()} of ${Math.max(data.left_lines.length, data.right_lines.length)} lines`
                }
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
