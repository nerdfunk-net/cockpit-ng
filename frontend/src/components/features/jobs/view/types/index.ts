// Re-export from job-results.ts (one level up in jobs/types/)
export * from '../../types/job-results'

// Filter and API request types
export interface JobSearchParams {
  page?: number
  page_size?: number
  status?: string | string[]
  job_type?: string | string[]
  triggered_by?: string | string[]
  template_id?: string | string[]
}

// Template list response
export interface TemplatesResponse {
  templates: JobTemplate[]
}

export interface JobTemplate {
  id: number
  name: string
}

// Progress response (for backup jobs)
export interface JobProgressResponse {
  completed: number
  total: number
  percentage: number
}

// Mutation responses
export interface JobActionResponse {
  success: boolean
  message?: string
}

export interface ClearHistoryResponse {
  success: boolean
  message: string
  deleted_count: number
}

// Filter option type
export interface FilterOption {
  value: string
  label: string
}
