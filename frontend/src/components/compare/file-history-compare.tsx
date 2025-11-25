'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  GitCommit,
  GitCompare as GitCompareIcon,
  Download,
  Eye,
  ChevronUp,
  ChevronDown,
  RefreshCw
} from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import {
  useGitRepositories,
  useGitBranches,
  useGitCommits,
  useFileSearch,
  useDiffNavigation
} from '@/hooks/git'
import {
  RepositorySelector,
  BranchSelector,
  CommitSelector,
  FileSearchInput,
  DiffControls
} from './shared'
import {
  getLeftLineClass,
  getRightLineClass,
  exportDiffAsText
} from '@/lib/compare-utils'
import type {
  FileItem,
  ComparisonResult as BaseComparisonResult,
  FileHistoryCommit
} from '@/types/git'

// Extend ComparisonResult for file history specific fields
interface ComparisonResult extends BaseComparisonResult {
  current_commit?: FileHistoryCommit
  parent_commit?: FileHistoryCommit | null
}

export default function FileHistoryCompare() {
  const { apiCall } = useApi()

  // Comparison state (must be before hooks that use callbacks)
  const [leftCommit, setLeftCommit] = useState<string>('')
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null)
  const [showComparison, setShowComparison] = useState(false)

  // Memoized callback for branch changes
  const handleBranchChange = useCallback(() => {
    setLeftCommit('')
    setComparisonResult(null)
    setShowComparison(false)
  }, [])

  // IMPORTANT: Memoize options object to ensure stable reference
  const branchOptions = useMemo(() => ({ 
    onBranchChange: handleBranchChange 
  }), [handleBranchChange])

  // Use custom hooks for repository, branch, and commit management
  const { repositories, selectedRepo, setSelectedRepo } = useGitRepositories()
  const { branches, selectedBranch, setSelectedBranch } = useGitBranches(
    selectedRepo?.id || null, 
    branchOptions
  )
  const { commits } = useGitCommits(selectedRepo?.id || null, selectedBranch)

  // File selection state
  const [gitFiles, setGitFiles] = useState<FileItem[]>([])
  const fileSearch = useFileSearch(gitFiles)
  const [loading, setLoading] = useState(false)
  const diffNav = useDiffNavigation()
  
  // Extract stable references to avoid putting entire fileSearch object in deps
  const clearFileSelection = fileSearch.clearSelection
  const selectedFile = fileSearch.selectedFile
  
  // File history state
  const [fileHistory, setFileHistory] = useState<FileHistoryCommit[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [selectedCommits, setSelectedCommits] = useState<string[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  
  // File viewing state
  const [fileContent, setFileContent] = useState<string>('')
  const [showFileView, setShowFileView] = useState(false)
  const [viewingCommit, setViewingCommit] = useState<FileHistoryCommit | null>(null)

  // Load files when repository changes
  const loadFiles = useCallback(async () => {
    if (!selectedRepo) {
      setGitFiles([])
      return
    }

    try {
      console.log('Loading files for repo:', selectedRepo.name)
      const response = await apiCall<{files: FileItem[]}>(`file-compare/list?repo_id=${selectedRepo.id}`)
      console.log('Files loaded:', response.files.length, 'files')
      setGitFiles(response.files)
    } catch (error) {
      console.error('Error loading files:', error)
      setGitFiles([])
    }
  }, [selectedRepo, apiCall])

  // Load files when repository is selected
  useEffect(() => {
    if (selectedRepo) {
      loadFiles()
    } else {
      setGitFiles([])
      clearFileSelection()
    }
  }, [selectedRepo, loadFiles, clearFileSelection])

  const canViewHistory = () => {
    return selectedRepo && leftCommit && leftCommit.trim() !== '' &&
           selectedFile
  }

  const handleViewHistory = async () => {
    if (!selectedFile || !leftCommit || !selectedRepo) return

    setHistoryLoading(true)
    try {
      // Get file history for the selected file starting from the selected source commit
      const response = await apiCall<{commits: FileHistoryCommit[]}>(`git/${selectedRepo.id}/files/${encodeURIComponent(selectedFile.path)}/complete-history?from_commit=${encodeURIComponent(leftCommit)}`)
      setFileHistory(response.commits)
      setShowHistory(true)
      setSelectedCommits([])
    } catch (error) {
      console.error('Error loading file history:', error)
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleCommitSelection = (commitHash: string) => {
    setSelectedCommits(prev => {
      if (prev.includes(commitHash)) {
        return prev.filter(hash => hash !== commitHash)
      } else if (prev.length < 2) {
        return [...prev, commitHash]
      } else if (prev[1]) {
        // Replace the first selected commit with the new one if already 2 selected
        return [prev[1], commitHash]
      } else {
        // Fallback: keep first and add new
        return [prev[0] || commitHash, commitHash]
      }
    })
  }

  const handleShowChanges = async (commitHash: string) => {
    if (!selectedFile || !selectedRepo) return

    setLoading(true)
    try {
      // Get changes for this specific commit
      const response = await apiCall<ComparisonResult>(`git/${selectedRepo.id}/diff`, {
        method: 'POST',
        body: JSON.stringify({
          commit1: `${commitHash}^`, // Parent commit
          commit2: commitHash,
          file_path: selectedFile.path
        })
      })

      // Find the current commit and parent commit info for header display
      const currentCommit = fileHistory.find(c => c.hash === commitHash)
      const currentCommitIndex = fileHistory.findIndex(c => c.hash === commitHash)
      const parentCommit = currentCommitIndex < fileHistory.length - 1 ? fileHistory[currentCommitIndex + 1] : null

      if (currentCommit) {
        // Add commit info to the result for header display
        response.current_commit = currentCommit
        response.parent_commit = parentCommit
      }

      setComparisonResult(response)
      setShowComparison(true)
      diffNav.setCurrentIndex(0)
    } catch (error) {
      console.error('Error showing changes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCompareSelected = async () => {
    if (selectedCommits.length !== 2 || !selectedFile || !selectedRepo) return

    setLoading(true)
    try {
      const response = await apiCall<ComparisonResult>(`git/${selectedRepo.id}/diff`, {
        method: 'POST',
        body: JSON.stringify({
          commit1: selectedCommits[0], // First selected (Selected 1) - left side
          commit2: selectedCommits[1], // Second selected (Selected 2) - right side
          file_path: selectedFile.path
        })
      })

      setComparisonResult(response)
      setShowComparison(true)
      diffNav.setCurrentIndex(0)
    } catch (error) {
      console.error('Error comparing commits:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadCommitVersion = async (commitHash: string) => {
    if (!selectedFile || !selectedRepo) return

    try {
      // Get file content at specific commit
      const response = await apiCall<{content: string}>(`git/${selectedRepo.id}/files/${commitHash}/commit?file_path=${encodeURIComponent(selectedFile.path)}`)

      // Create download
      const blob = new Blob([response.content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${selectedFile.name}_${commitHash.substring(0, 8)}.txt`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading file:', error)
    }
  }

  const handleViewCommitVersion = async (commitHash: string) => {
    if (!selectedFile || !selectedRepo) return

    setLoading(true)
    try {
      // Get file content at specific commit
      const response = await apiCall<{content: string}>(`git/${selectedRepo.id}/files/${commitHash}/commit?file_path=${encodeURIComponent(selectedFile.path)}`)

      // Find the commit info for the header
      const commit = fileHistory.find(c => c.hash === commitHash)

      setFileContent(response.content)
      setViewingCommit(commit || null)
      setShowFileView(true)
    } catch (error) {
      console.error('Error viewing file:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportDiff = () => {
    if (!comparisonResult) return
    exportDiffAsText(comparisonResult, `file-history-diff-${Date.now()}.patch`)
  }

  const navigateDiff = (direction: 'next' | 'prev') => {
    if (!comparisonResult) return

    // Find all lines that have changes (not equal)
    const diffLineIndices: number[] = []
    comparisonResult.left_lines.forEach((line, index) => {
      if (line.type !== 'equal') {
        diffLineIndices.push(index)
      }
    })

    if (diffLineIndices.length === 0) return

    const maxIndex = diffLineIndices.length - 1
    let newIndex = diffNav.currentIndex

    if (direction === 'next' && diffNav.currentIndex < maxIndex) {
      newIndex = diffNav.currentIndex + 1
    } else if (direction === 'prev' && diffNav.currentIndex > 0) {
      newIndex = diffNav.currentIndex - 1
    }

    diffNav.setCurrentIndex(newIndex)

    // Scroll to the diff line
    const lineIndex = diffLineIndices[newIndex]
    const element = document.querySelector(`[data-line-index="${lineIndex}"]`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }


  return (
    <div key="unique-id-fhc-1" className="space-y-6">
      {/* Header */}
      <div key="unique-id-fhc-2" className="flex items-center justify-between">
        <div key="unique-id-fhc-3">
          <h2 key="unique-id-fhc-4" className="text-2xl font-bold text-gray-900">File History</h2>
          <p key="unique-id-fhc-5" className="text-gray-600 mt-1">View the history of changes for a specific file</p>
        </div>
      </div>

      {/* Git Selection */}
      <div key="unique-id-fhc-7" className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div key="unique-id-fhc-4" className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <GitCommit key="unique-id-fhc-6" className="h-4 w-4" />
            <span className="text-sm font-medium">Git Repository</span>
          </div>
          <div className="text-xs text-blue-100">
            Select branch, commit, and file for history analysis
          </div>
        </div>
        <div key="unique-id-fhc-10" className="p-6 bg-gradient-to-b from-white to-gray-50">
          <div key="unique-id-fhc-11" className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <RepositorySelector
              repositories={repositories}
              selectedRepo={selectedRepo}
              onSelectRepo={setSelectedRepo}
            />

            <BranchSelector
              branches={branches}
              selectedBranch={selectedBranch}
              onSelectBranch={setSelectedBranch}
              disabled={!selectedRepo}
            />

            <CommitSelector
              commits={commits}
              selectedCommit={leftCommit}
              onSelectCommit={setLeftCommit}
              label="Source Commit"
              placeholder="Select source commit"
              disabled={!selectedBranch}
            />

            <FileSearchInput
              label="File to Compare"
              placeholder="Search for file..."
              searchQuery={fileSearch.searchQuery}
              onSearchQueryChange={fileSearch.setSearchQuery}
              showResults={fileSearch.showResults}
              onShowResultsChange={fileSearch.setShowResults}
              filteredFiles={fileSearch.filteredFiles}
              onFileSelect={fileSearch.setSelectedFile}
              searchRef={fileSearch.searchRef}
              disabled={!selectedRepo}
            />
          </div>
        </div>
      </div>

      {/* Compare Actions */}
      <div key="unique-id-fhc-43" className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <GitCommit className="h-4 w-4" />
            <span className="text-sm font-medium">File History Actions</span>
          </div>
          <div className="text-xs text-blue-100">
            View file history and configure comparison options
          </div>
        </div>
        <div key="unique-id-fhc-44" className="p-6 bg-gradient-to-b from-white to-gray-50">
          <div key="unique-id-fhc-45" className="flex items-center justify-between">
            <div key="unique-id-fhc-46" className="flex items-center gap-2">
            <Button 
              key="unique-id-fhc-47"
              onClick={handleViewHistory} 
              disabled={!canViewHistory() || historyLoading}
              className="flex items-center gap-2"
            >
              {historyLoading ? (
                <RefreshCw key="unique-id-fhc-48" className="h-4 w-4 animate-spin" />
              ) : (
                <GitCommit key="unique-id-fhc-49" className="h-4 w-4" />
              )}
              <span key="unique-id-fhc-50">View History</span>
            </Button>
            </div>

            {comparisonResult && (
              <DiffControls
                fontSize={diffNav.fontSize}
                onFontSizeChange={diffNav.setFontSize}
                hideUnchanged={diffNav.hideUnchanged}
                onHideUnchangedToggle={diffNav.toggleHideUnchanged}
                onExport={exportDiff}
              />
            )}
          </div>
        </div>
      </div>

      {/* File History */}
      {showHistory && fileHistory.length > 0 && (
        <div key="unique-id-fhc-history" className="shadow-lg border-0 p-0 bg-white rounded-lg">
          <div key="unique-id-fhc-history-header" className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
            <div key="unique-id-fhc-history-title-container">
              <div key="unique-id-fhc-history-title-content" className="flex items-center space-x-2">
                <GitCommit key="unique-id-fhc-history-icon" className="h-4 w-4" />
                <span className="text-sm font-medium">File History</span>
              </div>
              <div key="unique-id-fhc-history-desc" className="text-xs text-blue-100 mt-1">
                History of changes for {selectedFile?.path}
              </div>
            </div>
            <div key="unique-id-fhc-history-actions" className="flex items-center gap-2">
              {selectedCommits.length === 2 && (
                <Button
                  key="unique-id-fhc-compare-selected"
                  onClick={handleCompareSelected}
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  <GitCompareIcon key="unique-id-fhc-compare-icon" className="h-4 w-4" />
                  <span key="unique-id-fhc-compare-text">Compare Selected</span>
                </Button>
              )}
              <Button
                key="unique-id-fhc-history-close"
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowHistory(false)
                  setSelectedCommits([])
                }}
                className="bg-white/20 border-white/30 text-white hover:bg-white/30"
              >
                <span key="unique-id-fhc-history-close-text">Close</span>
              </Button>
            </div>
          </div>
          <div key="unique-id-fhc-history-content" className="p-6 bg-gradient-to-b from-white to-gray-50">
            <div key="unique-id-fhc-history-list" className="space-y-1">
              {fileHistory.map((commit) => (
                <div
                  key={commit.hash}
                  className={`flex items-center justify-between p-2 border rounded-lg cursor-pointer transition-colors ${
                    selectedCommits.includes(commit.hash)
                      ? 'bg-blue-50 border-blue-300'
                      : 'hover:bg-gray-50 border-gray-200'
                  }`}
                  onClick={() => handleCommitSelection(commit.hash)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 text-sm">
                      {/* Name (Hash) */}
                      <span className="font-medium text-gray-800 min-w-0 flex-1 truncate">
                        {commit.message} <span className="font-mono text-xs text-gray-600">({commit.short_hash})</span>
                      </span>
                      {/* Status */}
                      <span className={`text-xs px-2 py-1 rounded font-medium ${
                        commit.change_type === 'A' ? 'bg-green-100 text-green-800' :
                        commit.change_type === 'M' ? 'bg-blue-100 text-blue-800' :
                        commit.change_type === 'D' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {commit.change_type === 'A' ? 'Added' :
                         commit.change_type === 'M' ? 'Modified' :
                         commit.change_type === 'D' ? 'Deleted' :
                         'No Change'}
                      </span>
                      {/* Date */}
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {new Date(commit.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                      </span>
                      {/* Author */}
                      <span className="text-xs text-gray-600 whitespace-nowrap">
                        {commit.author.name}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {selectedCommits.includes(commit.hash) && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        Selected {selectedCommits.indexOf(commit.hash) + 1}
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleViewCommitVersion(commit.hash)
                      }}
                      disabled={loading}
                      className="flex items-center gap-1 h-7 px-2"
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDownloadCommitVersion(commit.hash)
                      }}
                      disabled={loading}
                      className="flex items-center gap-1 h-7 px-2"
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleShowChanges(commit.hash)
                      }}
                      disabled={loading}
                      className="flex items-center gap-1 h-7 px-2"
                    >
                      <Eye className="h-3 w-3" />
                      <span>Changes</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {selectedCommits.length > 0 && (
              <div key="unique-id-fhc-selection-info" className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div key="unique-id-fhc-selection-text" className="text-sm text-blue-800">
                  {selectedCommits.length === 1 
                    ? `1 commit selected. Select one more to compare.`
                    : `2 commits selected. Click "Compare Selected" to see differences.`
                  }
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* File View */}
      {showFileView && viewingCommit && (
        <Card key="unique-id-fhc-file-view" className="shadow-lg border-0 p-0">
          <CardHeader key="unique-id-fhc-file-view-header" className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 p-4">
            <div key="unique-id-fhc-file-view-title-container" className="flex items-center justify-between">
              <div key="unique-id-fhc-file-view-title-content">
                <CardTitle key="unique-id-fhc-file-view-title" className="flex items-center gap-2 text-white text-base">
                  <Eye key="unique-id-fhc-file-view-icon" className="h-4 w-4" />
                  <span key="unique-id-fhc-file-view-text">File Content</span>
                </CardTitle>
                <div key="unique-id-fhc-file-view-desc" className="text-blue-50 mt-1 text-sm">
                  {viewingCommit.message}, ({viewingCommit.short_hash}), {selectedFile?.name}
                </div>
              </div>
              <div key="unique-id-fhc-file-view-actions" className="flex items-center gap-2">
                {fileContent && (
                  <div key="unique-id-file-view-font-selector" className="flex items-center gap-2">
                    <Label key="unique-id-file-view-font-label" className="text-sm">Font Size:</Label>
                    <Select key="unique-id-file-view-font-select" value={diffNav.fontSize.toString()} onValueChange={(value) => {
                      const size = parseInt(value)
                      if (size >= 8 && size <= 20) {
                        diffNav.setFontSize(size)
                      }
                    }}>
                      <SelectTrigger key="unique-id-file-view-font-trigger" className="w-20 h-8">
                        <SelectValue key="unique-id-file-view-font-value" />
                      </SelectTrigger>
                      <SelectContent key="unique-id-file-view-font-content">
                        {[8, 10, 12, 14, 16].map((size) => (
                          <SelectItem key={`unique-id-file-view-font-item-${size}`} value={size.toString()}>{size}px</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button
                  key="unique-id-fhc-file-view-close"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowFileView(false)}
                  className="bg-white/20 border-white/30 text-white hover:bg-white/30"
                >
                  <span key="unique-id-fhc-file-view-close-text">Close</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent key="unique-id-fhc-file-view-content">
            <div
              key="unique-id-fhc-file-view-text-container"
              className="border rounded-lg overflow-auto font-mono bg-gray-50"
              style={{ fontSize: `${diffNav.fontSize}px`, maxHeight: '600px' }}
            >
              <pre key="unique-id-fhc-file-view-pre" className="p-4 whitespace-pre-wrap">
                {fileContent}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comparison Results */}
      {showComparison && comparisonResult && (
        <Card key="unique-id-fhc-60" className="shadow-lg border-0 p-0">
          <CardHeader key="unique-id-fhc-61" className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 p-4">
            <div key="unique-id-fhc-62" className="flex items-center justify-between">
              <div key="unique-id-fhc-63">
                <CardTitle key="unique-id-fhc-64" className="flex items-center gap-2 text-white text-base">
                  <GitCompareIcon key="unique-id-fhc-65" className="h-4 w-4" />
                  <span key="unique-id-fhc-66">
                    {selectedCommits.length === 2 ? 'Commit Comparison Results' : 'Commit Changes'}
                  </span>
                </CardTitle>
                <div key="unique-id-fhc-67" className="text-blue-50 mt-1 text-sm">
                  {selectedCommits.length === 2 
                    ? `Comparing ${comparisonResult.commit1} (Selected 1) → ${comparisonResult.commit2} (Selected 2)`
                    : `Changes in ${comparisonResult.commit2}`
                  }
                </div>
              </div>
              <div key="unique-id-fhc-68" className="flex items-center gap-2">
                <div key="unique-id-fhc-69" className="text-sm text-blue-50">
                  <span key="unique-id-fhc-70" className="text-green-200">+{comparisonResult.stats.additions}</span>
                  <span key="unique-id-fhc-71"> </span>
                  <span key="unique-id-fhc-72" className="text-red-200">-{comparisonResult.stats.deletions}</span>
                  <span key="unique-id-fhc-73"> </span>
                  <span key="unique-id-fhc-74" className="text-blue-200">{comparisonResult.stats.changes} changes</span>
                </div>
                <div key="unique-id-fhc-75" className="flex items-center gap-1">
                  <Button
                    key="unique-id-fhc-76"
                    size="sm"
                    variant="outline"
                    onClick={() => navigateDiff('prev')}
                    disabled={diffNav.currentIndex === 0}
                    className="bg-white/20 border-white/30 text-white hover:bg-white/30"
                  >
                    <ChevronUp key="unique-id-fhc-77" className="h-4 w-4" />
                  </Button>
                  <span key="unique-id-fhc-counter" className="text-xs text-blue-100 px-2">
                    {(() => {
                      const totalDiffs = comparisonResult.left_lines.filter(d => d.type !== 'equal').length
                      return totalDiffs > 0 ? `${diffNav.currentIndex + 1}/${totalDiffs}` : '0/0'
                    })()}
                  </span>
                  <Button
                    key="unique-id-fhc-78"
                    size="sm"
                    variant="outline"
                    onClick={() => navigateDiff('next')}
                    disabled={(() => {
                      const visibleDiffs = comparisonResult.left_lines.filter(d => d.type !== 'equal')
                      return diffNav.currentIndex >= visibleDiffs.length - 1
                    })()}
                    className="bg-white/20 border-white/30 text-white hover:bg-white/30"
                  >
                    <ChevronDown key="unique-id-fhc-79" className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  key="unique-id-fhc-80"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowComparison(false)}
                  className="bg-white/20 border-white/30 text-white hover:bg-white/30"
                >
                  <span key="unique-id-fhc-81">Close</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent key="unique-id-fhc-82">
            <div
              key="unique-id-fhc-83"
              className="border rounded-lg overflow-auto font-mono"
              style={{ fontSize: `${diffNav.fontSize}px`, maxHeight: '600px' }}
            >
              {/* Side-by-side comparison header */}
              <div key="unique-id-fhc-header" className="grid grid-cols-2 bg-gray-100 border-b sticky top-0" style={{ fontSize: `${Math.max(diffNav.fontSize - 2, 8)}px` }}>
                <div key="unique-id-fhc-left-header" className="p-2 border-r font-semibold text-gray-700">
                  {selectedCommits.length === 2 ? (
                    <>Selected 1 {(() => {
                      const commit = fileHistory.find(c => c.hash === selectedCommits[0])
                      return commit ? `${commit.message}, (${commit.short_hash}), ${selectedFile?.name}` : `${comparisonResult.commit1}: ${comparisonResult.left_file}`
                    })()}</>
                  ) : comparisonResult.current_commit ? (
                    comparisonResult.parent_commit ?
                      `${comparisonResult.parent_commit.message}, (${comparisonResult.parent_commit.short_hash}), ${selectedFile?.name}` :
                      `Previous version, (${comparisonResult.commit1.substring(0, 8)}), ${selectedFile?.name}`
                  ) : (
                    `${comparisonResult.commit1}: ${comparisonResult.left_file}`
                  )}
                </div>
                <div key="unique-id-fhc-right-header" className="p-2 font-semibold text-gray-700">
                  {selectedCommits.length === 2 ? (
                    <>Selected 2 {(() => {
                      const commit = fileHistory.find(c => c.hash === selectedCommits[1])
                      return commit ? `${commit.message}, (${commit.short_hash}), ${selectedFile?.name}` : `${comparisonResult.commit2}: ${comparisonResult.right_file}`
                    })()}</>
                  ) : comparisonResult.current_commit ? (
                    `${comparisonResult.current_commit.message}, (${comparisonResult.current_commit.short_hash}), ${selectedFile?.name}`
                  ) : (
                    `${comparisonResult.commit2}: ${comparisonResult.right_file}`
                  )}
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
                    <div 
                      key={`unique-id-fhc-row-${i}`} 
                      className="grid grid-cols-2 border-b border-gray-200 hover:bg-gray-50"
                      data-line-index={i}
                    >
                      {/* Left side (commit1) */}
                      <div key={`unique-id-fhc-left-${i}`} className={`flex items-start border-r ${getLeftLineClass(leftLine?.type || 'empty')}`}>
                        <div key={`unique-id-fhc-left-num-${i}`} className="flex-shrink-0 w-12 text-gray-500 text-right text-xs p-1 bg-gray-50 border-r">
                          {leftLine?.line_number || ''}
                        </div>
                        <div key={`unique-id-fhc-left-content-${i}`} className="flex-1 p-2 whitespace-pre-wrap break-all min-h-[1.4em]">
                          {leftLine?.content || ' '}
                        </div>
                      </div>

                      {/* Right side (commit2) */}
                      <div key={`unique-id-fhc-right-${i}`} className={`flex items-start ${getRightLineClass(rightLine?.type || 'empty')}`}>
                        <div key={`unique-id-fhc-right-num-${i}`} className="flex-shrink-0 w-12 text-gray-500 text-right text-xs p-1 bg-gray-50 border-r">
                          {rightLine?.line_number || ''}
                        </div>
                        <div key={`unique-id-fhc-right-content-${i}`} className="flex-1 p-2 whitespace-pre-wrap break-all min-h-[1.4em]">
                          {rightLine?.content || ' '}
                        </div>
                      </div>
                    </div>
                  )
                }
                
                return rows
              })()}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
