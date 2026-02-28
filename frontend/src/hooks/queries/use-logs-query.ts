import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'

export interface LogsFilters {
  page?: number
  page_size?: number
  severity?: string
  event_type?: string
  username?: string
  start_date?: string
  end_date?: string
  search?: string
}

export interface AuditLogItem {
  id: number
  username: string
  user_id: number | null
  event_type: string
  message: string
  ip_address: string | null
  resource_type: string | null
  resource_id: string | null
  resource_name: string | null
  severity: string
  extra_data: string | null
  created_at: string
}

export interface AuditLogsResponse {
  items: AuditLogItem[]
  total: number
  page: number
  page_size: number
}

export interface EventTypesResponse {
  event_types: string[]
}

const DEFAULT_FILTERS: LogsFilters = {}

export function useLogEventTypesQuery() {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.general.eventTypes(),
    queryFn: () => apiCall<EventTypesResponse>('logs/event-types'),
    staleTime: 5 * 60 * 1000, // 5 min — event types change rarely
  })
}

export function useLogsQuery(filters: LogsFilters = DEFAULT_FILTERS) {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.general.logs(filters),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.page) params.append('page', String(filters.page))
      if (filters.page_size) params.append('page_size', String(filters.page_size))
      if (filters.severity) params.append('severity', filters.severity)
      if (filters.event_type) params.append('event_type', filters.event_type)
      if (filters.username) params.append('username', filters.username)
      if (filters.start_date) params.append('start_date', filters.start_date)
      if (filters.end_date) params.append('end_date', filters.end_date)
      if (filters.search) params.append('search', filters.search)
      const qs = params.toString()
      return apiCall<AuditLogsResponse>(`logs${qs ? `?${qs}` : ''}`)
    },
    staleTime: 30 * 1000,
  })
}
