import type {
  RegexPatternFormData,
  LoginCredentialFormData,
  SNMPMappingFormData,
  RegexPattern,
  LoginCredential,
  SNMPMapping,
} from '../types'

// React best practice: Extract default arrays/objects to prevent re-render loops
export const EMPTY_ARRAY: never[] = []
export const EMPTY_REGEX_PATTERNS: RegexPattern[] = []
export const EMPTY_LOGIN_CREDENTIALS: LoginCredential[] = []
export const EMPTY_SNMP_MAPPINGS: SNMPMapping[] = []

export const DEFAULT_REGEX_FORM: RegexPatternFormData = {
  pattern: '',
  description: '',
  pattern_type: 'must_match',
} as const

export const DEFAULT_LOGIN_FORM: LoginCredentialFormData = {
  name: '',
  username: '',
  password: '',
  description: '',
} as const

export const DEFAULT_SNMP_FORM: SNMPMappingFormData = {
  name: '',
  snmp_version: 'v2c',
  snmp_community: '',
  snmp_v3_user: '',
  snmp_v3_auth_protocol: 'SHA',
  snmp_v3_auth_password: '',
  snmp_v3_priv_protocol: 'AES',
  snmp_v3_priv_password: '',
  description: '',
} as const

export const CACHE_TIME = {
  REGEX_PATTERNS: 2 * 60 * 1000, // 2 minutes
  LOGIN_CREDENTIALS: 2 * 60 * 1000, // 2 minutes
  SNMP_MAPPINGS: 2 * 60 * 1000, // 2 minutes
} as const
