import { useState, useCallback, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import type {
  DropdownOption,
  LocationItem,
  NautobotDefaults,
  OnboardFormData
} from '../types'
import { buildLocationHierarchy, findDefaultOption } from '../utils/helpers'
import { EMPTY_LOCATIONS, EMPTY_DROPDOWN_OPTIONS } from '../constants'

export function useOnboardingData() {
  const { apiCall } = useApi()

  // Dropdown data
  const [locations, setLocations] = useState<LocationItem[]>(EMPTY_LOCATIONS)
  const [namespaces, setNamespaces] = useState<DropdownOption[]>(EMPTY_DROPDOWN_OPTIONS)
  const [deviceRoles, setDeviceRoles] = useState<DropdownOption[]>(EMPTY_DROPDOWN_OPTIONS)
  const [platforms, setPlatforms] = useState<DropdownOption[]>(EMPTY_DROPDOWN_OPTIONS)
  const [deviceStatuses, setDeviceStatuses] = useState<DropdownOption[]>(EMPTY_DROPDOWN_OPTIONS)
  const [interfaceStatuses, setInterfaceStatuses] = useState<DropdownOption[]>(EMPTY_DROPDOWN_OPTIONS)
  const [ipAddressStatuses, setIpAddressStatuses] = useState<DropdownOption[]>(EMPTY_DROPDOWN_OPTIONS)
  const [prefixStatuses, setPrefixStatuses] = useState<DropdownOption[]>(EMPTY_DROPDOWN_OPTIONS)
  const [secretGroups, setSecretGroups] = useState<DropdownOption[]>(EMPTY_DROPDOWN_OPTIONS)

  // Default values from settings
  const [nautobotDefaults, setNautobotDefaults] = useState<NautobotDefaults | null>(null)

  // UI state
  const [isLoading, setIsLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)

      // Load all dropdown data and defaults in parallel
      const [
        locationsData,
        namespacesData,
        rolesData,
        platformsData,
        deviceStatusesData,
        interfaceStatusesData,
        ipAddressStatusesData,
        prefixStatusesData,
        secretGroupsData,
        defaultsResponse
      ] = await Promise.all([
        apiCall<LocationItem[]>('nautobot/locations'),
        apiCall<DropdownOption[]>('nautobot/namespaces'),
        apiCall<DropdownOption[]>('nautobot/roles/devices'),
        apiCall<DropdownOption[]>('nautobot/platforms'),
        apiCall<DropdownOption[]>('nautobot/statuses/device'),
        apiCall<DropdownOption[]>('nautobot/statuses/interface'),
        apiCall<DropdownOption[]>('nautobot/statuses/ipaddress'),
        apiCall<DropdownOption[]>('nautobot/statuses/prefix'),
        apiCall<DropdownOption[]>('nautobot/secret-groups'),
        apiCall<{ success: boolean; data: NautobotDefaults }>('settings/nautobot/defaults')
      ])

      // Build location hierarchy
      const processedLocations = buildLocationHierarchy(locationsData)
      setLocations(processedLocations)

      setNamespaces(namespacesData)
      setDeviceRoles(rolesData)
      setPlatforms(platformsData)
      setDeviceStatuses(deviceStatusesData)
      setInterfaceStatuses(interfaceStatusesData)
      setIpAddressStatuses(ipAddressStatusesData)
      setPrefixStatuses(prefixStatusesData)
      setSecretGroups(secretGroupsData)

      // Store defaults for future use
      const defaults = defaultsResponse?.success ? defaultsResponse.data : null
      setNautobotDefaults(defaults)

      return { processedLocations, defaults }
    } catch (error) {
      console.error('Error loading dropdown data:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [apiCall])

  const getDefaultFormValues = useCallback(
    (defaults: NautobotDefaults | null): Partial<OnboardFormData> => {
      if (!defaults) {
        // Fallback to hardcoded defaults if no settings defaults available
        return {
          namespace_id: findDefaultOption(namespaces, 'Global')?.id || '',
          role_id: findDefaultOption(deviceRoles, 'network')?.id || '',
          status_id: findDefaultOption(deviceStatuses, 'Active')?.id || '',
          interface_status_id: findDefaultOption(interfaceStatuses, 'Active')?.id || '',
          ip_address_status_id: findDefaultOption(ipAddressStatuses, 'Active')?.id || '',
          prefix_status_id: findDefaultOption(prefixStatuses, 'Active')?.id || ''
        }
      }

      // Apply defaults from settings
      return {
        location_id: defaults.location || '',
        platform_id: defaults.platform || 'detect',
        namespace_id: defaults.namespace || '',
        role_id: defaults.device_role || '',
        status_id: defaults.device_status || '',
        interface_status_id: defaults.interface_status || '',
        ip_address_status_id: defaults.ip_address_status || '',
        prefix_status_id: defaults.ip_prefix_status || '',
        secret_groups_id: defaults.secret_group || ''
      }
    },
    [namespaces, deviceRoles, deviceStatuses, interfaceStatuses, ipAddressStatuses, prefixStatuses]
  )

  const getDefaultLocationDisplay = useCallback(
    (defaults: NautobotDefaults | null): string => {
      if (!defaults) return ''
      const defaultLocation = locations.find(loc => loc.id === defaults.location)
      return defaultLocation?.hierarchicalPath || defaultLocation?.name || ''
    },
    [locations]
  )

  return useMemo(
    () => ({
      // Data
      locations,
      namespaces,
      deviceRoles,
      platforms,
      deviceStatuses,
      interfaceStatuses,
      ipAddressStatuses,
      prefixStatuses,
      secretGroups,
      nautobotDefaults,
      // State
      isLoading,
      // Actions
      loadData,
      getDefaultFormValues,
      getDefaultLocationDisplay
    }),
    [
      locations,
      namespaces,
      deviceRoles,
      platforms,
      deviceStatuses,
      interfaceStatuses,
      ipAddressStatuses,
      prefixStatuses,
      secretGroups,
      nautobotDefaults,
      isLoading,
      loadData,
      getDefaultFormValues,
      getDefaultLocationDisplay
    ]
  )
}
