/**
 * Nautobot GraphQL Query Definitions
 *
 * Centralized location for all GraphQL queries used to fetch data from Nautobot.
 * This ensures consistency, reusability, and maintainability across the application.
 */

/**
 * GraphQL query to fetch device types with manufacturer information
 *
 * Returns:
 * - id: Device type ID
 * - model: Device type model name
 * - manufacturer.id: Manufacturer ID
 * - manufacturer.name: Manufacturer name
 */
export const DEVICE_TYPES_WITH_MANUFACTURER = `
  query {
    device_types {
      id
      model
      manufacturer {
        id
        name
      }
    }
  }
`

/**
 * GraphQL query to fetch locations with hierarchy information
 *
 * Returns:
 * - id: Location ID
 * - name: Location name
 * - parent.id: Parent location ID (if exists)
 */
export const LOCATIONS_WITH_HIERARCHY = `
  query {
    locations {
      id
      name
      parent {
        id
      }
    }
  }
`

/**
 * GraphQL query to fetch devices with detailed information
 *
 * Returns comprehensive device data including:
 * - Basic info (id, name, serial)
 * - Location and role
 * - Device type and manufacturer
 * - Platform and status
 * - IP addressing
 * - Tags
 */
export const DEVICES_DETAILED = `
  query {
    devices {
      id
      name
      serial
      status {
        name
      }
      location {
        id
        name
      }
      role {
        id
        name
      }
      device_type {
        id
        model
        manufacturer {
          id
          name
        }
      }
      platform {
        id
        name
      }
      primary_ip4 {
        id
        address
      }
      tags {
        id
        name
      }
    }
  }
`

/**
 * API Options interface matching useApi hook
 */
interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?: unknown
  headers?: Record<string, string>
}

/**
 * Type definitions for GraphQL responses
 */

export interface GraphQLDeviceType {
  id: string
  model: string
  manufacturer: {
    id: string
    name: string
  }
}

export interface GraphQLLocation {
  id: string
  name: string
  parent?: {
    id: string
  }
}

export interface GraphQLDevice {
  id: string
  name: string
  serial?: string
  status?: {
    name: string
  }
  location?: {
    id: string
    name: string
  }
  role?: {
    id: string
    name: string
  }
  device_type?: {
    id: string
    model: string
    manufacturer: {
      id: string
      name: string
    }
  }
  platform?: {
    id: string
    name: string
  }
  primary_ip4?: {
    id: string
    address: string
  }
  tags?: Array<{
    id: string
    name: string
  }>
}

/**
 * Response wrapper type for GraphQL queries
 */
export interface GraphQLResponse<T> {
  data: T
}

/**
 * Execute a GraphQL query against the Nautobot GraphQL endpoint
 *
 * @param apiCall - The API call function from useApi hook
 * @param query - The GraphQL query string to execute
 * @returns Promise resolving to the GraphQL response
 *
 * @example
 * const result = await executeNautobotQuery(
 *   apiCall,
 *   DEVICE_TYPES_WITH_MANUFACTURER
 * )
 * const deviceTypes = result.data.device_types
 */
export async function executeNautobotQuery<T>(
  apiCall: (path: string, options?: ApiOptions) => Promise<GraphQLResponse<T>>,
  query: string
): Promise<GraphQLResponse<T>> {
  return apiCall('nautobot/graphql', {
    method: 'POST',
    body: JSON.stringify({ query })
  })
}

/**
 * Helper function to execute device types query with proper typing
 */
export async function fetchDeviceTypesWithManufacturer(
  apiCall: (path: string, options?: ApiOptions) => Promise<unknown>
): Promise<GraphQLResponse<{ device_types: GraphQLDeviceType[] }>> {
  return executeNautobotQuery(
    apiCall as (path: string, options?: ApiOptions) => Promise<GraphQLResponse<{ device_types: GraphQLDeviceType[] }>>,
    DEVICE_TYPES_WITH_MANUFACTURER
  )
}

/**
 * Helper function to execute locations query with proper typing
 */
export async function fetchLocationsWithHierarchy(
  apiCall: (path: string, options?: ApiOptions) => Promise<unknown>
): Promise<GraphQLResponse<{ locations: GraphQLLocation[] }>> {
  return executeNautobotQuery(
    apiCall as (path: string, options?: ApiOptions) => Promise<GraphQLResponse<{ locations: GraphQLLocation[] }>>,
    LOCATIONS_WITH_HIERARCHY
  )
}

/**
 * Helper function to execute devices query with proper typing
 */
export async function fetchDevicesDetailed(
  apiCall: (path: string, options?: ApiOptions) => Promise<unknown>
): Promise<GraphQLResponse<{ devices: GraphQLDevice[] }>> {
  return executeNautobotQuery(
    apiCall as (path: string, options?: ApiOptions) => Promise<GraphQLResponse<{ devices: GraphQLDevice[] }>>,
    DEVICES_DETAILED
  )
}
