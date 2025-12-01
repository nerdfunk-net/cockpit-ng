'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  File,
  GitCompare,
  Download,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  RefreshCw
} from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import {
  useGitRepositories,
  useFileSearch,
  useDiffNavigation
} from '@/hooks/git'
import {
  RepositorySelector,
  FileSearchInput,
  DiffControls
} from './shared'
import {
  getLeftLineClass,
  getRightLineClass
} from '@/lib/compare-utils'
import type {
  FileItem,
  DiffLine
} from '@/types/git'

// File compare specific result type
interface ComparisonResult {
  success: boolean
  left_lines: DiffLine[]
  right_lines: DiffLine[]
  diff: string
  left_file: string
  right_file: string
}

// Helper function to calculate stats from diff lines
function calculateStats(leftLines: DiffLine[], rightLines: DiffLine[]) {
  let added = 0
  let removed = 0
  let modified = 0
  let unchanged = 0

  // Safety checks for undefined arrays
  if (!leftLines || !rightLines) {
    return { added: 0, removed: 0, modified: 0, unchanged: 0 }
  }

  // Count from right lines (additions and modifications)
  rightLines.forEach(line => {
    if (line.type === 'insert') added++
    else if (line.type === 'replace') modified++
    else if (line.type === 'equal') unchanged++
  })

  // Count from left lines (deletions)
  leftLines.forEach(line => {
    if (line.type === 'delete') removed++
  })

  return { added, removed, modified, unchanged }
}

// Helper function to merge left and right lines into a unified diff view
function mergeLinesToUnified(leftLines: DiffLine[], rightLines: DiffLine[]): DiffLine[] {
  const unified: DiffLine[] = []
  
  // Simple approach: combine all lines and sort by their appearance
  // First add all deletions, then all additions, then equal lines
  leftLines.forEach(line => {
    if (line.type === 'delete') {
      unified.push(line)
    }
  })
  
  rightLines.forEach(line => {
    if (line.type === 'insert' || line.type === 'replace') {
      unified.push(line)
    }
  })
  
  // Add equal lines from either side
  leftLines.forEach(line => {
    if (line.type === 'equal') {
      unified.push(line)
    }
  })
  
  return unified
}

export default function FileCompare() {
  const { apiCall } = useApi()

  // Use custom hooks
  const { repositories, selectedRepo, setSelectedRepo } = useGitRepositories()
  const diffNav = useDiffNavigation()

  // File selection state
  const [leftFiles, setLeftFiles] = useState<FileItem[]>([])
  const [rightFiles, setRightFiles] = useState<FileItem[]>([])
  const leftFileSearch = useFileSearch(leftFiles)
  const rightFileSearch = useFileSearch(rightFiles)

  // Memoized callback for repository changes
  // NOTE: setState functions are stable, and we access the methods directly
  const handleRepoChange = useCallback((repo: typeof selectedRepo) => {
    setSelectedRepo(repo)
    leftFileSearch.clearSelection()
    rightFileSearch.clearSelection()
  }, [setSelectedRepo, leftFileSearch, rightFileSearch])

  // Comparison state
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null)
  const [showComparison, setShowComparison] = useState(false)
  const [loading, setLoading] = useState(false)

  // Load files when repository changes
  const loadFiles = useCallback(async () => {
    if (!selectedRepo) {
      setLeftFiles([])
      setRightFiles([])
      return
    }

    try {
      const response = await apiCall<{files: FileItem[]}>(`file-compare/list?repo_id=${selectedRepo.id}`)
      const files = Array.isArray(response?.files) ? response.files : []
      setLeftFiles(files)
      setRightFiles(files)
    } catch (error) {
      console.error('Error loading files:', error)
      // Ensure we always have arrays even on error
      setLeftFiles([])
      setRightFiles([])
    }
  }, [selectedRepo, apiCall])

  useEffect(() => {
    if (selectedRepo) {
      loadFiles()
    } else {
      setLeftFiles([])
      setRightFiles([])
      leftFileSearch.clearSelection()
      rightFileSearch.clearSelection()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRepo, loadFiles])

  const canCompare = () => {
    return selectedRepo && leftFileSearch.selectedFile && rightFileSearch.selectedFile
  }

  const handleCompare = async () => {
    if (!canCompare()) return

    setLoading(true)
    try {
      const response = await apiCall<ComparisonResult>('file-compare/compare', {
        method: 'POST',
        body: JSON.stringify({
          left_file: leftFileSearch.selectedFile!.path,
          right_file: rightFileSearch.selectedFile!.path,
          repo_id: selectedRepo!.id
        })
      })

      setComparisonResult(response)
      setShowComparison(true)
      diffNav.setCurrentIndex(0)
    } catch (error) {
      console.error('Error comparing files:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportDiff = () => {
    if (!comparisonResult) return

    // file-compare needs custom export due to mergeLinesToUnified
    const unifiedDiff = mergeLinesToUnified(comparisonResult.left_lines, comparisonResult.right_lines)
    const diffContent = unifiedDiff
      .filter(line => !diffNav.hideUnchanged || line.type !== 'equal')
      .map(line => `${getDiffPrefix(line.type)}${line.content}`)
      .join('\n')

    const blob = new Blob([`--- ${comparisonResult.left_file}\n+++ ${comparisonResult.right_file}\n${diffContent}`], {
      type: 'text/plain'
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `diff-${Date.now()}.patch`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const navigateDiff = (direction: 'next' | 'prev') => {
    if (!comparisonResult) return

    const visibleDiffs = comparisonResult.left_lines.filter(d => d.type !== 'equal')
    const maxIndex = visibleDiffs.length - 1

    if (direction === 'next' && diffNav.currentIndex < maxIndex) {
      diffNav.setCurrentIndex(diffNav.currentIndex + 1)
    } else if (direction === 'prev' && diffNav.currentIndex > 0) {
      diffNav.setCurrentIndex(diffNav.currentIndex - 1)
    }
  }

  const getDiffPrefix = (type: DiffLine['type']) => {
    switch (type) {
      case 'insert': return '+ '
      case 'delete': return '- '
      case 'replace': return '~ '
      case 'equal': return '  '
      default: return '  '
    }
  }

  // Side-by-side styling functions

  return (
    <div key="unique-id-fh-1" className="space-y-6">
      {/* Header */}
      <div key="unique-id-fh-2" className="flex items-center justify-between">
        <div key="unique-id-fh-3">
          <h2 key="unique-id-fh-4" className="text-2xl font-bold text-gray-900">File Comparison</h2>
          <p key="unique-id-fh-5" className="text-gray-600 mt-1">Compare two configuration files side by side</p>
        </div>
        <DiffControls
          fontSize={diffNav.fontSize}
          onFontSizeChange={diffNav.setFontSize}
          hideUnchanged={diffNav.hideUnchanged}
          onHideUnchangedToggle={diffNav.toggleHideUnchanged}
          showHideUnchanged={false}
          showExport={false}
        />
      </div>

      {/* File Selection */}
      <div key="unique-id-fh-6" className="rounded-xl border shadow-sm overflow-visible relative z-50">
        <div key="unique-id-fh-7" className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
          <div className="flex items-center space-x-2">
            <File className="h-4 w-4" />
            <div>
              <h3 className="text-sm font-semibold">Select Repository and Files to Compare</h3>
              <p className="text-blue-100 text-xs">Choose repository and source/target configuration files for comparison</p>
            </div>
          </div>
        </div>
        <div key="unique-id-fh-9" className="p-4 bg-white">
          <div key="unique-id-fh-10" className="space-y-4">
            {/* Single Row Layout for Repository and File Selection */}
            <div key="unique-id-fh-row" className="grid grid-cols-3 gap-4">
              <RepositorySelector
                repositories={repositories}
                selectedRepo={selectedRepo}
                onSelectRepo={handleRepoChange}
              />

              <FileSearchInput
                label="Source File"
                placeholder="Search for source file..."
                searchQuery={leftFileSearch.searchQuery}
                onSearchQueryChange={leftFileSearch.setSearchQuery}
                showResults={leftFileSearch.showResults}
                onShowResultsChange={leftFileSearch.setShowResults}
                filteredFiles={leftFileSearch.filteredFiles}
                onFileSelect={leftFileSearch.setSelectedFile}
                searchRef={leftFileSearch.searchRef}
                disabled={!selectedRepo}
              />

              <FileSearchInput
                label="Target File"
                placeholder="Search for target file..."
                searchQuery={rightFileSearch.searchQuery}
                onSearchQueryChange={rightFileSearch.setSearchQuery}
                showResults={rightFileSearch.showResults}
                onShowResultsChange={rightFileSearch.setShowResults}
                filteredFiles={rightFileSearch.filteredFiles}
                onFileSelect={rightFileSearch.setSelectedFile}
                searchRef={rightFileSearch.searchRef}
                disabled={!selectedRepo}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Compare Actions */}
      <div key="unique-id-fh-31" className="rounded-xl border shadow-sm overflow-hidden relative z-10">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
          <div className="flex items-center space-x-2">
            <GitCompare className="h-4 w-4" />
            <div>
              <h3 className="text-sm font-semibold">Compare Actions</h3>
              <p className="text-blue-100 text-xs">Execute comparison and configure display options</p>
            </div>
          </div>
        </div>
        <div key="unique-id-fh-32" className="p-4 bg-white">
          <div key="unique-id-fh-33" className="flex items-center justify-between">
            <div key="unique-id-fh-34" className="flex items-center gap-2">
              <Button 
                key="unique-id-fh-35"
                onClick={handleCompare} 
                disabled={!canCompare() || loading}
                className="flex items-center gap-2"
              >
                {loading ? (
                  <RefreshCw key="unique-id-fh-36" className="h-4 w-4 animate-spin" />
                ) : (
                  <GitCompare key="unique-id-fh-37" className="h-4 w-4" />
                )}
                <span key="unique-id-fh-38">Compare Files</span>
              </Button>
              
              {comparisonResult && (
                <Button 
                  key="unique-id-fh-39"
                  variant="outline" 
                  onClick={exportDiff}
                  className="flex items-center gap-2"
                >
                  <Download key="unique-id-fh-40" className="h-4 w-4" />
                  <span key="unique-id-fh-41">Export Diff</span>
                </Button>
              )}
            </div>

            <div key="unique-id-fh-42" className="flex items-center gap-2">
              <Button
                key="unique-id-fh-43"
                variant="outline"
                size="sm"
                onClick={() => diffNav.setHideUnchanged(!diffNav.hideUnchanged)}
                className="flex items-center gap-2"
              >
                {diffNav.hideUnchanged ? <Eye key="unique-id-fh-44" className="h-4 w-4" /> : <EyeOff key="unique-id-fh-45" className="h-4 w-4" />}
                <span key="unique-id-fh-46">{diffNav.hideUnchanged ? 'Show' : 'Hide'} Unchanged</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Results */}
      {showComparison && comparisonResult && (
        <div key="unique-id-fh-47" className="rounded-xl border shadow-sm overflow-hidden">
          <div key="unique-id-fh-48" className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
            <div key="unique-id-fh-49" className="flex items-center justify-between">
              <div key="unique-id-fh-50">
                <div key="unique-id-fh-51" className="flex items-center gap-2 text-white text-sm">
                  <GitCompare key="unique-id-fh-52" className="h-4 w-4" />
                  <span key="unique-id-fh-53">File Comparison Results</span>
                </div>
                <div key="unique-id-fh-54" className="text-blue-100 mt-1 text-xs">
                  {comparisonResult.left_file} ↔ {comparisonResult.right_file}
                </div>
              </div>
              <div key="unique-id-fh-55" className="flex items-center gap-2">
                <div key="unique-id-fh-56" className="text-sm text-blue-50">
                  {(() => {
                    const stats = calculateStats(comparisonResult.left_lines, comparisonResult.right_lines)
                    return (
                      <>
                        <span key="unique-id-fh-57" className="text-green-200">+{stats.added}</span>
                        <span key="unique-id-fh-58"> </span>
                        <span key="unique-id-fh-59" className="text-red-200">-{stats.removed}</span>
                        <span key="unique-id-fh-60"> </span>
                        <span key="unique-id-fh-61" className="text-yellow-200">~{stats.modified}</span>
                      </>
                    )
                  })()}
                </div>
                <div key="unique-id-fh-62" className="flex items-center gap-1">
                  <Button
                    key="unique-id-fh-63"
                    size="sm"
                    variant="outline"
                    onClick={() => navigateDiff('prev')}
                    disabled={diffNav.currentIndex === 0}
                    className="bg-white/20 border-white/30 text-white hover:bg-white/30"
                  >
                    <ChevronUp key="unique-id-fh-64" className="h-4 w-4" />
                  </Button>
                  <Button
                    key="unique-id-fh-65"
                    size="sm"
                    variant="outline"
                    onClick={() => navigateDiff('next')}
                    disabled={(() => {
                      const visibleDiffs = comparisonResult.left_lines.filter(d => d.type !== 'equal')
                      return diffNav.currentIndex >= visibleDiffs.length - 1
                    })()}
                    className="bg-white/20 border-white/30 text-white hover:bg-white/30"
                  >
                    <ChevronDown key="unique-id-fh-66" className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  key="unique-id-fh-67"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowComparison(false)}
                  className="bg-white/20 border-white/30 text-white hover:bg-white/30"
                >
                  <span key="unique-id-fh-68">Close</span>
                </Button>
              </div>
            </div>
          </div>
          <div key="unique-id-fh-69" className="p-4 bg-white">
            <div
              key="unique-id-fh-70"
              className="border rounded-lg overflow-auto font-mono"
              style={{ fontSize: `${diffNav.fontSize}px`, maxHeight: '600px' }}
            >
              {/* Side-by-side comparison header */}
              <div key="unique-id-fh-header" className="grid grid-cols-2 bg-gray-100 border-b sticky top-0" style={{ fontSize: `${Math.max(diffNav.fontSize - 2, 8)}px` }}>
                <div key="unique-id-fh-left-header" className="p-2 border-r font-semibold text-gray-700">
                  Source File: {comparisonResult.left_file}
                </div>
                <div key="unique-id-fh-right-header" className="p-2 font-semibold text-gray-700">
                  Target File: {comparisonResult.right_file}
                </div>
              </div>

              {/* Side-by-side comparison content */}
              {(() => {
                // Create synchronized rows for side-by-side comparison
                const maxLines = Math.max(comparisonResult.left_lines.length, comparisonResult.right_lines.length)
                const rows = []

                for (let i = 0; i < maxLines; i++) {
                  const leftLine = comparisonResult.left_lines[i]
                  const rightLine = comparisonResult.right_lines[i]

                  // Skip if both lines are equal and hideUnchanged is true
                  if (diffNav.hideUnchanged && leftLine?.type === 'equal' && rightLine?.type === 'equal') {
                    continue
                  }
                  
                  rows.push(
                    <div key={`unique-id-fh-row-${i}`} className="grid grid-cols-2 border-b border-gray-200 hover:bg-gray-50">
                      {/* Left side (source file) */}
                      <div key={`unique-id-fh-left-${i}`} className={`flex items-start border-r ${getLeftLineClass(leftLine?.type || 'empty')}`}>
                        <div key={`unique-id-fh-left-num-${i}`} className="flex-shrink-0 w-12 text-gray-500 text-right text-xs p-1 bg-gray-50 border-r">
                          {leftLine?.line_number || ''}
                        </div>
                        <div key={`unique-id-fh-left-content-${i}`} className="flex-1 p-2 whitespace-pre-wrap break-all min-h-[1.4em]">
                          {leftLine?.content || ' '}
                        </div>
                      </div>

                      {/* Right side (target file) */}
                      <div key={`unique-id-fh-right-${i}`} className={`flex items-start ${getRightLineClass(rightLine?.type || 'empty')}`}>
                        <div key={`unique-id-fh-right-num-${i}`} className="flex-shrink-0 w-12 text-gray-500 text-right text-xs p-1 bg-gray-50 border-r">
                          {rightLine?.line_number || ''}
                        </div>
                        <div key={`unique-id-fh-right-content-${i}`} className="flex-1 p-2 whitespace-pre-wrap break-all min-h-[1.4em]">
                          {rightLine?.content || ' '}
                        </div>
                      </div>
                    </div>
                  )
                }
                
                return rows
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
