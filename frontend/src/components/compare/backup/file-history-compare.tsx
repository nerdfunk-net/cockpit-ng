'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  History, 
  GitCompare as GitCompareIcon, 
  Download, 
  Eye, 
  EyeOff, 
  ChevronUp, 
  ChevronDown,
  RefreshCw,
  Clock,
  CheckCircle2
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
  author: string
  date: string
  message: string
  short_hash: string
}

interface DiffLine {
  type: 'added' | 'removed' | 'modified' | 'unchanged'
  lineNumber: number
  content: string
  leftLineNumber?: number
  rightLineNumber?: number
}

interface ComparisonResult {
  title: string
  leftFile: string
  rightFile: string
  differences: DiffLine[]
  stats: {
    added: number
    removed: number
    modified: number
    unchanged: number
  }
}

export default function FileHistoryCompare() {
  const { apiCall } = useApi()
  
  // Git state
  const [branches, setBranches] = useState<Branch[]>([])
  const [historyBranch, setHistoryBranch] = useState<string>('')
  
  // File selection state
  const [gitFiles, setGitFiles] = useState<FileItem[]>([])
  const [selectedHistoryFile, setSelectedHistoryFile] = useState<FileItem | null>(null)
  const [historyFileSearch, setHistoryFileSearch] = useState('')
  const [showHistoryResults, setShowHistoryResults] = useState(false)
  
  // File history state
  const [fileHistory, setFileHistory] = useState<Commit[]>([])
  const [showFileHistory, setShowFileHistory] = useState(false)
  const [selectedHistoryRows, setSelectedHistoryRows] = useState<string[]>([])
  
  // Comparison state
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null)
  const [showComparison, setShowComparison] = useState(false)
  const [loading, setLoading] = useState(false)
  const [hideUnchanged, setHideUnchanged] = useState(false)
  const [currentDiffIndex, setCurrentDiffIndex] = useState(0)
  const [fontSize, setFontSize] = useState(12)
  
  // Refs for click outside handling
  const historySearchRef = useRef<HTMLDivElement>(null)

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
      if (historySearchRef.current && !historySearchRef.current.contains(event.target as Node)) {
        setShowHistoryResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadBranches = async () => {
    try {
      const response = await apiCall<Branch[]>('git/branches')
      setBranches(response)
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

  const loadFileHistory = async (file: FileItem) => {
    if (!file || !historyBranch) return

    try {
      const response = await apiCall<Commit[]>(`git/file-history?file=${encodeURIComponent(file.path)}&branch=${encodeURIComponent(historyBranch)}`)
      setFileHistory(response)
      setShowFileHistory(true)
      setSelectedHistoryRows([])
    } catch (error) {
      console.error('Error loading file history:', error)
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

  const handleHistoryFileSelect = (file: FileItem) => {
    setSelectedHistoryFile(file)
    setHistoryFileSearch('')
    setShowHistoryResults(false)
  }

  const canCompare = () => {
    return selectedHistoryRows.length === 2 && selectedHistoryFile
  }

  const handleCompare = async () => {
    if (!canCompare()) return

    setLoading(true)
    try {
      const [leftCommit, rightCommit] = selectedHistoryRows
      const response = await apiCall<ComparisonResult>('git/diff', {
        method: 'POST',
        body: JSON.stringify({
          left_commit: leftCommit,
          right_commit: rightCommit,
          file_path: selectedHistoryFile!.path
        })
      })

      setComparisonResult(response)
      setShowComparison(true)
      setCurrentDiffIndex(0)
    } catch (error) {
      console.error('Error comparing file history:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportDiff = () => {
    if (!comparisonResult) return

    const diffContent = comparisonResult.differences
      .filter(line => !hideUnchanged || line.type !== 'unchanged')
      .map(line => `${getDiffPrefix(line.type)}${line.content}`)
      .join('\n')

    const blob = new Blob([`--- ${comparisonResult.leftFile}\n+++ ${comparisonResult.rightFile}\n${diffContent}`], {
      type: 'text/plain'
    })
    
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `file-history-diff-${Date.now()}.patch`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const navigateDiff = (direction: 'next' | 'prev') => {
    if (!comparisonResult) return
    
    const visibleDiffs = comparisonResult.differences.filter(d => d.type !== 'unchanged')
    const maxIndex = visibleDiffs.length - 1
    
    if (direction === 'next' && currentDiffIndex < maxIndex) {
      setCurrentDiffIndex(currentDiffIndex + 1)
    } else if (direction === 'prev' && currentDiffIndex > 0) {
      setCurrentDiffIndex(currentDiffIndex - 1)
    }
  }

  const getDiffPrefix = (type: DiffLine['type']) => {
    switch (type) {
      case 'added': return '+ '
      case 'removed': return '- '
      case 'modified': return '~ '
      default: return '  '
    }
  }

  const getDiffLineClass = (type: DiffLine['type']) => {
    switch (type) {
      case 'added': return 'bg-green-50 border-l-4 border-l-green-500'
      case 'removed': return 'bg-red-50 border-l-4 border-l-red-500'
      case 'modified': return 'bg-yellow-50 border-l-4 border-l-yellow-500'
      default: return 'bg-gray-50'
    }
  }

  const getDiffIcon = (type: DiffLine['type']) => {
    switch (type) {
      case 'added': return <span key="diff-icon-added" className="text-green-600">+</span>
      case 'removed': return <span key="diff-icon-removed" className="text-red-600">-</span>
      case 'modified': return <span key="diff-icon-modified" className="text-yellow-600">~</span>
      default: return <span key="diff-icon-default" className="text-gray-400"> </span>
    }
  }

  return (
    <div key="unique-id-fhc-100" className="space-y-6">
      <div key="unique-id-fhc-101" className="flex items-center justify-between">
        <div key="unique-id-fhc-102">
          <h2 key="unique-id-fhc-103" className="text-2xl font-bold tracking-tight">File History Comparison</h2>
          <p key="unique-id-fhc-104" className="text-gray-600">Track changes to a specific file across its Git history</p>
        </div>
      </div>

      {/* File and Branch Selection */}
      <Card key="unique-id-fhc-105">
        <CardHeader key="unique-id-fhc-106">
          <CardTitle key="unique-id-fhc-107">Select File and Branch</CardTitle>
        </CardHeader>
        <CardContent key="unique-id-fhc-108">
          <div key="unique-id-fhc-109" className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div key="unique-id-fhc-110" className="space-y-2">
              <Label key="unique-id-fhc-111">Branch</Label>
              <Select key="unique-id-fhc-112" value={historyBranch || '__none__'} onValueChange={(value) => {
                const newValue = value === '__none__' ? '' : value
                setHistoryBranch(newValue)
              }}>
                <SelectTrigger key="unique-id-fhc-113">
                  <SelectValue key="unique-id-fhc-114" placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent key="unique-id-fhc-115">
                  <SelectItem key="__none__" value="__none__">Select branch...</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.name} value={branch.name}>
                      <span key={`unique-id-fhc-116-${branch.name}`}>
                        <span key={`unique-id-fhc-117-${branch.name}`}>{branch.name}</span>
                        {branch.current && <span key={`unique-id-fhc-118-${branch.name}`}> (current)</span>}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div key="unique-id-fhc-119" className="space-y-2" ref={historySearchRef}>
              <Label key="unique-id-fhc-120">File</Label>
              <div key="unique-id-fhc-121" className="relative">
                <Input
                  key="unique-id-fhc-122"
                  placeholder="Search for file..."
                  value={historyFileSearch}
                  onChange={(e) => {
                    setHistoryFileSearch(e.target.value)
                    setShowHistoryResults(e.target.value.length > 0)
                  }}
                  onFocus={() => setShowHistoryResults(historyFileSearch.length > 0)}
                />
                {showHistoryResults && (
                  <div key="unique-id-fhc-123" className="absolute top-full left-0 right-0 z-10 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {searchFiles(historyFileSearch, gitFiles || []).map((file, index) => (
                      <div
                        key={`unique-id-fhc-124-${index}`}
                        className="p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                        onClick={() => handleHistoryFileSelect(file)}
                      >
                        <div key={`unique-id-fhc-125-${index}`} className="font-medium text-sm">{file.name}</div>
                        <div key={`unique-id-fhc-126-${index}`} className="text-xs text-gray-500">{file.path}</div>
                      </div>
                    ))}
                    {searchFiles(historyFileSearch, gitFiles || []).length === 0 && (
                      <div key="unique-id-fhc-127" className="p-2 text-sm text-gray-500">No files found</div>
                    )}
                  </div>
                )}
              </div>
              {selectedHistoryFile && (
                <div key="unique-id-fhc-128" className="text-sm text-gray-600 bg-blue-50 p-2 rounded">
                  <span key="unique-id-fhc-129">Selected: {selectedHistoryFile.path}</span>
                </div>
              )}
            </div>
          </div>

          {selectedHistoryFile && historyBranch && (
            <div key="unique-id-fhc-130" className="mt-4">
              <Button 
                key="unique-id-fhc-131"
                onClick={() => loadFileHistory(selectedHistoryFile)}
                disabled={!selectedHistoryFile}
                className="flex items-center gap-2"
              >
                <History key="unique-id-fhc-132" className="h-4 w-4" />
                <span key="unique-id-fhc-133">Show File History</span>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* File History */}
      {showFileHistory && fileHistory.length > 0 && (
        <Card key="unique-id-fhc-134">
          <CardHeader key="unique-id-fhc-135">
            <CardTitle key="unique-id-fhc-136" className="flex items-center gap-2">
              <Clock key="unique-id-fhc-137" className="h-5 w-5" />
              <span key="unique-id-fhc-138">File History: {selectedHistoryFile?.name}</span>
            </CardTitle>
            <CardDescription key="unique-id-fhc-139">
              <span key="unique-id-fhc-140">Select two commits to compare (selected: {selectedHistoryRows.length}/2)</span>
            </CardDescription>
          </CardHeader>
          <CardContent key="unique-id-fhc-141">
            <div key="unique-id-fhc-142" className="space-y-2 max-h-96 overflow-y-auto">
              {fileHistory.map((commit, index) => (
                <div
                  key={`unique-id-fhc-143-${index}`}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedHistoryRows.includes(commit.hash)
                      ? 'bg-blue-50 border-blue-300'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => {
                    if (selectedHistoryRows.includes(commit.hash)) {
                      setSelectedHistoryRows(prev => prev.filter(h => h !== commit.hash))
                    } else if (selectedHistoryRows.length < 2) {
                      setSelectedHistoryRows(prev => [...prev, commit.hash])
                    }
                  }}
                >
                  <div key={`unique-id-fhc-144-${index}`} className="flex items-center justify-between">
                    <div key={`unique-id-fhc-145-${index}`} className="flex items-center gap-3">
                      {selectedHistoryRows.includes(commit.hash) && (
                        <CheckCircle2 key={`unique-id-fhc-146-${index}`} className="h-4 w-4 text-blue-600" />
                      )}
                      <div key={`unique-id-fhc-147-${index}`}>
                        <div key={`unique-id-fhc-148-${index}`} className="font-mono text-sm">{commit.short_hash}</div>
                        <div key={`unique-id-fhc-149-${index}`} className="text-sm text-gray-600">{commit.author}</div>
                      </div>
                    </div>
                    <div key={`unique-id-fhc-150-${index}`} className="text-right">
                      <div key={`unique-id-fhc-151-${index}`} className="text-sm font-medium">{commit.message}</div>
                      <div key={`unique-id-fhc-152-${index}`} className="text-xs text-gray-500">{new Date(commit.date).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compare Actions */}
      <Card key="unique-id-fhc-153">
        <CardContent key="unique-id-fhc-154" className="pt-6">
          <div key="unique-id-fhc-155" className="flex items-center justify-between">
            <div key="unique-id-fhc-156" className="flex items-center gap-2">
              <Button 
                key="unique-id-fhc-157"
                onClick={handleCompare} 
                disabled={!canCompare() || loading}
                className="flex items-center gap-2"
              >
                {loading ? (
                  <RefreshCw key="unique-id-fhc-158" className="h-4 w-4 animate-spin" />
                ) : (
                  <GitCompareIcon key="unique-id-fhc-159" className="h-4 w-4" />
                )}
                <span key="unique-id-fhc-160">Compare Selected Commits</span>
              </Button>
              
              {comparisonResult && (
                <Button 
                  key="unique-id-fhc-161"
                  variant="outline" 
                  onClick={exportDiff}
                  className="flex items-center gap-2"
                >
                  <Download key="unique-id-fhc-162" className="h-4 w-4" />
                  <span key="unique-id-fhc-163">Export Diff</span>
                </Button>
              )}
            </div>

            <div key="unique-id-fhc-164" className="flex items-center gap-2">
              <Button
                key="unique-id-fhc-165"
                variant="outline"
                size="sm"
                onClick={() => setHideUnchanged(!hideUnchanged)}
                className="flex items-center gap-2"
              >
                {hideUnchanged ? <Eye key="unique-id-fhc-166" className="h-4 w-4" /> : <EyeOff key="unique-id-fhc-167" className="h-4 w-4" />}
                <span key="unique-id-fhc-168">{hideUnchanged ? 'Show' : 'Hide'} Unchanged</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Results */}
      {showComparison && comparisonResult && (
        <Card key="unique-id-fhc-169">
          <CardHeader key="unique-id-fhc-170">
            <div key="unique-id-fhc-171" className="flex items-center justify-between">
              <div key="unique-id-fhc-172">
                <CardTitle key="unique-id-fhc-173" className="flex items-center gap-2">
                  <GitCompareIcon key="unique-id-fhc-174" className="h-5 w-5" />
                  <span key="unique-id-fhc-175">{comparisonResult.title}</span>
                </CardTitle>
                <CardDescription key="unique-id-fhc-176">
                  <span key="unique-id-fhc-177">{comparisonResult.leftFile}</span>
                  <span key="unique-id-fhc-178"> ↔ </span>
                  <span key="unique-id-fhc-179">{comparisonResult.rightFile}</span>
                </CardDescription>
              </div>
              <div key="unique-id-fhc-180" className="flex items-center gap-2">
                <div key="unique-id-fhc-181" className="text-sm text-gray-600">
                  <span key="unique-id-fhc-182" className="text-green-600">+{comparisonResult.stats.added}</span>
                  <span key="unique-id-fhc-183"> </span>
                  <span key="unique-id-fhc-184" className="text-red-600">-{comparisonResult.stats.removed}</span>
                  <span key="unique-id-fhc-185"> </span>
                  <span key="unique-id-fhc-186" className="text-yellow-600">~{comparisonResult.stats.modified}</span>
                </div>
                <div key="unique-id-fhc-187" className="flex items-center gap-1">
                  <Button
                    key="unique-id-fhc-188"
                    size="sm"
                    variant="outline"
                    onClick={() => navigateDiff('prev')}
                    disabled={currentDiffIndex === 0}
                  >
                    <ChevronUp key="unique-id-fhc-189" className="h-4 w-4" />
                  </Button>
                  <Button
                    key="unique-id-fhc-190"
                    size="sm"
                    variant="outline"
                    onClick={() => navigateDiff('next')}
                    disabled={currentDiffIndex >= comparisonResult.differences.filter(d => d.type !== 'unchanged').length - 1}
                  >
                    <ChevronDown key="unique-id-fhc-191" className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  key="unique-id-fhc-192"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowComparison(false)}
                >
                  <span key="unique-id-fhc-193">Close</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent key="unique-id-fhc-194">
            <div 
              key="unique-id-fhc-195"
              className="border rounded-lg overflow-auto font-mono text-sm"
              style={{ fontSize: `${fontSize}px`, maxHeight: '600px' }}
            >
              {comparisonResult.differences
                .filter(line => !hideUnchanged || line.type !== 'unchanged')
                .map((line, index) => (
                <div
                  key={`unique-id-fhc-196-${index}`}
                  className={`flex items-start gap-2 p-2 ${getDiffLineClass(line.type)}`}
                >
                  <div key={`unique-id-fhc-197-${index}`} className="flex-shrink-0 w-6 flex justify-center">
                    <span key={`unique-id-fhc-202-${index}-${line.type}`}>
                      {getDiffIcon(line.type)}
                    </span>
                  </div>
                  <div key={`unique-id-fhc-198-${index}`} className="flex-shrink-0 w-16 text-gray-500 text-right text-xs">
                    <div key={`unique-id-fhc-199-${index}`}>{line.leftLineNumber || ''}</div>
                    <div key={`unique-id-fhc-200-${index}`}>{line.rightLineNumber || ''}</div>
                  </div>
                  <div key={`unique-id-fhc-201-${index}`} className="flex-1 whitespace-pre-wrap break-all">
                    {line.content}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
