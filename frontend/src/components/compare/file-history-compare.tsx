'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  GitCommit, 
  GitCompare as GitCompareIcon, 
  Download, 
  Eye, 
  EyeOff, 
  ChevronUp, 
  ChevronDown,
  RefreshCw 
} from 'lucide-react'
import { useApi } from '@/hooks/use-api'

interface FileItem {
  name: string
  path: string
  size: number
  type: 'file' | 'directory'
}

interface Branch {
  name: string
  current: boolean
}

interface Commit {
  hash: string
  author: {
    name: string
    email: string
  }
  date: string
  message: string
  short_hash: string
  files_changed: number
}

interface DiffLine {
  type: 'equal' | 'delete' | 'insert' | 'replace' | 'empty'
  line_number: number | null
  content: string
}

interface ComparisonResult {
  commit1: string
  commit2: string
  file_path: string
  diff_lines: string[]
  left_file: string
  right_file: string
  left_lines: DiffLine[]
  right_lines: DiffLine[]
  stats: {
    additions: number
    deletions: number
    changes: number
    total_lines: number
  }
  current_commit?: FileHistoryCommit
  parent_commit?: FileHistoryCommit | null
}

interface FileHistoryCommit {
  hash: string
  short_hash: string
  author: {
    name: string
    email: string
  }
  date: string
  message: string
  change_type: string
}

export default function FileHistoryCompare() {
  const { apiCall } = useApi()
  
  // Git state
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [commits, setCommits] = useState<Commit[]>([])
  const [leftCommit, setLeftCommit] = useState<string>('')
  const [rightCommit, setRightCommit] = useState<string>('')
  
  // File selection state
  const [gitFiles, setGitFiles] = useState<FileItem[]>([])
  const [selectedGitFile, setSelectedGitFile] = useState<FileItem | null>(null)
  const [gitFileSearch, setGitFileSearch] = useState('')
  const [showGitResults, setShowGitResults] = useState(false)
  
  // Comparison state
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null)
  const [showComparison, setShowComparison] = useState(false)
  const [loading, setLoading] = useState(false)
  const [hideUnchanged, setHideUnchanged] = useState(false)
  const [currentDiffIndex, setCurrentDiffIndex] = useState(0)
  const [fontSize, setFontSize] = useState(12)
  
  // File history state
  const [fileHistory, setFileHistory] = useState<FileHistoryCommit[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [selectedCommits, setSelectedCommits] = useState<string[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  
  // File viewing state
  const [fileContent, setFileContent] = useState<string>('')
  const [showFileView, setShowFileView] = useState(false)
  const [viewingCommit, setViewingCommit] = useState<FileHistoryCommit | null>(null)
  
  // Refs for click outside handling
  const gitSearchRef = useRef<HTMLDivElement>(null)

  // Load initial data
  useEffect(() => {
    loadBranches()
    loadFiles()
  }, [])

  // Load font size from localStorage
  useEffect(() => {
    const storedFontSize = localStorage.getItem('diff_font_size')
    if (storedFontSize) {
      setFontSize(parseInt(storedFontSize))
    }
  }, [])

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (gitSearchRef.current && !gitSearchRef.current.contains(event.target as Node)) {
        setShowGitResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadBranches = async () => {
    try {
      console.log('Loading branches...')
      const response = await apiCall<Branch[]>('git/branches')
      console.log('Branches loaded:', response)
      setBranches(response)
      
      // Auto-select the current branch if available
      const currentBranch = response.find(branch => branch.current)
      if (currentBranch) {
        console.log('Auto-selecting current branch:', currentBranch.name)
        setSelectedBranch(currentBranch.name)
        loadCommitsForBranch(currentBranch.name)
      }
    } catch (error) {
      console.error('Error loading branches:', error)
    }
  }

  const loadFiles = async () => {
    try {
      const response = await apiCall<{files: FileItem[]}>('files/list')
      const files = Array.isArray(response?.files) ? response.files : []
      setGitFiles(files)
    } catch (error) {
      console.error('Error loading files:', error)
      // Ensure we always have an array even on error
      setGitFiles([])
    }
  }

  const loadCommitsForBranch = async (branch: string) => {
    try {
      console.log('Loading commits for branch:', branch)
      const response = await apiCall<Commit[]>(`git/commits/${encodeURIComponent(branch)}`)
      console.log('Commits loaded:', response.length, 'commits')
      setCommits(response)
    } catch (error) {
      console.error('Error loading commits:', error)
    }
  }

  const searchFiles = (query: string, files: FileItem[]) => {
    if (!query.trim()) return []
    // Add safety check to ensure files is an array
    if (!Array.isArray(files)) {
      console.warn('searchFiles: files parameter is not an array:', files)
      return []
    }
    return files.filter(file => 
      file.name.toLowerCase().includes(query.toLowerCase()) ||
      file.path.toLowerCase().includes(query.toLowerCase())
    )
  }

  const handleGitFileSelect = (file: FileItem) => {
    setSelectedGitFile(file)
    setGitFileSearch(file.name)
    setShowGitResults(false)
  }

  const canViewHistory = () => {
    return leftCommit && leftCommit.trim() !== '' && 
           selectedGitFile
  }

  const handleViewHistory = async () => {
    if (!selectedGitFile || !leftCommit) return

    setHistoryLoading(true)
    try {
      // Get file history for the selected file starting from the selected source commit
      const response = await apiCall<{commits: FileHistoryCommit[]}>(`git/file-complete-history/${encodeURIComponent(selectedGitFile.path)}?from_commit=${encodeURIComponent(leftCommit)}`)
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
      } else {
        // Replace the first selected commit with the new one if already 2 selected
        return [prev[1], commitHash]
      }
    })
  }

  const handleShowChanges = async (commitHash: string) => {
    if (!selectedGitFile) return

    setLoading(true)
    try {
      // Get changes for this specific commit
      const response = await apiCall<ComparisonResult>('git/diff', {
        method: 'POST',
        body: JSON.stringify({
          commit1: `${commitHash}^`, // Parent commit
          commit2: commitHash,
          file_path: selectedGitFile.path
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
      setCurrentDiffIndex(0)
    } catch (error) {
      console.error('Error showing changes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCompareSelected = async () => {
    if (selectedCommits.length !== 2 || !selectedGitFile) return

    setLoading(true)
    try {
      const response = await apiCall<ComparisonResult>('git/diff', {
        method: 'POST',
        body: JSON.stringify({
          commit1: selectedCommits[0], // First selected (Selected 1) - left side
          commit2: selectedCommits[1], // Second selected (Selected 2) - right side
          file_path: selectedGitFile.path
        })
      })

      setComparisonResult(response)
      setShowComparison(true)
      setCurrentDiffIndex(0)
    } catch (error) {
      console.error('Error comparing commits:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadFile = async (commitHash: string) => {
    if (!selectedGitFile) return

    try {
      // Get file content from the specific commit
      const response = await apiCall<{content: string}>(`git/files/${commitHash}?file_path=${encodeURIComponent(selectedGitFile.path)}`)
      
      // Create blob and download
      const blob = new Blob([response.content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${selectedGitFile.name}_${commitHash.substring(0, 8)}.txt`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading file:', error)
    }
  }

  const handleViewFile = async (commitHash: string) => {
    if (!selectedGitFile) return

    setLoading(true)
    try {
      // Get file content from the specific commit
      const response = await apiCall<{content: string}>(`git/files/${commitHash}?file_path=${encodeURIComponent(selectedGitFile.path)}`)
      
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

    const diffContent = comparisonResult.diff_lines.join('\n')

    const blob = new Blob([`--- ${comparisonResult.left_file}\n+++ ${comparisonResult.right_file}\n${diffContent}`], {
      type: 'text/plain'
    })
    
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `git-diff-${Date.now()}.patch`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
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
    let newIndex = currentDiffIndex
    
    if (direction === 'next' && currentDiffIndex < maxIndex) {
      newIndex = currentDiffIndex + 1
    } else if (direction === 'prev' && currentDiffIndex > 0) {
      newIndex = currentDiffIndex - 1
    }
    
    setCurrentDiffIndex(newIndex)
    
    // Scroll to the diff line
    const lineIndex = diffLineIndices[newIndex]
    const element = document.querySelector(`[data-line-index="${lineIndex}"]`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const getDiffPrefix = (type: DiffLine['type']) => {
    switch (type) {
      case 'insert': return '+ '
      case 'delete': return '- '
      case 'replace': return '~ '
      default: return '  '
    }
  }

  const getLeftLineClass = (type: DiffLine['type']) => {
    switch (type) {
      case 'delete': return 'bg-red-50 text-red-900'
      case 'replace': return 'bg-yellow-50 text-yellow-900'
      case 'equal': return 'bg-white'
      case 'empty': return 'bg-gray-100'
      default: return 'bg-white'
    }
  }

  const getRightLineClass = (type: DiffLine['type']) => {
    switch (type) {
      case 'insert': return 'bg-green-50 text-green-900'
      case 'replace': return 'bg-yellow-50 text-yellow-900'
      case 'equal': return 'bg-white'
      case 'empty': return 'bg-gray-100'
      default: return 'bg-white'
    }
  }

  return (
    <div key="unique-id-fhc-1" className="space-y-6">
      <div key="unique-id-fhc-2" className="flex items-center justify-between">
        <div key="unique-id-fhc-3">
          <h2 key="unique-id-fhc-4" className="text-2xl font-bold tracking-tight">File History</h2>
          <p key="unique-id-fhc-5" className="text-gray-600">View the history of changes for a specific file</p>
        </div>
      </div>

      {/* Git Selection */}
      <Card key="unique-id-fhc-7">
        <CardHeader key="unique-id-fhc-8">
          <CardTitle key="unique-id-fhc-9">Select Commit and File</CardTitle>
        </CardHeader>
        <CardContent key="unique-id-fhc-10">
          <div key="unique-id-fhc-11" className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div key="unique-id-fhc-12" className="space-y-2">
                <Label key="unique-id-fhc-13">Branch</Label>
              <Select key="unique-id-fhc-14" value={selectedBranch || '__none__'} onValueChange={(value) => {
                const newValue = value === '__none__' ? '' : value
                setSelectedBranch(newValue)
                if (newValue) {
                  loadCommitsForBranch(newValue)
                }
              }}>
                <SelectTrigger key="unique-id-fhc-15">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent key="unique-id-fhc-16">
                  <SelectItem key="unique-id-fhc-17" value="__none__">Select branch...</SelectItem>
                  {branches.map((branch, index) => (
                    <SelectItem key={`unique-id-fhc-18-${index}`} value={branch.name}>
                      {branch.name}{branch.current ? ' (current)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div key="unique-id-fhc-19" className="space-y-2">
              <Label key="unique-id-fhc-20">Source Commit</Label>
              <Select key="unique-id-fhc-21" value={leftCommit || '__none__'} onValueChange={(value) => {
                setLeftCommit(value === '__none__' ? '' : value)
              }}>
                <SelectTrigger key="unique-id-fhc-22">
                  <SelectValue placeholder="Select source commit" />
                </SelectTrigger>
                <SelectContent key="unique-id-fhc-23">
                  <SelectItem key="unique-id-fhc-24" value="__none__">Select source commit...</SelectItem>
                  {commits.map((commit, index) => (
                    <SelectItem key={`unique-id-fhc-25-${index}`} value={commit.hash}>
                      {commit.short_hash} - {commit.message.substring(0, 50)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div key="unique-id-fhc-33" className="space-y-2" ref={gitSearchRef}>
              <Label key="unique-id-fhc-34">File to Compare</Label>
              <div key="unique-id-fhc-35" className="relative">
                <Input
                  key="unique-id-fhc-36"
                  placeholder="Search for file..."
                  value={gitFileSearch}
                  onChange={(e) => {
                    setGitFileSearch(e.target.value)
                    setShowGitResults(e.target.value.length > 0)
                  }}
                  onFocus={() => setShowGitResults(gitFileSearch.length > 0)}
                />
                {showGitResults && (
                  <div key="unique-id-fhc-37" className="absolute top-full left-0 right-0 z-10 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {searchFiles(gitFileSearch, gitFiles || []).map((file, index) => (
                      <div
                        key={`unique-id-fhc-38-${index}`}
                        className="p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                        onClick={() => handleGitFileSelect(file)}
                      >
                        <div key={`unique-id-fhc-39-${index}`} className="font-medium text-sm">{file.name}</div>
                        <div key={`unique-id-fhc-40-${index}`} className="text-xs text-gray-500">{file.path}</div>
                      </div>
                    ))}
                    {searchFiles(gitFileSearch, gitFiles || []).length === 0 && (
                      <div key="unique-id-fhc-41" className="p-2 text-sm text-gray-500">No files found</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compare Actions */}
      <Card key="unique-id-fhc-43">
        <CardContent key="unique-id-fhc-44" className="py-2">
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
              
              {comparisonResult && (
                <Button 
                  key="unique-id-fhc-51"
                  variant="outline" 
                  onClick={exportDiff}
                  className="flex items-center gap-2"
                >
                  <Download key="unique-id-fhc-52" className="h-4 w-4" />
                  <span key="unique-id-fhc-53">Export Diff</span>
                </Button>
              )}
            </div>

            <div key="unique-id-fhc-54" className="flex items-center gap-2">
              {comparisonResult && (
                <div key="unique-id-font-selector" className="flex items-center gap-2">
                  <Label key="unique-id-font-label" className="text-sm">Font Size:</Label>
                  <Select key="unique-id-font-select" value={fontSize.toString()} onValueChange={(value) => setFontSize(parseInt(value))}>
                    <SelectTrigger key="unique-id-font-trigger" className="w-20 h-8">
                      <SelectValue key="unique-id-font-value" />
                    </SelectTrigger>
                    <SelectContent key="unique-id-font-content">
                      {[8, 10, 12, 14, 16].map((size) => (
                        <SelectItem key={`unique-id-font-item-${size}`} value={size.toString()}>{size}px</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button
                key="unique-id-fhc-55"
                variant="outline"
                size="sm"
                onClick={() => setHideUnchanged(!hideUnchanged)}
                className="flex items-center gap-2"
              >
                {hideUnchanged ? (
                  <>
                    <Eye key="unique-id-fhc-56" className="h-4 w-4" />
                    <span key="unique-id-fhc-57">Show Unchanged</span>
                  </>
                ) : (
                  <>
                    <EyeOff key="unique-id-fhc-58" className="h-4 w-4" />
                    <span key="unique-id-fhc-59">Hide Unchanged</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File History */}
      {showHistory && fileHistory.length > 0 && (
        <Card key="unique-id-fhc-history">
          <CardHeader key="unique-id-fhc-history-header">
            <div key="unique-id-fhc-history-title-container" className="flex items-center justify-between">
              <div key="unique-id-fhc-history-title-content">
                <CardTitle key="unique-id-fhc-history-title" className="flex items-center gap-2">
                  <GitCommit key="unique-id-fhc-history-icon" className="h-5 w-5" />
                  <span key="unique-id-fhc-history-text">File History</span>
                </CardTitle>
                <CardDescription key="unique-id-fhc-history-desc">
                  History of changes for {selectedGitFile?.path}
                </CardDescription>
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
                >
                  <span key="unique-id-fhc-history-close-text">Close</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent key="unique-id-fhc-history-content">
            <div key="unique-id-fhc-history-list" className="space-y-1">
              {fileHistory.map((commit, index) => (
                <div
                  key={`unique-id-fhc-commit-${index}`}
                  className={`flex items-center justify-between p-2 border rounded-lg cursor-pointer transition-colors ${
                    selectedCommits.includes(commit.hash)
                      ? 'bg-blue-50 border-blue-300'
                      : 'hover:bg-gray-50 border-gray-200'
                  }`}
                  onClick={() => handleCommitSelection(commit.hash)}
                >
                  <div key={`unique-id-fhc-commit-info-${index}`} className="flex-1">
                    <div key={`unique-id-fhc-commit-row-${index}`} className="flex items-center gap-3 text-sm">
                      {/* Name (Hash) */}
                      <span key={`unique-id-fhc-commit-message-${index}`} className="font-medium text-gray-800 min-w-0 flex-1 truncate">
                        {commit.message} <span className="font-mono text-xs text-gray-600">({commit.short_hash})</span>
                      </span>
                      {/* Status */}
                      <span key={`unique-id-fhc-commit-change-${index}`} className={`text-xs px-2 py-1 rounded font-medium ${
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
                      <span key={`unique-id-fhc-commit-date-${index}`} className="text-xs text-gray-500 whitespace-nowrap">
                        {new Date(commit.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                      </span>
                      {/* Author */}
                      <span key={`unique-id-fhc-commit-author-${index}`} className="text-xs text-gray-600 whitespace-nowrap">
                        {commit.author.name}
                      </span>
                    </div>
                  </div>
                  <div key={`unique-id-fhc-commit-actions-${index}`} className="flex items-center gap-2 ml-4">
                    {selectedCommits.includes(commit.hash) && (
                      <span key={`unique-id-fhc-selected-badge-${index}`} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        Selected {selectedCommits.indexOf(commit.hash) + 1}
                      </span>
                    )}
                    <Button
                      key={`unique-id-fhc-view-btn-${index}`}
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleViewFile(commit.hash)
                      }}
                      disabled={loading}
                      className="flex items-center gap-1 h-7 px-2"
                    >
                      <Eye key={`unique-id-fhc-view-icon-${index}`} className="h-3 w-3" />
                    </Button>
                    <Button
                      key={`unique-id-fhc-download-btn-${index}`}
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDownloadFile(commit.hash)
                      }}
                      disabled={loading}
                      className="flex items-center gap-1 h-7 px-2"
                    >
                      <Download key={`unique-id-fhc-download-icon-${index}`} className="h-3 w-3" />
                    </Button>
                    <Button
                      key={`unique-id-fhc-changes-btn-${index}`}
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleShowChanges(commit.hash)
                      }}
                      disabled={loading}
                      className="flex items-center gap-1 h-7 px-2"
                    >
                      <Eye key={`unique-id-fhc-changes-icon-${index}`} className="h-3 w-3" />
                      <span key={`unique-id-fhc-changes-text-${index}`}>Changes</span>
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
          </CardContent>
        </Card>
      )}

      {/* File View */}
      {showFileView && viewingCommit && (
        <Card key="unique-id-fhc-file-view">
          <CardHeader key="unique-id-fhc-file-view-header">
            <div key="unique-id-fhc-file-view-title-container" className="flex items-center justify-between">
              <div key="unique-id-fhc-file-view-title-content">
                <CardTitle key="unique-id-fhc-file-view-title" className="flex items-center gap-2">
                  <Eye key="unique-id-fhc-file-view-icon" className="h-5 w-5" />
                  <span key="unique-id-fhc-file-view-text">File Content</span>
                </CardTitle>
                <CardDescription key="unique-id-fhc-file-view-desc">
                  {viewingCommit.message}, ({viewingCommit.short_hash}), {selectedGitFile?.name}
                </CardDescription>
              </div>
              <div key="unique-id-fhc-file-view-actions" className="flex items-center gap-2">
                {fileContent && (
                  <div key="unique-id-file-view-font-selector" className="flex items-center gap-2">
                    <Label key="unique-id-file-view-font-label" className="text-sm">Font Size:</Label>
                    <Select key="unique-id-file-view-font-select" value={fontSize.toString()} onValueChange={(value) => setFontSize(parseInt(value))}>
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
              style={{ fontSize: `${fontSize}px`, maxHeight: '600px' }}
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
        <Card key="unique-id-fhc-60">
          <CardHeader key="unique-id-fhc-61">
            <div key="unique-id-fhc-62" className="flex items-center justify-between">
              <div key="unique-id-fhc-63">
                <CardTitle key="unique-id-fhc-64" className="flex items-center gap-2">
                  <GitCompareIcon key="unique-id-fhc-65" className="h-5 w-5" />
                  <span key="unique-id-fhc-66">
                    {selectedCommits.length === 2 ? 'Commit Comparison' : 'Commit Changes'}
                  </span>
                </CardTitle>
                <CardDescription key="unique-id-fhc-67">
                  {selectedCommits.length === 2 
                    ? `Comparing ${comparisonResult.commit1} (Selected 1) → ${comparisonResult.commit2} (Selected 2)`
                    : `Changes in ${comparisonResult.commit2}`
                  }
                </CardDescription>
              </div>
              <div key="unique-id-fhc-68" className="flex items-center gap-2">
                <div key="unique-id-fhc-69" className="text-sm text-gray-600">
                  <span key="unique-id-fhc-70" className="text-green-600">+{comparisonResult.stats.additions}</span>
                  <span key="unique-id-fhc-71"> </span>
                  <span key="unique-id-fhc-72" className="text-red-600">-{comparisonResult.stats.deletions}</span>
                  <span key="unique-id-fhc-73"> </span>
                  <span key="unique-id-fhc-74" className="text-blue-600">{comparisonResult.stats.changes} changes</span>
                </div>
                <div key="unique-id-fhc-75" className="flex items-center gap-1">
                  <Button
                    key="unique-id-fhc-76"
                    size="sm"
                    variant="outline"
                    onClick={() => navigateDiff('prev')}
                    disabled={currentDiffIndex === 0}
                  >
                    <ChevronUp key="unique-id-fhc-77" className="h-4 w-4" />
                  </Button>
                  <span key="unique-id-fhc-counter" className="text-xs text-gray-500 px-2">
                    {(() => {
                      const totalDiffs = comparisonResult.left_lines.filter(d => d.type !== 'equal').length
                      return totalDiffs > 0 ? `${currentDiffIndex + 1}/${totalDiffs}` : '0/0'
                    })()}
                  </span>
                  <Button
                    key="unique-id-fhc-78"
                    size="sm"
                    variant="outline"
                    onClick={() => navigateDiff('next')}
                    disabled={(() => {
                      const visibleDiffs = comparisonResult.left_lines.filter(d => d.type !== 'equal')
                      return currentDiffIndex >= visibleDiffs.length - 1
                    })()}
                  >
                    <ChevronDown key="unique-id-fhc-79" className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  key="unique-id-fhc-80"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowComparison(false)}
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
              style={{ fontSize: `${fontSize}px`, maxHeight: '600px' }}
            >
              {/* Side-by-side comparison header */}
              <div key="unique-id-fhc-header" className="grid grid-cols-2 bg-gray-100 border-b sticky top-0" style={{ fontSize: `${Math.max(fontSize - 2, 8)}px` }}>
                <div key="unique-id-fhc-left-header" className="p-2 border-r font-semibold text-gray-700">
                  {selectedCommits.length === 2 ? (
                    <>Selected 1 {(() => {
                      const commit = fileHistory.find(c => c.hash === selectedCommits[0])
                      return commit ? `${commit.message}, (${commit.short_hash}), ${selectedGitFile?.name}` : `${comparisonResult.commit1}: ${comparisonResult.left_file}`
                    })()}</>
                  ) : comparisonResult.current_commit ? (
                    comparisonResult.parent_commit ? 
                      `${comparisonResult.parent_commit.message}, (${comparisonResult.parent_commit.short_hash}), ${selectedGitFile?.name}` :
                      `Previous version, (${comparisonResult.commit1.substring(0, 8)}), ${selectedGitFile?.name}`
                  ) : (
                    `${comparisonResult.commit1}: ${comparisonResult.left_file}`
                  )}
                </div>
                <div key="unique-id-fhc-right-header" className="p-2 font-semibold text-gray-700">
                  {selectedCommits.length === 2 ? (
                    <>Selected 2 {(() => {
                      const commit = fileHistory.find(c => c.hash === selectedCommits[1])
                      return commit ? `${commit.message}, (${commit.short_hash}), ${selectedGitFile?.name}` : `${comparisonResult.commit2}: ${comparisonResult.right_file}`
                    })()}</>
                  ) : comparisonResult.current_commit ? (
                    `${comparisonResult.current_commit.message}, (${comparisonResult.current_commit.short_hash}), ${selectedGitFile?.name}`
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
                  if (hideUnchanged && leftLine?.type === 'equal' && rightLine?.type === 'equal') {
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
