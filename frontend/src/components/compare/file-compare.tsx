'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  File, 
  GitCompare, 
  Download, 
  Eye, 
  EyeOff, 
  ChevronUp, 
  ChevronDown,
  RefreshCw,
  GitBranch
} from 'lucide-react'
import { useApi } from '@/hooks/use-api'

interface GitRepository {
  id: number
  name: string
  category: string
  is_active: boolean
}

interface FileItem {
  name: string
  path: string
  size: number
  type: 'file' | 'directory'
}

interface DiffLine {
  type: 'equal' | 'delete' | 'insert' | 'replace' | 'empty'
  line_number: number | null
  content: string
}

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
  
  // Repository state
  const [repositories, setRepositories] = useState<GitRepository[]>([])
  const [selectedRepo, setSelectedRepo] = useState<GitRepository | null>(null)
  
  // File selection state
  const [leftFiles, setLeftFiles] = useState<FileItem[]>([])
  const [rightFiles, setRightFiles] = useState<FileItem[]>([])
  const [selectedLeftFile, setSelectedLeftFile] = useState<FileItem | null>(null)
  const [selectedRightFile, setSelectedRightFile] = useState<FileItem | null>(null)
  const [leftFileSearch, setLeftFileSearch] = useState('')
  const [rightFileSearch, setRightFileSearch] = useState('')
  const [showLeftResults, setShowLeftResults] = useState(false)
  const [showRightResults, setShowRightResults] = useState(false)
  
  // Comparison state
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null)
  const [showComparison, setShowComparison] = useState(false)
  const [loading, setLoading] = useState(false)
  const [hideUnchanged, setHideUnchanged] = useState(false)
  const [currentDiffIndex, setCurrentDiffIndex] = useState(0)
  const [fontSize, setFontSize] = useState(12)
  
  // Refs for click outside handling
  const leftSearchRef = useRef<HTMLDivElement>(null)
  const rightSearchRef = useRef<HTMLDivElement>(null)

  // Load files on mount
  useEffect(() => {
    loadRepositories()
  }, [])

  // Load files when repository changes
  useEffect(() => {
    if (selectedRepo) {
      loadFiles()
    } else {
      setLeftFiles([])
      setRightFiles([])
      setSelectedLeftFile(null)
      setSelectedRightFile(null)
    }
  }, [selectedRepo])

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
      if (leftSearchRef.current && !leftSearchRef.current.contains(event.target as Node)) {
        setShowLeftResults(false)
      }
      if (rightSearchRef.current && !rightSearchRef.current.contains(event.target as Node)) {
        setShowRightResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadRepositories = async () => {
    try {
      console.log('Loading repositories...')
      const response = await apiCall<{repositories: GitRepository[]}>('git/repositories')
      console.log('Repositories loaded:', response)
      setRepositories(response.repositories || [])
      
      // Auto-select the first active repository
      const activeRepos = response.repositories?.filter(repo => repo.is_active) || []
      if (activeRepos.length > 0) {
        console.log('Auto-selecting first active repository:', activeRepos[0].name)
        setSelectedRepo(activeRepos[0])
      }
    } catch (error) {
      console.error('Error loading repositories:', error)
    }
  }

  const loadFiles = async () => {
    if (!selectedRepo) {
      setLeftFiles([])
      setRightFiles([])
      return
    }

    try {
      const response = await apiCall<{files: FileItem[]}>(`files/list?repo_id=${selectedRepo.id}`)
      const files = Array.isArray(response?.files) ? response.files : []
      setLeftFiles(files)
      setRightFiles(files)
    } catch (error) {
      console.error('Error loading files:', error)
      // Ensure we always have arrays even on error
      setLeftFiles([])
      setRightFiles([])
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

  const handleFileSelect = (file: FileItem, side: 'left' | 'right') => {
    if (side === 'left') {
      setSelectedLeftFile(file)
      setLeftFileSearch(file.name)
      setShowLeftResults(false)
    } else {
      setSelectedRightFile(file)
      setRightFileSearch(file.name)
      setShowRightResults(false)
    }
  }

  const canCompare = () => {
    return selectedRepo && selectedLeftFile && selectedRightFile
  }

  const handleCompare = async () => {
    if (!canCompare()) return

    setLoading(true)
    try {
      const response = await apiCall<ComparisonResult>('files/compare', {
        method: 'POST',
        body: JSON.stringify({
          left_file: selectedLeftFile!.path,
          right_file: selectedRightFile!.path,
          repo_id: selectedRepo!.id
        })
      })

      setComparisonResult(response)
      setShowComparison(true)
      setCurrentDiffIndex(0)
    } catch (error) {
      console.error('Error comparing files:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportDiff = () => {
    if (!comparisonResult) return

    const unifiedDiff = mergeLinesToUnified(comparisonResult.left_lines, comparisonResult.right_lines)
    const diffContent = unifiedDiff
      .filter(line => !hideUnchanged || line.type !== 'equal')
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
      case 'equal': return '  '
      default: return '  '
    }
  }

  const getDiffLineClass = (type: DiffLine['type']) => {
    switch (type) {
      case 'insert': return 'bg-green-50 border-l-4 border-l-green-500'
      case 'delete': return 'bg-red-50 border-l-4 border-l-red-500'
      case 'replace': return 'bg-yellow-50 border-l-4 border-l-yellow-500'
      case 'equal': return 'bg-gray-50'
      default: return 'bg-gray-50'
    }
  }

  const getDiffIcon = (type: DiffLine['type']) => {
    switch (type) {
      case 'insert': return <span className="text-green-600">+</span>
      case 'delete': return <span className="text-red-600">-</span>
      case 'replace': return <span className="text-yellow-600">~</span>
      case 'equal': return <span className="text-gray-400"> </span>
      default: return <span className="text-gray-400"> </span>
    }
  }

  // Side-by-side styling functions
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
    <div key="unique-id-fh-1" className="space-y-6">
      {/* Header */}
      <div key="unique-id-fh-2" className="flex items-center justify-between">
        <div key="unique-id-fh-3">
          <h2 key="unique-id-fh-4" className="text-2xl font-bold text-gray-900">File Comparison</h2>
          <p key="unique-id-fh-5" className="text-gray-600 mt-1">Compare two configuration files side by side</p>
        </div>
        <div key="unique-id-fh-font-controls" className="flex items-center gap-3">
          <Label key="unique-id-fh-font-label" className="text-sm font-medium text-gray-700">Font Size:</Label>
          <Select value={fontSize.toString()} onValueChange={(value) => {
            setFontSize(parseInt(value))
            localStorage.setItem('diff_font_size', value)
          }}>
            <SelectTrigger key="unique-id-fh-font-trigger" className="w-24 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent key="unique-id-fh-font-content">
              <SelectItem value="8">8px</SelectItem>
              <SelectItem value="9">9px</SelectItem>
              <SelectItem value="10">10px</SelectItem>
              <SelectItem value="11">11px</SelectItem>
              <SelectItem value="12">12px</SelectItem>
              <SelectItem value="13">13px</SelectItem>
              <SelectItem value="14">14px</SelectItem>
              <SelectItem value="16">16px</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
              {/* Repository Selection */}
              <div key="unique-id-fh-repo" className="space-y-2">
                <Label key="unique-id-fh-repo-label">Repository</Label>
                <Select key="unique-id-fh-repo-select" value={selectedRepo?.id.toString() || '__none__'} onValueChange={(value) => {
                  if (value === '__none__') {
                    setSelectedRepo(null)
                  } else {
                    const repo = repositories.find(r => r.id.toString() === value)
                    if (repo) {
                      setSelectedRepo(repo)
                      // Clear file selections when repository changes
                      setSelectedLeftFile(null)
                      setSelectedRightFile(null)
                      setLeftFileSearch('')
                      setRightFileSearch('')
                    }
                  }
                }}>
                  <SelectTrigger key="unique-id-fh-repo-trigger" className="w-full border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
                    <SelectValue placeholder="Select repository" />
                  </SelectTrigger>
                  <SelectContent key="unique-id-fh-repo-content">
                    <SelectItem key="unique-id-fh-repo-none" value="__none__">Select repository...</SelectItem>
                    {repositories.map((repo) => (
                      <SelectItem key={`unique-id-fh-repo-${repo.id}`} value={repo.id.toString()}>
                        {repo.name} {!repo.is_active && '(inactive)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Source File Selection */}
              <div key="unique-id-fh-11" className="space-y-2" ref={leftSearchRef}>
                <Label key="unique-id-fh-12">Source File</Label>
                <div key="unique-id-fh-13" className="relative">
                  <Input
                    key="unique-id-fh-14"
                    placeholder="Search for source file..."
                    value={leftFileSearch}
                    onChange={(e) => {
                      setLeftFileSearch(e.target.value)
                      setShowLeftResults(e.target.value.length > 0)
                    }}
                    onFocus={() => setShowLeftResults(leftFileSearch.length > 0)}
                    disabled={!selectedRepo}
                    className="border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500"
                  />
                  {showLeftResults && selectedRepo && (
                    <div key="unique-id-fh-15" className="absolute top-full left-0 right-0 z-[99999] bg-white border border-gray-200 rounded-md shadow-xl max-h-60 overflow-y-auto">
                      {searchFiles(leftFileSearch, leftFiles || []).map((file, index) => (
                        <div
                          key={`unique-id-fh-16-${index}`}
                          className="p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                          onClick={() => handleFileSelect(file, 'left')}
                        >
                          <div key={`unique-id-fh-17-${index}`} className="font-medium text-sm">{file.name}</div>
                          <div key={`unique-id-fh-18-${index}`} className="text-xs text-gray-500">{file.path}</div>
                        </div>
                      ))}
                      {searchFiles(leftFileSearch, leftFiles || []).length === 0 && (
                        <div key="unique-id-fh-19" className="p-2 text-sm text-gray-500">No files found</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Target File Selection */}
              <div key="unique-id-fh-21" className="space-y-2" ref={rightSearchRef}>
                <Label key="unique-id-fh-22">Target File</Label>
                <div key="unique-id-fh-23" className="relative">
                  <Input
                    key="unique-id-fh-24"
                    placeholder="Search for target file..."
                    value={rightFileSearch}
                    onChange={(e) => {
                      setRightFileSearch(e.target.value)
                      setShowRightResults(e.target.value.length > 0)
                    }}
                    onFocus={() => setShowRightResults(rightFileSearch.length > 0)}
                    disabled={!selectedRepo}
                    className="border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500"
                  />
                  {showRightResults && selectedRepo && (
                    <div key="unique-id-fh-25" className="absolute top-full left-0 right-0 z-[99999] bg-white border border-gray-200 rounded-md shadow-xl max-h-60 overflow-y-auto">
                      {searchFiles(rightFileSearch, rightFiles || []).map((file, index) => (
                        <div
                          key={`unique-id-fh-26-${index}`}
                          className="p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                          onClick={() => handleFileSelect(file, 'right')}
                        >
                          <div key={`unique-id-fh-27-${index}`} className="font-medium text-sm">{file.name}</div>
                          <div key={`unique-id-fh-28-${index}`} className="text-xs text-gray-500">{file.path}</div>
                        </div>
                      ))}
                      {searchFiles(rightFileSearch, rightFiles || []).length === 0 && (
                        <div key="unique-id-fh-29" className="p-2 text-sm text-gray-500">No files found</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
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
                onClick={() => setHideUnchanged(!hideUnchanged)}
                className="flex items-center gap-2"
              >
                {hideUnchanged ? <Eye key="unique-id-fh-44" className="h-4 w-4" /> : <EyeOff key="unique-id-fh-45" className="h-4 w-4" />}
                <span key="unique-id-fh-46">{hideUnchanged ? 'Show' : 'Hide'} Unchanged</span>
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
                    disabled={currentDiffIndex === 0}
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
                      return currentDiffIndex >= visibleDiffs.length - 1
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
              style={{ fontSize: `${fontSize}px`, maxHeight: '600px' }}
            >
              {/* Side-by-side comparison header */}
              <div key="unique-id-fh-header" className="grid grid-cols-2 bg-gray-100 border-b sticky top-0" style={{ fontSize: `${Math.max(fontSize - 2, 8)}px` }}>
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
                  if (hideUnchanged && leftLine?.type === 'equal' && rightLine?.type === 'equal') {
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
