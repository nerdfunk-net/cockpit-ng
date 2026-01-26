import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { queryKeys } from '@/lib/query-keys'
import type { ObjectType } from '@/components/features/nautobot/tools/csv-updates/types'

interface ProcessCSVUpdatesInput {
  objectType: ObjectType
  csvData: {
    headers: string[]
    rows: string[][]
  }
  csvOptions?: {
    delimiter: string
    quoteChar: string
  }
  dryRun?: boolean
  ignoreUuid?: boolean  // For IP prefixes: use prefix+namespace lookup instead of UUID
  tagsMode?: 'replace' | 'merge'  // How to handle tags: replace all or merge with existing
  columnMapping?: Record<string, string>  // Maps lookup fields to CSV column names
}

interface CeleryTaskResponse {
  task_id: string
  job_id: string
  status: string
  message: string
}

/**
 * Convert CSV data (headers + rows) to CSV content string
 */
function convertToCSVContent(
  headers: string[],
  rows: string[][],
  delimiter: string = ',',
  quoteChar: string = '"'
): string {
  const escapeField = (field: string): string => {
    // If field contains delimiter, quote char, or newline, wrap it in quotes
    if (
      field.includes(delimiter) ||
      field.includes(quoteChar) ||
      field.includes('\n') ||
      field.includes('\r')
    ) {
      // Escape quote characters by doubling them
      const escaped = field.replace(new RegExp(quoteChar, 'g'), quoteChar + quoteChar)
      return `${quoteChar}${escaped}${quoteChar}`
    }
    return field
  }

  // Build header line
  const headerLine = headers.map(escapeField).join(delimiter)

  // Build data lines
  const dataLines = rows.map(row => row.map(escapeField).join(delimiter))

  // Combine with newlines
  return [headerLine, ...dataLines].join('\n')
}

/**
 * Get the API endpoint for the given object type
 */
function getEndpointForObjectType(objectType: ObjectType): string {
  switch (objectType) {
    case 'ip-prefixes':
      return 'celery/tasks/update-ip-prefixes-from-csv'
    case 'devices':
      return 'celery/tasks/update-devices-from-csv'
    case 'ip-addresses':
      return 'celery/tasks/update-ip-addresses-from-csv' // TODO: Implement
    case 'locations':
      return 'celery/tasks/update-locations-from-csv' // TODO: Implement
    default:
      throw new Error(`Unsupported object type: ${objectType}`)
  }
}

export function useCsvUpdatesMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const processUpdates = useMutation({
    mutationFn: async (input: ProcessCSVUpdatesInput): Promise<CeleryTaskResponse> => {
      // Convert CSV data to content string
      const csvContent = convertToCSVContent(
        input.csvData.headers,
        input.csvData.rows,
        input.csvOptions?.delimiter || ',',
        input.csvOptions?.quoteChar || '"'
      )

      // Get the correct endpoint for the object type
      const endpoint = getEndpointForObjectType(input.objectType)

      // Make API call
      const response = await apiCall(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          csv_content: csvContent,
          csv_options: input.csvOptions,
          dry_run: input.dryRun || false,
          ignore_uuid: input.ignoreUuid !== undefined ? input.ignoreUuid : true, // Default: true
          tags_mode: input.tagsMode || 'replace', // Default: replace
          column_mapping: input.columnMapping, // Pass column mapping if provided
        }),
      })

      return response as CeleryTaskResponse
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant caches based on object type
      switch (variables.objectType) {
        case 'devices':
          queryClient.invalidateQueries({ queryKey: queryKeys.nautobot.devices() })
          break
        case 'ip-prefixes':
        case 'ip-addresses':
          // Would invalidate IP-related queries if they existed
          break
        case 'locations':
          queryClient.invalidateQueries({ queryKey: queryKeys.nautobot.locations() })
          break
      }

      // Show success toast with task info
      const mode = variables.dryRun ? ' (Dry Run)' : ''
      toast({
        title: 'Task Queued',
        description: `${data.message}${mode}. Task ID: ${data.task_id}`,
      })
    },
    onError: (error: Error, variables) => {
      toast({
        title: 'Error',
        description: error.message || `Failed to process ${variables.objectType} updates`,
        variant: 'destructive',
      })
    },
  })

  return {
    processUpdates,
  }
}
