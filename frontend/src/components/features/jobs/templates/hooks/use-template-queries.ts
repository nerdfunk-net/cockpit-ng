import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type {
  JobTemplate,
  JobType,
  GitRepository,
  SavedInventory,
  CommandTemplate,
  CustomField,
  IpAddressStatus,
  IpAddressTag,
  CsvRepoFile,
  NautobotDefaults,
} from '../types'
import {
  STALE_TIME,
  EMPTY_TEMPLATES,
  EMPTY_TYPES,
  EMPTY_REPOS,
  EMPTY_INVENTORIES,
  EMPTY_CMD_TEMPLATES,
  EMPTY_CUSTOM_FIELDS,
  EMPTY_IP_STATUSES,
  EMPTY_IP_TAGS,
  EMPTY_CSV_FILES,
  EMPTY_HEADERS,
  EMPTY_GROUPS,
} from '../utils/constants'

interface UseQueryOptions {
  enabled?: boolean
}

interface UseCsvFilesOptions {
  repoId: number | null
  query?: string
  enabled?: boolean
}

interface UseCsvHeadersOptions {
  repoId: number | null
  filePath: string | null
  delimiter?: string
  quoteChar?: string
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseQueryOptions = { enabled: true }
const DEFAULT_CSV_FILES_OPTIONS: UseCsvFilesOptions = { repoId: null }
const DEFAULT_CSV_HEADERS_OPTIONS: UseCsvHeadersOptions = {
  repoId: null,
  filePath: null,
}

/**
 * Fetch all job templates
 * Replaces: fetchTemplates() (lines 181-201)
 */
export function useJobTemplates(options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.templates(),
    queryFn: async () => {
      const response = await apiCall<{ templates: JobTemplate[] }>(
        '/api/job-templates',
        { method: 'GET' }
      )
      return response?.templates || EMPTY_TEMPLATES
    },
    enabled,
    staleTime: STALE_TIME.TEMPLATES,
  })
}

/**
 * Fetch available job types
 * Replaces: fetchJobTypes() (lines 204-222)
 */
export function useJobTypes(options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.jobTypes(),
    queryFn: async () => {
      const response = await apiCall<JobType[]>('/api/job-templates/types', {
        method: 'GET',
      })
      return response || EMPTY_TYPES
    },
    enabled,
    staleTime: STALE_TIME.JOB_TYPES,
  })
}

/**
 * Fetch config repositories
 * Replaces: fetchConfigRepos() (lines 225-243)
 */
export function useConfigRepos(options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.configRepos('device_configs'),
    queryFn: async () => {
      const response = await apiCall<{ repositories: GitRepository[] }>(
        '/api/git-repositories?category=device_configs',
        { method: 'GET' }
      )
      return response?.repositories || EMPTY_REPOS
    },
    enabled,
    staleTime: STALE_TIME.CONFIG_REPOS,
  })
}

/**
 * Fetch saved inventories
 * Replaces: fetchSavedInventories() (lines 249-271)
 */
export function useSavedInventories(options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.savedInventories(),
    queryFn: async () => {
      const response = await apiCall<{ inventories: SavedInventory[] }>('/inventory', {
        method: 'GET',
      })
      return response?.inventories || EMPTY_INVENTORIES
    },
    enabled,
    staleTime: STALE_TIME.INVENTORIES,
  })
}

/**
 * Fetch all unique inventory group paths for the group filter dropdown
 */
export function useInventoryGroups(options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.inventory.groups(),
    queryFn: async () => {
      const response = await apiCall<{ groups: string[] }>('/inventory/get-all-groups', {
        method: 'GET',
      })
      return response?.groups ?? EMPTY_GROUPS
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Fetch command templates
 * Replaces: fetchCommandTemplates() (lines 274-292)
 */
export function useCommandTemplates(options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.commandTemplates(),
    queryFn: async () => {
      const response = await apiCall<{ templates: CommandTemplate[] }>(
        '/api/templates',
        { method: 'GET' }
      )
      return response?.templates || EMPTY_CMD_TEMPLATES
    },
    enabled,
    staleTime: STALE_TIME.CMD_TEMPLATES,
  })
}

/**
 * Fetch custom fields for devices
 * Replaces: fetchCustomFields() (lines 295-321)
 */
export function useCustomFields(options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.customFields('devices'),
    queryFn: async () => {
      const response = await apiCall<CustomField[]>(
        '/api/nautobot/custom-fields/devices',
        { method: 'GET' }
      )
      const allFields = Array.isArray(response) ? response : []

      // Filter for text and date type custom fields that can hold timestamp
      const fields = allFields.filter((cf: CustomField) => {
        const cfType = cf.type?.value?.toLowerCase() || ''
        return ['text', 'date', 'datetime', 'url'].includes(cfType)
      })

      return fields || EMPTY_CUSTOM_FIELDS
    },
    enabled,
    staleTime: STALE_TIME.CUSTOM_FIELDS,
  })
}

/**
 * Fetch IP address statuses from Nautobot
 * Used in Maintain IP-Addresses job template (mark action)
 */
export function useIpAddressStatuses(options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.nautobot.statuses('ipaddress'),
    queryFn: async () => {
      const data = await apiCall<IpAddressStatus[]>('nautobot/statuses/ipaddress', {
        method: 'GET',
      })
      return Array.isArray(data) ? data : EMPTY_IP_STATUSES
    },
    enabled,
    staleTime: STALE_TIME.IP_OPTIONS,
  })
}

/**
 * Fetch IP address tags from Nautobot
 * Used in Maintain IP-Addresses job template (mark action)
 */
export function useIpAddressTags(options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.nautobot.tags('ip-addresses'),
    queryFn: async () => {
      const data = await apiCall<IpAddressTag[]>('nautobot/tags/ip-addresses', {
        method: 'GET',
      })
      return Array.isArray(data) ? data : EMPTY_IP_TAGS
    },
    enabled,
    staleTime: STALE_TIME.IP_OPTIONS,
  })
}

/**
 * Fetch Git repositories with category=csv_imports
 * Used in CSV Import job template
 */
export function useCsvImportRepos(options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.csvImportRepos(),
    queryFn: async () => {
      const response = await apiCall<{ repositories: GitRepository[] }>(
        '/api/git-repositories?category=csv_imports',
        { method: 'GET' }
      )
      return response?.repositories || EMPTY_REPOS
    },
    enabled,
    staleTime: STALE_TIME.CSV_REPOS,
  })
}

/**
 * Fetch CSV files from a Git repository
 * Used in CSV Import job template
 */
export function useCsvFiles(options: UseCsvFilesOptions = DEFAULT_CSV_FILES_OPTIONS) {
  const { apiCall } = useApi()
  const { repoId, query = '', enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.csvFiles(repoId, query),
    queryFn: async () => {
      const params = query ? `?query=${encodeURIComponent(query)}` : ''
      const response = await apiCall<{
        success: boolean
        data: { files: CsvRepoFile[] }
      }>(`/api/git/${repoId}/csv-files${params}`, { method: 'GET' })
      return response?.data?.files || EMPTY_CSV_FILES
    },
    enabled: enabled && !!repoId,
    staleTime: STALE_TIME.CSV_FILES,
  })
}

/**
 * Fetch CSV column headers from a file in a Git repository
 * Used in CSV Import job template
 */
export function useCsvHeaders(
  options: UseCsvHeadersOptions = DEFAULT_CSV_HEADERS_OPTIONS
) {
  const { apiCall } = useApi()
  const { repoId, filePath, delimiter = ',', quoteChar = '"', enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.csvHeaders(repoId, filePath, delimiter),
    queryFn: async () => {
      const params = new URLSearchParams({
        path: filePath!,
        delimiter,
        quote_char: quoteChar,
      })
      const response = await apiCall<{ success: boolean; headers: string[] }>(
        `/api/git/${repoId}/csv-headers?${params.toString()}`,
        { method: 'GET' }
      )
      return response?.headers || EMPTY_HEADERS
    },
    enabled: enabled && !!repoId && !!filePath,
    staleTime: STALE_TIME.CSV_HEADERS,
  })
}

/**
 * Fetch Git repositories with category=csv_exports
 * Used in CSV Export job template
 */
export function useCsvExportRepos(options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.jobs.csvExportRepos(),
    queryFn: async () => {
      const response = await apiCall<{ repositories: GitRepository[] }>(
        '/api/git-repositories?category=csv_exports',
        { method: 'GET' }
      )
      return response?.repositories || EMPTY_REPOS
    },
    enabled,
    staleTime: STALE_TIME.CSV_REPOS,
  })
}

/**
 * Fetch Nautobot default settings (csv_delimiter, csv_quote_char)
 * Used in CSV Import job template
 */
export function useNautobotDefaults(options: UseQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.nautobotSettings.defaults(),
    queryFn: async () => {
      const response = await apiCall<{ success: boolean; data: NautobotDefaults }>(
        '/api/settings/nautobot/defaults',
        { method: 'GET' }
      )
      return response?.data || null
    },
    enabled,
    staleTime: STALE_TIME.NAUTOBOT_DEFAULTS,
  })
}
