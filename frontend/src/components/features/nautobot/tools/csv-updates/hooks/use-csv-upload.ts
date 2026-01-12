import { useState, useCallback, useMemo } from 'react'
import type { ObjectType, CSVConfig, ParsedCSVData, ValidationResult } from '../types'
import { parseCSVContent, validateCSVData } from '../utils/csv-parser'
import { DEFAULT_CSV_CONFIG, EMPTY_PARSED_DATA, EMPTY_VALIDATION_RESULTS } from '../constants'

interface UseCsvUploadOptions {
  objectType: ObjectType
  onParseComplete?: (data: ParsedCSVData) => void
  onParseError?: (error: Error) => void
}

const DEFAULT_OPTIONS: UseCsvUploadOptions = {
  objectType: 'devices',
}

export function useCsvUpload(options: UseCsvUploadOptions = DEFAULT_OPTIONS) {
  const { objectType, onParseComplete, onParseError } = options

  const [csvConfig, setCsvConfig] = useState<CSVConfig>(DEFAULT_CSV_CONFIG)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<ParsedCSVData>(EMPTY_PARSED_DATA)
  const [validationResults, setValidationResults] = useState<ValidationResult[]>(EMPTY_VALIDATION_RESULTS)
  const [isParsing, setIsParsing] = useState(false)
  const [isValidating, setIsValidating] = useState(false)

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setCsvFile(file)
      setParsedData(EMPTY_PARSED_DATA)
      setValidationResults(EMPTY_VALIDATION_RESULTS)
    }
  }, [])

  const handleParseCSV = useCallback(async () => {
    if (!csvFile) return

    setIsParsing(true)
    setValidationResults(EMPTY_VALIDATION_RESULTS)

    try {
      const text = await csvFile.text()
      const { headers, rows } = parseCSVContent(text, csvConfig)

      const data: ParsedCSVData = {
        headers,
        rows,
        rowCount: rows.length,
      }

      setParsedData(data)

      // Start validation
      setIsValidating(true)
      const results = validateCSVData(objectType, headers, rows)
      setValidationResults(results)
      setIsValidating(false)

      onParseComplete?.(data)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to parse CSV'
      const errorObj = error instanceof Error ? error : new Error(errorMessage)

      setValidationResults([
        {
          type: 'error',
          message: errorMessage,
        },
      ])
      setIsValidating(false)

      onParseError?.(errorObj)
    } finally {
      setIsParsing(false)
    }
  }, [csvFile, csvConfig, objectType, onParseComplete, onParseError])

  const revalidate = useCallback(
    (newObjectType: ObjectType) => {
      if (parsedData.headers.length > 0) {
        setIsValidating(true)
        const results = validateCSVData(newObjectType, parsedData.headers, parsedData.rows)
        setValidationResults(results)
        setIsValidating(false)
      }
    },
    [parsedData]
  )

  const clearData = useCallback(() => {
    setCsvFile(null)
    setParsedData(EMPTY_PARSED_DATA)
    setValidationResults(EMPTY_VALIDATION_RESULTS)
  }, [])

  const updateConfig = useCallback((updates: Partial<CSVConfig>) => {
    setCsvConfig(prev => ({ ...prev, ...updates }))
  }, [])

  const validationSummary = useMemo(
    () => ({
      successCount: validationResults.filter(r => r.type === 'success').length,
      warningCount: validationResults.filter(r => r.type === 'warning').length,
      errorCount: validationResults.filter(r => r.type === 'error').length,
      hasErrors: validationResults.some(r => r.type === 'error'),
      isValid: validationResults.some(r => r.type === 'success') &&
               !validationResults.some(r => r.type === 'error'),
    }),
    [validationResults]
  )

  return useMemo(
    () => ({
      // State
      csvConfig,
      csvFile,
      parsedData,
      validationResults,
      isParsing,
      isValidating,
      validationSummary,

      // Actions
      handleFileChange,
      handleParseCSV,
      revalidate,
      clearData,
      updateConfig,
    }),
    [
      csvConfig,
      csvFile,
      parsedData,
      validationResults,
      isParsing,
      isValidating,
      validationSummary,
      handleFileChange,
      handleParseCSV,
      revalidate,
      clearData,
      updateConfig,
    ]
  )
}
