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
}

export default function GitCompare() {
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
    setGitFileSearch('')
    setShowGitResults(false)
  }

  const canCompare = () => {
    return leftCommit && leftCommit.trim() !== '' && 
           rightCommit && rightCommit.trim() !== '' && 
           selectedGitFile && leftCommit !== rightCommit
  }

  const handleCompare = async () => {
    if (!canCompare()) return

    setLoading(true)
    try {
      const response = await apiCall<ComparisonResult>('git/diff', {
        method: 'POST',
        body: JSON.stringify({
          commit1: leftCommit,
          commit2: rightCommit,
          file_path: selectedGitFile!.path
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
    
    const visibleDiffs = comparisonResult.left_lines.filter(d => d.type !== 'equal')
    const maxIndex = visibleDiffs.length - 1
    
    if (direction === 'next' && currentDiffIndex < maxIndex) {
      setCurrentDiffIndex(currentDiffIndex + 1)
    } else if (direction === 'prev' && currentDiffIndex > 0) {
      setCurrentDiffIndex(currentDiffIndex - 1)
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
    <div key="unique-id-gc-1" className="space-y-6">
      <div key="unique-id-gc-2" className="flex items-center justify-between">
        <div key="unique-id-gc-3">
          <h2 key="unique-id-gc-4" className="text-2xl font-bold tracking-tight">Git Commit Comparison</h2>
          <p key="unique-id-gc-5" className="text-gray-600">Compare files between different Git commits</p>
        </div>
      </div>

      {/* Git Selection */}
      <Card key="unique-id-gc-7">
        <CardHeader key="unique-id-gc-8">
          <CardTitle key="unique-id-gc-9">Select Commits and File</CardTitle>
        </CardHeader>
        <CardContent key="unique-id-gc-10">
          <div key="unique-id-gc-11" className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div key="unique-id-gc-12" className="space-y-2">
                <Label key="unique-id-gc-13">Branch</Label>
              <Select key="unique-id-gc-14" value={selectedBranch || '__none__'} onValueChange={(value) => {
                const newValue = value === '__none__' ? '' : value
                setSelectedBranch(newValue)
                if (newValue) {
                  loadCommitsForBranch(newValue)
                }
              }}>
                <SelectTrigger key="unique-id-gc-15">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent key="unique-id-gc-16">
                  <SelectItem key="unique-id-gc-17" value="__none__">Select branch...</SelectItem>
                  {branches.map((branch, index) => (
                    <SelectItem key={`unique-id-gc-18-${index}`} value={branch.name}>
                      {branch.name}{branch.current ? ' (current)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div key="unique-id-gc-19" className="space-y-2">
              <Label key="unique-id-gc-20">Source Commit</Label>
              <Select key="unique-id-gc-21" value={leftCommit || '__none__'} onValueChange={(value) => {
                setLeftCommit(value === '__none__' ? '' : value)
              }}>
                <SelectTrigger key="unique-id-gc-22">
                  <SelectValue placeholder="Select source commit" />
                </SelectTrigger>
                <SelectContent key="unique-id-gc-23">
                  <SelectItem key="unique-id-gc-24" value="__none__">Select source commit...</SelectItem>
                  {commits.map((commit, index) => (
                    <SelectItem key={`unique-id-gc-25-${index}`} value={commit.hash}>
                      {commit.short_hash} - {commit.message.substring(0, 50)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div key="unique-id-gc-26" className="space-y-2">
              <Label key="unique-id-gc-27">Target Commit</Label>
              <Select key="unique-id-gc-28" value={rightCommit || '__none__'} onValueChange={(value) => {
                setRightCommit(value === '__none__' ? '' : value)
              }}>
                <SelectTrigger key="unique-id-gc-29">
                  <SelectValue placeholder="Select target commit" />
                </SelectTrigger>
                <SelectContent key="unique-id-gc-30">
                  <SelectItem key="unique-id-gc-31" value="__none__">Select target commit...</SelectItem>
                  {commits.map((commit, index) => (
                    <SelectItem key={`unique-id-gc-32-${index}`} value={commit.hash}>
                      {commit.short_hash} - {commit.message.substring(0, 50)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div key="unique-id-gc-33" className="space-y-2" ref={gitSearchRef}>
            <Label key="unique-id-gc-34">File to Compare</Label>
            <div key="unique-id-gc-35" className="relative">
              <Input
                key="unique-id-gc-36"
                placeholder="Search for file..."
                value={gitFileSearch}
                onChange={(e) => {
                  setGitFileSearch(e.target.value)
                  setShowGitResults(e.target.value.length > 0)
                }}
                onFocus={() => setShowGitResults(gitFileSearch.length > 0)}
              />
              {showGitResults && (
                <div key="unique-id-gc-37" className="absolute top-full left-0 right-0 z-10 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {searchFiles(gitFileSearch, gitFiles || []).map((file, index) => (
                    <div
                      key={`unique-id-gc-38-${index}`}
                      className="p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      onClick={() => handleGitFileSelect(file)}
                    >
                      <div key={`unique-id-gc-39-${index}`} className="font-medium text-sm">{file.name}</div>
                      <div key={`unique-id-gc-40-${index}`} className="text-xs text-gray-500">{file.path}</div>
                    </div>
                  ))}
                  {searchFiles(gitFileSearch, gitFiles || []).length === 0 && (
                    <div key="unique-id-gc-41" className="p-2 text-sm text-gray-500">No files found</div>
                  )}
                </div>
              )}
            </div>
            {selectedGitFile && (
              <div key="unique-id-gc-42" className="text-sm text-gray-600 bg-blue-50 p-2 rounded">
                Selected: {selectedGitFile.path}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Compare Actions */}
      <Card key="unique-id-gc-43">
        <CardContent key="unique-id-gc-44" className="pt-6">
          <div key="unique-id-gc-45" className="flex items-center justify-between">
            <div key="unique-id-gc-46" className="flex items-center gap-2">
            <Button 
              key="unique-id-gc-47"
              onClick={handleCompare} 
              disabled={!canCompare() || loading}
              className="flex items-center gap-2"
            >
              {loading ? (
                <RefreshCw key="unique-id-gc-48" className="h-4 w-4 animate-spin" />
              ) : (
                <GitCompareIcon key="unique-id-gc-49" className="h-4 w-4" />
              )}
              <span key="unique-id-gc-50">Compare Commits</span>
            </Button>
              
              {comparisonResult && (
                <Button 
                  key="unique-id-gc-51"
                  variant="outline" 
                  onClick={exportDiff}
                  className="flex items-center gap-2"
                >
                  <Download key="unique-id-gc-52" className="h-4 w-4" />
                  <span key="unique-id-gc-53">Export Diff</span>
                </Button>
              )}
            </div>

            <div key="unique-id-gc-54" className="flex items-center gap-2">
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
                key="unique-id-gc-55"
                variant="outline"
                size="sm"
                onClick={() => setHideUnchanged(!hideUnchanged)}
                className="flex items-center gap-2"
              >
                {hideUnchanged ? (
                  <>
                    <Eye key="unique-id-gc-56" className="h-4 w-4" />
                    <span key="unique-id-gc-57">Show Unchanged</span>
                  </>
                ) : (
                  <>
                    <EyeOff key="unique-id-gc-58" className="h-4 w-4" />
                    <span key="unique-id-gc-59">Hide Unchanged</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Results */}
      {showComparison && comparisonResult && (
        <Card key="unique-id-gc-60">
          <CardHeader key="unique-id-gc-61">
            <div key="unique-id-gc-62" className="flex items-center justify-between">
              <div key="unique-id-gc-63">
                <CardTitle key="unique-id-gc-64" className="flex items-center gap-2">
                  <GitCompareIcon key="unique-id-gc-65" className="h-5 w-5" />
                  <span key="unique-id-gc-66">Git Commit Comparison</span>
                </CardTitle>
                <CardDescription key="unique-id-gc-67">
                  {comparisonResult.left_file} ↔ {comparisonResult.right_file}
                </CardDescription>
              </div>
              <div key="unique-id-gc-68" className="flex items-center gap-2">
                <div key="unique-id-gc-69" className="text-sm text-gray-600">
                  <span key="unique-id-gc-70" className="text-green-600">+{comparisonResult.stats.additions}</span>
                  <span key="unique-id-gc-71"> </span>
                  <span key="unique-id-gc-72" className="text-red-600">-{comparisonResult.stats.deletions}</span>
                  <span key="unique-id-gc-73"> </span>
                  <span key="unique-id-gc-74" className="text-blue-600">{comparisonResult.stats.changes} changes</span>
                </div>
                <div key="unique-id-gc-75" className="flex items-center gap-1">
                  <Button
                    key="unique-id-gc-76"
                    size="sm"
                    variant="outline"
                    onClick={() => navigateDiff('prev')}
                    disabled={currentDiffIndex === 0}
                  >
                    <ChevronUp key="unique-id-gc-77" className="h-4 w-4" />
                  </Button>
                  <Button
                    key="unique-id-gc-78"
                    size="sm"
                    variant="outline"
                    onClick={() => navigateDiff('next')}
                    disabled={(() => {
                      const visibleDiffs = comparisonResult.left_lines.filter(d => d.type !== 'equal')
                      return currentDiffIndex >= visibleDiffs.length - 1
                    })()}
                  >
                    <ChevronDown key="unique-id-gc-79" className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  key="unique-id-gc-80"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowComparison(false)}
                >
                  <span key="unique-id-gc-81">Close</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent key="unique-id-gc-82">
            <div 
              key="unique-id-gc-83"
              className="border rounded-lg overflow-auto font-mono"
              style={{ fontSize: `${fontSize}px`, maxHeight: '600px' }}
            >
              {/* Side-by-side comparison header */}
              <div key="unique-id-gc-header" className="grid grid-cols-2 bg-gray-100 border-b sticky top-0" style={{ fontSize: `${Math.max(fontSize - 2, 8)}px` }}>
                <div key="unique-id-gc-left-header" className="p-2 border-r font-semibold text-gray-700">
                  {comparisonResult.commit1}: {comparisonResult.left_file}
                </div>
                <div key="unique-id-gc-right-header" className="p-2 font-semibold text-gray-700">
                  {comparisonResult.commit2}: {comparisonResult.right_file}
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
                    <div key={`unique-id-gc-row-${i}`} className="grid grid-cols-2 border-b border-gray-200 hover:bg-gray-50">
                      {/* Left side (commit1) */}
                      <div key={`unique-id-gc-left-${i}`} className={`flex items-start border-r ${getLeftLineClass(leftLine?.type || 'empty')}`}>
                        <div key={`unique-id-gc-left-num-${i}`} className="flex-shrink-0 w-12 text-gray-500 text-right text-xs p-1 bg-gray-50 border-r">
                          {leftLine?.line_number || ''}
                        </div>
                        <div key={`unique-id-gc-left-content-${i}`} className="flex-1 p-2 whitespace-pre-wrap break-all min-h-[1.4em]">
                          {leftLine?.content || ' '}
                        </div>
                      </div>

                      {/* Right side (commit2) */}
                      <div key={`unique-id-gc-right-${i}`} className={`flex items-start ${getRightLineClass(rightLine?.type || 'empty')}`}>
                        <div key={`unique-id-gc-right-num-${i}`} className="flex-shrink-0 w-12 text-gray-500 text-right text-xs p-1 bg-gray-50 border-r">
                          {rightLine?.line_number || ''}
                        </div>
                        <div key={`unique-id-gc-right-content-${i}`} className="flex-1 p-2 whitespace-pre-wrap break-all min-h-[1.4em]">
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
