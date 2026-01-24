export interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
}

export interface RegexPattern {
  id: number
  pattern: string
  description?: string
  pattern_type: 'must_match' | 'must_not_match'
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LoginCredential {
  id: number
  name: string
  username: string
  password: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SNMPMapping {
  id: number
  name: string
  snmp_version: 'v1' | 'v2c' | 'v3'
  snmp_community?: string
  snmp_v3_user?: string
  snmp_v3_auth_protocol?: string
  snmp_v3_auth_password?: string
  snmp_v3_priv_protocol?: string
  snmp_v3_priv_password?: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface RegexPatternFormData {
  pattern: string
  description: string
  pattern_type: 'must_match' | 'must_not_match'
}

export interface LoginCredentialFormData {
  name: string
  username: string
  password: string
  description: string
}

export interface SNMPMappingFormData {
  name: string
  snmp_version: 'v1' | 'v2c' | 'v3'
  snmp_community: string
  snmp_v3_user: string
  snmp_v3_auth_protocol: string
  snmp_v3_auth_password: string
  snmp_v3_priv_protocol: string
  snmp_v3_priv_password: string
  description: string
}

export interface ImportResponse {
  imported: number
  skipped?: number
  errors: number
}

export type StatusType = 'idle' | 'loading' | 'success' | 'error'
