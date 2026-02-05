// Template model
export interface Template {
  id: number
  name: string
  source: 'git' | 'file' | 'webeditor'
  template_type: string
  category: string
  description: string
  updated_at: string
  created_by?: string
  scope: 'global' | 'private'
  variables?: Record<string, string>
  use_nautobot_context?: boolean
  git_repo_url?: string
  git_branch?: string
  git_path?: string
}

// Template form data
export interface TemplateFormData {
  name: string
  source: 'git' | 'file' | 'webeditor' | ''
  template_type: string
  category: string
  description: string
  content?: string
  scope: 'global' | 'private'
  variables?: Record<string, string>
  use_nautobot_context?: boolean
  git_repo_url?: string
  git_branch?: string
  git_path?: string
  git_username?: string
  git_token?: string
  filename?: string
}

// Importable template (from YAML)
export interface ImportableTemplate {
  name: string
  description: string
  category: string
  source: string
  file_path: string
  template_type: string
  selected?: boolean
}

// Import response
export interface TemplateImportResponse {
  success: boolean
  message: string
  imported_count?: number
  skipped_count?: number
  errors?: string[]
  imported_templates?: string[]
  failed_templates?: string[]
}

// API Response types
export interface TemplatesResponse {
  templates: Template[]
}

export interface TemplateContentResponse {
  content: string
}

export type CategoriesResponse = string[]

export interface ImportableTemplatesResponse {
  templates: ImportableTemplate[]
}

// Filter types
export interface TemplateFilters {
  category?: string
  source?: string
  search?: string
}

// Loading state type
export type LoadingState = 'idle' | 'loading' | 'error' | 'success'
