import { useState, useCallback, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'

const EMPTY_ARRAY: never[] = []

interface RegexPattern {
  id: number
  pattern: string
  description?: string
  pattern_type: 'must_match' | 'must_not_match'
  is_active: boolean
}

interface LoginCredential {
  id: number
  username: string
  description?: string
  is_active: boolean
}

interface SNMPMapping {
  id: number
  device_type: string
  snmp_version: 'v1' | 'v2c' | 'v3'
  snmp_community?: string
  snmp_v3_user?: string
  description?: string
  is_active: boolean
}

interface ApiResponse<T> {
  success: boolean
  data?: T
}

export function useComplianceSettings() {
  const { apiCall } = useApi()

  // Check type toggles
  const [checkSshLogins, setCheckSshLogins] = useState(false)
  const [checkSnmpCredentials, setCheckSnmpCredentials] = useState(false)
  const [checkConfiguration, setCheckConfiguration] = useState(false)

  // Selected credential IDs
  const [selectedLoginIds, setSelectedLoginIds] = useState<number[]>([])
  const [selectedSnmpIds, setSelectedSnmpIds] = useState<number[]>([])
  const [selectedRegexIds, setSelectedRegexIds] = useState<number[]>([])

  // Loaded data
  const [loginCredentials, setLoginCredentials] = useState<LoginCredential[]>(EMPTY_ARRAY)
  const [snmpMappings, setSnmpMappings] = useState<SNMPMapping[]>(EMPTY_ARRAY)
  const [regexPatterns, setRegexPatterns] = useState<RegexPattern[]>(EMPTY_ARRAY)

  // Loading state
  const [isLoading, setIsLoading] = useState(false)

  const loadSettings = useCallback(async () => {
    setIsLoading(true)
    try {
      // Load all settings in parallel
      const [loginResponse, snmpResponse, regexResponse] = await Promise.all([
        apiCall('settings/compliance/login-credentials') as Promise<ApiResponse<LoginCredential[]>>,
        apiCall('settings/compliance/snmp-mappings') as Promise<ApiResponse<SNMPMapping[]>>,
        apiCall('settings/compliance/regex-patterns') as Promise<ApiResponse<RegexPattern[]>>,
      ])

      if (loginResponse?.success && loginResponse?.data) {
        setLoginCredentials(loginResponse.data)
      }

      if (snmpResponse?.success && snmpResponse?.data) {
        setSnmpMappings(snmpResponse.data)
      }

      if (regexResponse?.success && regexResponse?.data) {
        setRegexPatterns(regexResponse.data)
      }
    } catch (error) {
      console.error('Error loading compliance settings:', error)
    } finally {
      setIsLoading(false)
    }
  }, [apiCall])

  return useMemo(
    () => ({
      // Check type toggles
      checkSshLogins,
      setCheckSshLogins,
      checkSnmpCredentials,
      setCheckSnmpCredentials,
      checkConfiguration,
      setCheckConfiguration,

      // Selected credential IDs
      selectedLoginIds,
      setSelectedLoginIds,
      selectedSnmpIds,
      setSelectedSnmpIds,
      selectedRegexIds,
      setSelectedRegexIds,

      // Loaded data
      loginCredentials,
      snmpMappings,
      regexPatterns,

      // Loading state
      isLoading,

      // Load function
      loadSettings,
    }),
    [
      checkSshLogins,
      checkSnmpCredentials,
      checkConfiguration,
      selectedLoginIds,
      selectedSnmpIds,
      selectedRegexIds,
      loginCredentials,
      snmpMappings,
      regexPatterns,
      isLoading,
      loadSettings,
    ]
  )
}
