export type MatchSource = 'current' | 'history' | 'diff'
export type ChangeType = 'add' | 'remove' | 'replace'
export type SearchMode = 'current' | 'history' | 'diff'

export interface ConfigContentSearchRequest {
  query: string
  path_filter?: string
  include_history?: boolean
  diff_mode?: boolean
  commit1?: string | null
  commit2?: string | null
  case_sensitive?: boolean
  limit?: number
  offset?: number
}

export interface ConfigContentSearchMatch {
  file_path: string
  line_number: number
  line_content: string
  context_before?: string | null
  context_after?: string | null
  commit?: string | null
  commit_message?: string | null
  commit_date?: string | null
  match_source: MatchSource
  change_type?: ChangeType | null
}

export interface ConfigContentSearchData {
  matches: ConfigContentSearchMatch[]
  total_matches: number
  files_scanned: number
  truncated: boolean
  search_mode: SearchMode
}

export interface ConfigContentSearchResponse {
  success: boolean
  data: ConfigContentSearchData
}

export interface SearchCriteria {
  query: string
  pathFilter: string
  includeHistory: boolean
  diffMode: boolean
  commit1: string | null
  commit2: string | null
  caseSensitive: boolean
}

export interface PreviewMatch {
  match: ConfigContentSearchMatch
  query: string
}
