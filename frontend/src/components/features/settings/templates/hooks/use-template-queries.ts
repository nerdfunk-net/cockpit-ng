import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useMemo } from 'react'
import type {
  TemplatesResponse,
  TemplateContentResponse,
  CategoriesResponse,
  ImportableTemplatesResponse,
  TemplateFilters
} from '../types'
import {
  STALE_TIME,
  EMPTY_TEMPLATES,
  EMPTY_CATEGORIES,
  EMPTY_IMPORTABLE
} from '../utils/constants'
import { filterTemplates } from '../utils/template-utils'

interface UseTemplatesOptions {
  filters?: TemplateFilters
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseTemplatesOptions = { enabled: true }

/**
 * Fetch templates list with automatic caching and filtering
 */
export function useTemplates(options: UseTemplatesOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { filters, enabled = true } = options

  const query = useQuery({
    queryKey: queryKeys.templates.list(filters),
    queryFn: async () => {
      const response = await apiCall<TemplatesResponse>('templates', { method: 'GET' })
      return response.templates || EMPTY_TEMPLATES
    },
    enabled,
    staleTime: STALE_TIME.TEMPLATES,
  })

  // Client-side filtering for better UX (no network delay)
  const filteredTemplates = useMemo(() => {
    if (!query.data) return EMPTY_TEMPLATES
    if (!filters) return query.data
    return filterTemplates(query.data, filters)
  }, [query.data, filters])

  return {
    ...query,
    templates: filteredTemplates,
    allTemplates: query.data || EMPTY_TEMPLATES
  }
}

const DEFAULT_CATEGORY_OPTIONS: { enabled?: boolean } = {}

/**
 * Fetch template categories with automatic caching
 */
export function useTemplateCategories(options: { enabled?: boolean } = DEFAULT_CATEGORY_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.templates.categories(),
    queryFn: async () => {
      const response = await apiCall<CategoriesResponse>('templates/categories', { method: 'GET' })
      return response || EMPTY_CATEGORIES
    },
    enabled,
    staleTime: STALE_TIME.CATEGORIES,
  })
}

const DEFAULT_CONTENT_OPTIONS: { enabled?: boolean } = {}

/**
 * Fetch template content for editing
 */
export function useTemplateContent(templateId: number | null, options: { enabled?: boolean } = DEFAULT_CONTENT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.templates.content(templateId!),
    queryFn: async () => {
      const response = await apiCall<TemplateContentResponse>(
        `templates/${templateId}/content`,
        { method: 'GET' }
      )
      return response.content || ''
    },
    enabled: enabled && templateId !== null,
    staleTime: STALE_TIME.CONTENT,
  })
}

const DEFAULT_IMPORTABLE_OPTIONS: { enabled?: boolean } = {}

/**
 * Fetch importable templates from directory scan
 */
export function useImportableTemplates(options: { enabled?: boolean } = DEFAULT_IMPORTABLE_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.templates.importable(),
    queryFn: async () => {
      const response = await apiCall<ImportableTemplatesResponse>(
        'templates/scan-import',
        { method: 'GET' }
      )
      return (response.templates || EMPTY_IMPORTABLE).map(template => ({
        ...template,
        selected: true // Default to selected
      }))
    },
    enabled,
    staleTime: STALE_TIME.IMPORTABLE,
  })
}
