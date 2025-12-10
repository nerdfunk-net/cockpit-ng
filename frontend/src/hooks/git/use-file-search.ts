/**
 * Custom hook for file search functionality
 * Handles file searching, filtering, and click-outside detection
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { FileItem } from '@/types/git'

export function useFileSearch(files: FileItem[]) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  // Filter files based on search query
  const filteredFiles = useMemo(() => {
    if (!searchQuery) return files
    const query = searchQuery.toLowerCase()
    return files.filter(file =>
      file.name.toLowerCase().includes(query) ||
      file.path.toLowerCase().includes(query)
    )
  }, [files, searchQuery])

  // Handle clicking outside the search dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleFileSelect = useCallback((file: FileItem) => {
    setSelectedFile(file)
    setSearchQuery(file.path)
    setShowResults(false)
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedFile(null)
    setSearchQuery('')
  }, [])

  return useMemo(() => ({
    searchQuery,
    setSearchQuery,
    showResults,
    setShowResults,
    selectedFile,
    setSelectedFile: handleFileSelect,
    clearSelection,
    filteredFiles,
    searchRef
  }), [searchQuery, showResults, selectedFile, handleFileSelect, clearSelection, filteredFiles, searchRef])
}
