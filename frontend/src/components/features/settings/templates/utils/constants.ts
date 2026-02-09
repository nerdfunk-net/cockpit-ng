import type { TemplateFormData, Template, ImportableTemplate } from '../types'

// React best practice: Extract default objects to prevent re-render loops
export const DEFAULT_TEMPLATE_FORM_DATA: TemplateFormData = {
  name: '',
  source: 'webeditor',
  template_type: 'jinja2',
  category: '__none__',
  description: '',
  content: '',
  scope: 'global',
  variables: {},
  use_nautobot_context: true,
  git_repo_url: '',
  git_branch: 'main',
  git_path: '',
  git_username: '',
  git_token: ''
} as const

export const EMPTY_TEMPLATES: Template[] = []
export const EMPTY_CATEGORIES: string[] = []
export const EMPTY_IMPORTABLE: ImportableTemplate[] = []

export const STALE_TIME = {
  TEMPLATES: 30 * 1000,      // 30 seconds - moderate frequency
  CATEGORIES: 5 * 60 * 1000, // 5 minutes - rarely changes
  CONTENT: 60 * 1000,        // 1 minute - content can change
  IMPORTABLE: 2 * 60 * 1000, // 2 minutes - scan results
} as const

export const TEMPLATE_TYPES = ['jinja2', 'text', 'textfsm'] as const
export const TEMPLATE_SOURCES = ['git', 'file', 'webeditor'] as const
export const TEMPLATE_SCOPES = ['global', 'private'] as const
export const CANONICAL_CATEGORIES = ['netmiko', 'agent'] as const

export const FILE_ACCEPT_TYPES = '.txt,.conf,.cfg,.j2,.jinja2,.textfsm'
