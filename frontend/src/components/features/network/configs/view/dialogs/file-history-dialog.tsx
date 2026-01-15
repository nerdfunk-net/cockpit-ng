'use client'

import { useState, useCallback, useMemo } from 'react'
import { GitCommit, GitCompare } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useFileHistoryQuery } from '@/hooks/queries/use-file-history-query'

interface FileHistoryDialogProps {
  isOpen: boolean
  onClose: () => void
  repoId: number | null
  filePath: string | null
  onCompare: (commit1: string, commit2: string, filePath: string) => void
}

const EMPTY_ARRAY: string[] = []

export function FileHistoryDialog({
  isOpen,
  onClose,
  repoId,
  filePath,
  onCompare,
}: FileHistoryDialogProps) {
  const [selectedCommits, setSelectedCommits] = useState<string[]>(EMPTY_ARRAY)

  const { data, isLoading, error } = useFileHistoryQuery(repoId, filePath, {
    enabled: isOpen && !!repoId && !!filePath,
  })

  const handleCheckboxChange = useCallback((commitHash: string, checked: boolean) => {
    setSelectedCommits(prev => {
      if (checked) {
        if (prev.length >= 2) {
          // Replace the oldest selection
          return [prev[1]!, commitHash]
        }
        return [...prev, commitHash]
      } else {
        return prev.filter(hash => hash !== commitHash)
      }
    })
  }, [])

  const handleCompare = useCallback(() => {
    if (selectedCommits.length === 2 && filePath) {
      onCompare(selectedCommits[0]!, selectedCommits[1]!, filePath)
      onClose()
      setSelectedCommits(EMPTY_ARRAY)
    }
  }, [selectedCommits, filePath, onCompare, onClose])

  const handleClose = useCallback(() => {
    setSelectedCommits(EMPTY_ARRAY)
    onClose()
  }, [onClose])

  const formatDate = useMemo(() => {
    return (isoDate: string): string => {
      try {
        const date = new Date(isoDate)
        return date.toLocaleString()
      } catch {
        return isoDate
      }
    }
  }, [])

  const getChangeTypeVariant = useCallback((changeType: string) => {
    switch (changeType) {
      case 'A':
        return 'default' // Added
      case 'M':
        return 'secondary' // Modified
      case 'D':
        return 'destructive' // Deleted
      default:
        return 'outline'
    }
  }, [])

  const getChangeTypeLabel = useCallback((changeType: string) => {
    switch (changeType) {
      case 'A':
        return 'Added'
      case 'M':
        return 'Modified'
      case 'D':
        return 'Deleted'
      case 'N':
        return 'No Change'
      default:
        return changeType
    }
  }, [])

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="!max-w-[85vw] !w-[85vw] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <GitCommit className="h-5 w-5" />
            File History
          </DialogTitle>
          <DialogDescription>
            {filePath ? (
              <span className="font-mono text-xs">{filePath}</span>
            ) : (
              'View commit history and compare versions'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0 overflow-x-auto">
          {isLoading && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                <p className="mt-2 text-sm text-muted-foreground">Loading history...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center text-destructive">
                <p className="text-sm">Error loading file history</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {error instanceof Error ? error.message : 'Unknown error'}
                </p>
              </div>
            </div>
          )}

          {data && (
            <>
              <div className="flex-shrink-0 mb-2 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {data.total_commits} commit{data.total_commits !== 1 ? 's' : ''} found
                  {selectedCommits.length > 0 && ` • ${selectedCommits.length} selected`}
                </p>
              </div>

              <ScrollArea className="flex-1">
                <table className="w-full min-w-[900px]">
                  <thead className="border-b sticky top-0 bg-background z-10">
                    <tr>
                      <th className="text-left p-3 font-semibold text-sm w-12">Select</th>
                      <th className="text-left p-3 font-semibold text-sm w-32">Commit</th>
                      <th className="text-left p-3 font-semibold text-sm w-24">Type</th>
                      <th className="text-left p-3 font-semibold text-sm max-w-xs">Message</th>
                      <th className="text-left p-3 font-semibold text-sm w-44">Author</th>
                      <th className="text-left p-3 font-semibold text-sm w-48">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.commits.map((commit) => (
                      <tr
                        key={commit.hash}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <td className="p-3">
                          <Checkbox
                            checked={selectedCommits.includes(commit.hash)}
                            onCheckedChange={(checked) =>
                              handleCheckboxChange(commit.hash, checked as boolean)
                            }
                            disabled={
                              selectedCommits.length >= 2 &&
                              !selectedCommits.includes(commit.hash)
                            }
                          />
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="font-mono text-xs">
                            {commit.short_hash}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant={getChangeTypeVariant(commit.change_type)} className="text-xs">
                            {getChangeTypeLabel(commit.change_type)}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <span className="text-sm truncate max-w-md block" title={commit.message}>
                            {commit.message}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="text-sm text-muted-foreground">
                            {commit.author.name}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="text-sm text-muted-foreground">
                            {formatDate(commit.date)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t flex-shrink-0">
          <div className="text-sm text-muted-foreground">
            {selectedCommits.length === 2
              ? 'Ready to compare'
              : `Select ${2 - selectedCommits.length} more commit${2 - selectedCommits.length === 1 ? '' : 's'} to compare`}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCompare}
              disabled={selectedCommits.length !== 2}
            >
              <GitCompare className="h-4 w-4 mr-2" />
              Compare Selected
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
