/**
 * Shared File Search Input Component
 * Used across all compare pages for file selection with autocomplete
 */

import { useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FileItem } from '@/types/git'

interface FileSearchInputProps {
  label?: string
  placeholder?: string
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  showResults: boolean
  onShowResultsChange: (show: boolean) => void
  filteredFiles: FileItem[]
  onFileSelect: (file: FileItem) => void
  searchRef: React.RefObject<HTMLDivElement | null>
  disabled?: boolean
  className?: string
}

export function FileSearchInput({
  label = 'File',
  placeholder = 'Search for file...',
  searchQuery,
  onSearchQueryChange,
  showResults,
  onShowResultsChange,
  filteredFiles,
  onFileSelect,
  searchRef,
  disabled = false,
  className = ''
}: FileSearchInputProps) {
  // Memoize callbacks to prevent creating new functions on every render
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchQueryChange(e.target.value)
    onShowResultsChange(e.target.value.length > 0)
  }, [onSearchQueryChange, onShowResultsChange])

  const handleFocus = useCallback(() => {
    onShowResultsChange(searchQuery.length > 0)
  }, [onShowResultsChange, searchQuery])

  const handleFileClick = useCallback((file: FileItem) => {
    onFileSelect(file)
    onSearchQueryChange(file.name)
    onShowResultsChange(false)
  }, [onFileSelect, onSearchQueryChange, onShowResultsChange])

  return (
    <div className={`space-y-2 ${className}`} ref={searchRef}>
      <Label>{label}</Label>
      <div className="relative">
        <Input
          placeholder={placeholder}
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={handleFocus}
          disabled={disabled}
          className="border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500"
        />
        {showResults && (
          <div className="absolute top-full left-0 right-0 z-[9999] bg-white border border-gray-200 rounded-md shadow-xl max-h-60 overflow-y-auto">
            {filteredFiles.map((file) => (
              <div
                key={file.path}
                className="p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                onClick={() => handleFileClick(file)}
              >
                <div className="font-medium text-sm">{file.name}</div>
                <div className="text-xs text-gray-500">{file.path}</div>
              </div>
            ))}
            {filteredFiles.length === 0 && (
              <div className="p-2 text-sm text-gray-500">No files found</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
