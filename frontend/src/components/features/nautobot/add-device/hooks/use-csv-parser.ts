'use client'

import { useState, useCallback, useMemo } from 'react'

interface UseCsvParserResult {
  csvFile: File | null
  headers: string[]
  csvContent: string
  isParsing: boolean
  parseError: string
  handleFileSelect: (
    file: File,
    onCompleted?: (headers: string[], content: string) => void
  ) => void
  clear: () => void
}

/**
 * Manages CSV file reading, BOM stripping, and header extraction.
 * Calls the optional `onCompleted` callback once headers are extracted.
 */
export function useCsvParser(delimiter: string): UseCsvParserResult {
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvContent, setCsvContent] = useState<string>('')
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState('')
  const [headers, setHeaders] = useState<string[]>([])

  const handleFileSelect = useCallback(
    (file: File, onCompleted?: (headers: string[], content: string) => void) => {
      setCsvFile(file)
      setIsParsing(true)
      setParseError('')
      setHeaders([])

      const reader = new FileReader()

      reader.onload = e => {
        try {
          const text = e.target?.result as string
          if (!text || text.trim() === '') {
            setParseError('CSV file is empty')
            setIsParsing(false)
            return
          }

          setCsvContent(text)

          const lines = text.split('\n').filter(line => line.trim())
          if (lines.length === 0) {
            setParseError('CSV file has no content')
            setIsParsing(false)
            return
          }

          const headerLine = lines[0]
          if (!headerLine) {
            setParseError('CSV file has no headers')
            setIsParsing(false)
            return
          }

          // Remove BOM and normalize
          const cleanHeaderLine = headerLine.replace(/^\uFEFF/, '').replace(/\r/g, '')
          const parsedHeaders = cleanHeaderLine
            .split(delimiter)
            .map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
            .filter(h => h !== '')

          setHeaders(parsedHeaders)
          setIsParsing(false)
          onCompleted?.(parsedHeaders, text)
        } catch (error) {
          setParseError(
            `Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
          setIsParsing(false)
        }
      }

      reader.onerror = () => {
        setParseError('Failed to read file')
        setIsParsing(false)
      }

      reader.readAsText(file, 'utf-8')
    },
    [delimiter]
  )

  const clear = useCallback(() => {
    setCsvFile(null)
    setCsvContent('')
    setHeaders([])
    setParseError('')
  }, [])

  return useMemo(
    () => ({ csvFile, headers, csvContent, isParsing, parseError, handleFileSelect, clear }),
    [csvFile, headers, csvContent, isParsing, parseError, handleFileSelect, clear]
  )
}
