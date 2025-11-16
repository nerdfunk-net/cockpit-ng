'use client'

import { useState, useCallback, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import { validateCSVHeaders } from '../utils/helpers'
import type { ParsedCSVRow, BulkOnboardingResult } from '../types'

const REQUIRED_CSV_HEADERS = ['ip_address', 'location', 'namespace', 'role', 'status']

export function useCSVUpload() {
  const callApi = useApi()
  const [showModal, setShowModal] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<ParsedCSVRow[]>([])
  const [isParsing, setIsParsing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [bulkResults, setBulkResults] = useState<BulkOnboardingResult[]>([])
  const [parseError, setParseError] = useState<string>('')

  const openModal = useCallback(() => {
    setShowModal(true)
    setCsvFile(null)
    setParsedData([])
    setParseError('')
    setBulkResults([])
  }, [])

  const closeModal = useCallback(() => {
    setShowModal(false)
    setCsvFile(null)
    setParsedData([])
    setParseError('')
    setBulkResults([])
  }, [])

  const parseCSV = useCallback((file: File) => {
    setIsParsing(true)
    setParseError('')
    setCsvFile(file)

    const reader = new FileReader()
    reader.onload = e => {
      try {
        const text = e.target?.result as string
        const lines = text.split('\n').filter(line => line.trim())

        if (lines.length === 0) {
          setParseError('CSV file is empty')
          setIsParsing(false)
          return
        }

        // Parse headers
        const firstLine = lines[0]
        if (!firstLine) {
          setParseError('CSV file has no headers')
          setIsParsing(false)
          return
        }
        const headers = firstLine.split(',').map(h => h.trim().toLowerCase())
        const validation = validateCSVHeaders(headers, REQUIRED_CSV_HEADERS)

        if (!validation.isValid) {
          setParseError(
            `Invalid CSV headers. Missing: ${validation.missingHeaders.join(', ')}`
          )
          setIsParsing(false)
          return
        }

        // Parse rows
        const rows: ParsedCSVRow[] = []
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i]
          if (!line) continue
          
          const values = line.split(',').map(v => v.trim())
          if (values.length !== headers.length) {
            continue // Skip malformed rows
          }

          const row: Record<string, string> = {}
          headers.forEach((header, index) => {
            const value = values[index]
            if (value !== undefined) {
              row[header] = value
            }
          })

          rows.push({
            ip_address: row.ip_address || '',
            location: row.location || '',
            namespace: row.namespace || '',
            role: row.role || '',
            status: row.status || '',
            platform: row.platform || '',
            port: row.port ? parseInt(row.port, 10) : 22,
            timeout: row.timeout ? parseInt(row.timeout, 10) : 30,
            interface_status: row.interface_status || '',
            ip_address_status: row.ip_address_status || '',
            secret_groups: row.secret_groups || ''
          })
        }

        setParsedData(rows)
        setIsParsing(false)
      } catch (error) {
        setParseError(`Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`)
        setIsParsing(false)
      }
    }

    reader.onerror = () => {
      setParseError('Failed to read file')
      setIsParsing(false)
    }

    reader.readAsText(file)
  }, [])

  const performBulkOnboarding = useCallback(
    async (data: ParsedCSVRow[]) => {
      setIsUploading(true)
      setBulkResults([])

      const results: BulkOnboardingResult[] = []

      for (const row of data) {
        try {
          const result = await callApi.apiCall<{ message: string; job_id: string }>(
            '/nautobot/devices/onboard',
            {
              method: 'POST',
              body: row
            }
          )

          results.push({
            ip_address: row.ip_address,
            status: 'success',
            message: result.message || 'Onboarding initiated successfully',
            job_id: result.job_id
          })
        } catch (error) {
          results.push({
            ip_address: row.ip_address,
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error'
          })
        }

        setBulkResults([...results])
      }

      setIsUploading(false)
    },
    [callApi]
  )

  return useMemo(
    () => ({
      showModal,
      csvFile,
      parsedData,
      isParsing,
      isUploading,
      bulkResults,
      parseError,
      openModal,
      closeModal,
      parseCSV,
      performBulkOnboarding
    }),
    [
      showModal,
      csvFile,
      parsedData,
      isParsing,
      isUploading,
      bulkResults,
      parseError,
      openModal,
      closeModal,
      parseCSV,
      performBulkOnboarding
    ]
  )
}
