export interface CheckMKSettings {
  url: string
  site: string
  username: string
  password: string
  verify_ssl: boolean
}

export interface ValidationError {
  message: string
  error?: string
  line?: number
  column?: number
  filename?: string
}

export interface YamlFile {
  filename: 'checkmk.yaml' | 'checkmk_queries.yaml'
  content: string
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
}

export interface ValidationResponse {
  success: boolean
  valid: boolean
  message?: string
  error?: string
  line?: number
  column?: number
}

export interface TestConnectionResponse {
  success: boolean
  message?: string
}

export interface SaveYamlResponse {
  success: boolean
  message?: string
}

export interface LoadYamlResponse {
  success: boolean
  data?: string
  message?: string
}
