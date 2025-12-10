'use client'

import { useState, useCallback, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import { validateCSVHeaders, resolveNameToId, resolveLocationNameToId } from '../utils/helpers'
import type { ParsedCSVRow, BulkOnboardingResult, CSVLookupData } from '../types'

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

          // Extract custom fields (columns starting with "cf_")
          const customFields: Record<string, string> = {}
          headers.forEach(header => {
            if (header.startsWith('cf_') && row[header]) {
              // Remove "cf_" prefix to get the custom field key
              const cfKey = header.substring(3)
              customFields[cfKey] = row[header]
            }
          })

          // Parse tags (comma-separated list within the cell, using semicolon as separator to avoid conflict with CSV delimiter)
          // If tags column contains values like "tag1;tag2;tag3" or "tag1|tag2|tag3"
          let tags: string[] | undefined
          if (row.tags) {
            // Support semicolon, pipe, or space as tag separators within the tags column
            tags = row.tags.split(/[;|]/).map(t => t.trim()).filter(t => t.length > 0)
          }

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
            prefix_status: row.prefix_status || '',
            secret_groups: row.secret_groups || '',
            tags: tags,
            custom_fields: Object.keys(customFields).length > 0 ? customFields : undefined
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
    async (data: ParsedCSVRow[], lookupData: CSVLookupData) => {
      setIsUploading(true)
      setBulkResults([])

      const results: BulkOnboardingResult[] = []

      for (const row of data) {
        try {
          // Convert tag names to IDs
          let tagIds: string[] | undefined
          if (row.tags && row.tags.length > 0 && lookupData.availableTags.length > 0) {
            tagIds = row.tags
              .map(tagName => resolveNameToId(tagName, lookupData.availableTags))
              .filter(id => id.length > 0)
            if (tagIds.length === 0) {
              tagIds = undefined
            }
          }

          // Transform CSV row fields to match backend DeviceOnboardRequest model
          // Convert names to IDs using lookup data
          const requestBody = {
            ip_address: row.ip_address,
            location_id: resolveLocationNameToId(row.location, lookupData.locations),
            namespace_id: resolveNameToId(row.namespace, lookupData.namespaces),
            role_id: resolveNameToId(row.role, lookupData.deviceRoles),
            status_id: resolveNameToId(row.status, lookupData.deviceStatuses),
            platform_id: row.platform ? resolveNameToId(row.platform, lookupData.platforms) : 'detect',
            secret_groups_id: row.secret_groups ? resolveNameToId(row.secret_groups, lookupData.secretGroups) : '',
            interface_status_id: row.interface_status ? resolveNameToId(row.interface_status, lookupData.interfaceStatuses) : '',
            ip_address_status_id: row.ip_address_status ? resolveNameToId(row.ip_address_status, lookupData.ipAddressStatuses) : '',
            prefix_status_id: row.prefix_status ? resolveNameToId(row.prefix_status, lookupData.prefixStatuses) : '',
            port: row.port || 22,
            timeout: row.timeout || 30,
            tags: tagIds,
            custom_fields: row.custom_fields
          }

          const result = await callApi.apiCall<{ message: string; job_id: string }>(
            '/nautobot/devices/onboard',
            {
              method: 'POST',
              body: requestBody
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
