import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { Template, TemplatesListResponse } from '../types/templates'
import { STALE_TIME, EMPTY_TEMPLATES } from '../utils/template-constants'

interface UseTemplatesQueryOptions {
  category?: string
  source?: string
  search?: string
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseTemplatesQueryOptions = {}

/**
 * Fetch templates list with automatic caching.
 * Uses existing queryKeys.templates.list() from lib/query-keys.ts.
 */
export function useTemplatesQuery(options: UseTemplatesQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { category, source, search, enabled = true } = options

  const filters = { category, source, search }

  return useQuery({
    queryKey: queryKeys.templates.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (category) params.set('category', category)
      if (source) params.set('source', source)
      if (search) params.set('search', search)
      const qs = params.toString()
      return apiCall<TemplatesListResponse>(`templates${qs ? `?${qs}` : ''}`)
    },
    enabled,
    staleTime: STALE_TIME.TEMPLATES,
    select: (data) => data.templates || EMPTY_TEMPLATES,
  })
}

/**
 * Fetch a single template by ID.
 * Uses existing queryKeys.templates.detail() from lib/query-keys.ts.
 */
export function useTemplateDetailQuery(templateId: number | null, enabled = false) {
  const { apiCall } = useApi()

  return useQuery({
    queryKey: queryKeys.templates.detail(templateId!),
    queryFn: async () => apiCall<Template>(`templates/${templateId}`),
    enabled: !!templateId && enabled,
    staleTime: 0,
  })
}
