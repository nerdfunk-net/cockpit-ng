'use client'

import { useState, useCallback, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import { validateCSVHeaders, resolveNameToId, resolveLocationNameToId } from '../utils/helpers'
import type { ParsedCSVRow, CSVLookupData } from '../types'

// Only ip_address is required in CSV - other fields will use app defaults if not provided
const REQUIRED_CSV_HEADERS = ['ip_address']

// Response from the bulk onboard Celery endpoint
interface BulkOnboardResponse {
  task_id: string
  status: string
  message: string
}

/**
 * Parse a CSV line respecting quoted values
 * @param line - CSV line to parse
 * @param delimiter - Delimiter character (default: comma)
 * @param quoteChar - Quote character (default: double quote)
 * @returns Array of parsed values
 */
function parseCSVLine(line: string, delimiter: string = ',', quoteChar: string = '"'): string[] {
  const values: string[] = []
  let currentValue = ''
  let inQuotes = false
  let i = 0

  while (i < line.length) {
    const char = line[i]

    if (char === quoteChar) {
      if (inQuotes && line[i + 1] === quoteChar) {
        // Escaped quote (two quotes in a row)
        currentValue += quoteChar
        i += 2
        continue
      }
      // Toggle quote state
      inQuotes = !inQuotes
      i++
      continue
    }

    if (char === delimiter && !inQuotes) {
      // End of field
      values.push(currentValue.trim())
      currentValue = ''
      i++
      continue
    }

    // Regular character
    currentValue += char
    i++
  }

  // Add the last field
  values.push(currentValue.trim())

  return values
}

export function useCSVUpload() {
  const callApi = useApi()
  const [showModal, setShowModal] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<ParsedCSVRow[]>([])
  const [isParsing, setIsParsing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string>('')
  const [parseError, setParseError] = useState<string>('')
  const [csvDelimiter, setCsvDelimiter] = useState<string>(',')
  const [csvQuoteChar, setCsvQuoteChar] = useState<string>('"')
  const [parallelJobs, setParallelJobs] = useState<number>(1)

  // Load CSV settings from backend on mount
  const loadCSVSettings = useCallback(async () => {
    try {
      const response = await callApi.apiCall<{
        success: boolean
        data: {
          csv_delimiter?: string
          csv_quote_char?: string
        }
      }>('settings/nautobot/defaults', {
        method: 'GET'
      })

      if (response.success && response.data) {
        if (response.data.csv_delimiter) {
          setCsvDelimiter(response.data.csv_delimiter)
        }
        if (response.data.csv_quote_char) {
          setCsvQuoteChar(response.data.csv_quote_char)
        }
      }
    } catch (error) {
      console.error('Failed to load CSV settings:', error)
      // Use defaults on error
    }
  }, [callApi])

  const openModal = useCallback(() => {
    setShowModal(true)
    setCsvFile(null)
    setParsedData([])
    setParseError('')
    setSubmitError('')
    setTaskId(null)
    
    // Load CSV settings from backend
    loadCSVSettings()
  }, [loadCSVSettings])

  const closeModal = useCallback(() => {
    setShowModal(false)
    setCsvFile(null)
    setParsedData([])
    setParseError('')
    setSubmitError('')
    setTaskId(null)
  }, [])

  const resetState = useCallback(() => {
    setCsvFile(null)
    setParsedData([])
    setParseError('')
    setSubmitError('')
    setTaskId(null)
  }, [])

  const parseCSV = useCallback((file: File, delimiter?: string, quoteChar?: string) => {
    setIsParsing(true)
    setParseError('')
    setSubmitError('')
    setTaskId(null)
    setCsvFile(file)

    // Use provided delimiters or current state values
    const effectiveDelimiter = delimiter !== undefined ? delimiter : csvDelimiter
    const effectiveQuoteChar = quoteChar !== undefined ? quoteChar : csvQuoteChar

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
        const headers = parseCSVLine(firstLine, effectiveDelimiter, effectiveQuoteChar).map(h => h.trim().toLowerCase())
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
          
          const values = parseCSVLine(line, effectiveDelimiter, effectiveQuoteChar)
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
  }, [csvDelimiter, csvQuoteChar])

  /**
   * Submit bulk onboarding via Celery task.
   * This creates a single trackable job for all devices.
   */
  const performBulkOnboarding = useCallback(
    async (data: ParsedCSVRow[], lookupData: CSVLookupData): Promise<string | null> => {
      setIsSubmitting(true)
      setSubmitError('')
      setTaskId(null)

      try {
        const defaults = lookupData.defaults

        // Transform CSV rows into device configs for Celery task
        const devices = data
          .filter(row => !!row?.ip_address)
          .map(row => {
            // Strip netmask/prefix from IP address if present
            // Non-null assertion is safe here because we filtered for truthy ip_address above
            const ipAddress = row.ip_address!.split('/')[0]!.trim()

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

            return {
              ip_address: ipAddress,
              // Use CSV value if provided (resolved to ID), otherwise leave undefined to use defaults
              location_id: row.location ? resolveLocationNameToId(row.location, lookupData.locations) : undefined,
              namespace_id: row.namespace ? resolveNameToId(row.namespace, lookupData.namespaces) : undefined,
              role_id: row.role ? resolveNameToId(row.role, lookupData.deviceRoles) : undefined,
              status_id: row.status ? resolveNameToId(row.status, lookupData.deviceStatuses) : undefined,
              platform_id: row.platform ? resolveNameToId(row.platform, lookupData.platforms) : undefined,
              secret_groups_id: row.secret_groups ? resolveNameToId(row.secret_groups, lookupData.secretGroups) : undefined,
              interface_status_id: row.interface_status ? resolveNameToId(row.interface_status, lookupData.interfaceStatuses) : undefined,
              ip_address_status_id: row.ip_address_status ? resolveNameToId(row.ip_address_status, lookupData.ipAddressStatuses) : undefined,
              prefix_status_id: row.prefix_status ? resolveNameToId(row.prefix_status, lookupData.prefixStatuses) : undefined,
              port: row.port || undefined,
              timeout: row.timeout || undefined,
              tags: tagIds,
              custom_fields: row.custom_fields,
            }
          })

        // Build default config from app settings
        const defaultConfig = {
          location_id: defaults?.location || '',
          namespace_id: defaults?.namespace || '',
          role_id: defaults?.device_role || '',
          status_id: defaults?.device_status || '',
          platform_id: defaults?.platform || 'detect',
          secret_groups_id: defaults?.secret_group || '',
          interface_status_id: defaults?.interface_status || '',
          ip_address_status_id: defaults?.ip_address_status || '',
          prefix_status_id: defaults?.ip_prefix_status || '',
          port: 22,
          timeout: 30,
          onboarding_timeout: 120,
          sync_options: ['cables', 'software', 'vlans', 'vrfs'],
        }

        // Submit to Celery bulk onboard endpoint
        const response = await callApi.apiCall<BulkOnboardResponse>(
          'celery/tasks/bulk-onboard-devices',
          {
            method: 'POST',
            body: {
              devices,
              default_config: defaultConfig,
              parallel_jobs: parallelJobs,
            }
          }
        )

        if (response.task_id) {
          setTaskId(response.task_id)
          setIsSubmitting(false)
          return response.task_id
        } else {
          throw new Error(response.message || 'Failed to start bulk onboarding task')
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        setSubmitError(errorMessage)
        setIsSubmitting(false)
        return null
      }
    },
    [callApi, parallelJobs]
  )

  return useMemo(
    () => ({
      showModal,
      csvFile,
      parsedData,
      isParsing,
      isSubmitting,
      taskId,
      submitError,
      parseError,
      csvDelimiter,
      csvQuoteChar,
      parallelJobs,
      setCsvDelimiter,
      setCsvQuoteChar,
      setParallelJobs,
      openModal,
      closeModal,
      resetState,
      parseCSV,
      performBulkOnboarding,
    }),
    [
      showModal,
      csvFile,
      parsedData,
      isParsing,
      isSubmitting,
      taskId,
      submitError,
      parseError,
      csvDelimiter,
      csvQuoteChar,
      parallelJobs,
      openModal,
      closeModal,
      resetState,
      parseCSV,
      performBulkOnboarding,
    ]
  )
}
