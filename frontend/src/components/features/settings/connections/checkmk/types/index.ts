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

export type ExpressionKey =
  | 'role'
  | 'status'
  | 'location'
  | 'manufacturer'
  | 'device_type'
  | 'platform'
  | 'custom_field'
  | 'ip_prefix'

export interface ExpressionCondition {
  type: 'condition'
  key: ExpressionKey
  field?: string
  value: string
}

export interface ExpressionConnector {
  type: 'connector'
  operator: 'and' | 'or'
}

export type ExpressionItem = ExpressionCondition | ExpressionConnector

export interface CheckMKPriorityRule {
  id: number
  priority_order: number
  filename: string
  expression: ExpressionItem[]
  created_at: string
  updated_at: string
}
