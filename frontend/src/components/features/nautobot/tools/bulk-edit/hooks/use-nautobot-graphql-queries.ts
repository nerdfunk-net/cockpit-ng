import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import {
  fetchDeviceTypesWithManufacturer,
  fetchLocationsWithHierarchy,
  fetchDevicesDetailed,
  type GraphQLDeviceType,
  type GraphQLLocation,
  type GraphQLDevice,
  type GraphQLResponse
} from '@/services/nautobot-graphql'

interface UseNautobotGraphQLQueryOptions {
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseNautobotGraphQLQueryOptions = {}

/**
 * Hook for fetching Nautobot device types with manufacturers using GraphQL
 *
 * Provides automatic caching and refetching for device types.
 * Device types include model name and manufacturer information.
 *
 * @param options.enabled - Whether to enable the query (default: true)
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useNautobotDeviceTypesQuery()
 *
 * const deviceTypes = data?.data?.device_types || []
 * ```
 */
export function useNautobotDeviceTypesQuery(options: UseNautobotGraphQLQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.nautobot.deviceTypes(),

    queryFn: async () => {
      return fetchDeviceTypesWithManufacturer(apiCall)
    },

    // Only run if enabled
    enabled,

    // Device types don't change frequently, cache for 5 minutes
    staleTime: 5 * 60 * 1000,

    // Keep in cache for 30 minutes
    gcTime: 30 * 60 * 1000,
  })
}

/**
 * Hook for fetching Nautobot locations with hierarchy using GraphQL
 *
 * Provides automatic caching and refetching for locations.
 * Locations include parent hierarchy information.
 *
 * @param options.enabled - Whether to enable the query (default: true)
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useNautobotLocationsQuery()
 *
 * const locations = data?.data?.locations || []
 * ```
 */
export function useNautobotLocationsQuery(options: UseNautobotGraphQLQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.nautobot.locations(),

    queryFn: async () => {
      return fetchLocationsWithHierarchy(apiCall)
    },

    // Only run if enabled
    enabled,

    // Locations don't change frequently, cache for 5 minutes
    staleTime: 5 * 60 * 1000,

    // Keep in cache for 30 minutes
    gcTime: 30 * 60 * 1000,
  })
}

/**
 * Hook for fetching Nautobot devices with detailed information using GraphQL
 *
 * Provides automatic caching and refetching for devices.
 * Includes comprehensive device data: location, role, type, platform, IPs, tags.
 *
 * @param options.enabled - Whether to enable the query (default: true)
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useNautobotDevicesQuery()
 *
 * const devices = data?.data?.devices || []
 * ```
 */
export function useNautobotDevicesQuery(options: UseNautobotGraphQLQueryOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.nautobot.devices(),

    queryFn: async () => {
      return fetchDevicesDetailed(apiCall)
    },

    // Only run if enabled
    enabled,

    // Devices can change more frequently, cache for 1 minute
    staleTime: 60 * 1000,

    // Keep in cache for 10 minutes
    gcTime: 10 * 60 * 1000,
  })
}

// Export types
export type {
  GraphQLDeviceType,
  GraphQLLocation,
  GraphQLDevice,
  GraphQLResponse
}
