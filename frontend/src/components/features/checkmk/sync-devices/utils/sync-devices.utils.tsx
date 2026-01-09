import { Badge } from '@/components/ui/badge'
import type { Device, AttributeConfig, ConfigComparison, DeviceResult } from '../types/sync-devices.types'

export const EMPTY_IGNORED_ATTRIBUTES: string[] = []

/**
 * Extract site value from device configuration
 */
export const getSiteFromDevice = (device: Device, defaultSite: string = 'cmk'): string => {
  // First try to get site from normalized_config.attributes.site
  const normalizedSite = (device.normalized_config?.attributes as AttributeConfig)?.site
  if (normalizedSite) {
    return normalizedSite
  }
  
  // Then try checkmk_config.attributes.site
  const checkmkSite = (device.checkmk_config?.attributes as AttributeConfig)?.site
  if (checkmkSite) {
    return checkmkSite
  }
  
  // If no site found, return the default site
  return defaultSite
}

/**
 * Render config comparison between Nautobot and CheckMK configurations
 */
export const renderConfigComparison = (
  nautobot: { attributes?: Record<string, unknown> }, 
  checkmk: { attributes?: Record<string, unknown> }, 
  ignoredAttributes: string[] = EMPTY_IGNORED_ATTRIBUTES
): ConfigComparison[] => {
  const allKeys = new Set([
    ...Object.keys(nautobot?.attributes || {}),
    ...Object.keys(checkmk?.attributes || {})
  ])

  return Array.from(allKeys).map(key => {
    const nautobotValue = nautobot?.attributes?.[key]
    const checkmkValue = checkmk?.attributes?.[key]
    const isDifferent = JSON.stringify(nautobotValue) !== JSON.stringify(checkmkValue)
    const nautobotMissing = nautobotValue === undefined
    const checkmkMissing = checkmkValue === undefined
    const isIgnored = ignoredAttributes.includes(key)

    return {
      key,
      nautobotValue,
      checkmkValue,
      isDifferent,
      nautobotMissing,
      checkmkMissing,
      isIgnored
    }
  })
}

/**
 * Format value for display
 */
export const formatValue = (value: unknown): string => {
  if (value === undefined) return '(missing)'
  if (value === null) return '(null)'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

/**
 * Get badge component for device status
 */
export const getStatusBadge = (status: string) => {
  switch (status.toLowerCase()) {
    case 'active':
      return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>
    case 'inactive':
      return <Badge variant="secondary">Inactive</Badge>
    case 'staged':
      return <Badge variant="outline">Staged</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

/**
 * Get badge component for CheckMK status
 */
export const getCheckMKStatusBadge = (checkmkStatus: string | undefined) => {
  if (!checkmkStatus) {
    return <Badge variant="outline" className="bg-gray-100 text-gray-800">Unknown</Badge>
  }
  switch (checkmkStatus.toLowerCase()) {
    case 'equal':
      return <Badge variant="default" className="bg-green-100 text-green-800">Synced</Badge>
    case 'diff':
      return <Badge variant="default" className="bg-yellow-100 text-yellow-800">Different</Badge>
    case 'host_not_found':
    case 'missing':
      return <Badge variant="destructive">Missing</Badge>
    case 'error':
      return <Badge variant="destructive" className="bg-red-100 text-red-800">Error</Badge>
    case 'unknown':
      return <Badge variant="outline">Unknown</Badge>
    default:
      return <Badge variant="outline">{checkmkStatus}</Badge>
  }
}

/**
 * Transform DeviceResult from API to Device format
 */
export const transformDeviceResult = (result: DeviceResult, index: number): Device => {
  // Get internal data from normalized_config for device metadata
  const internalData = result.normalized_config?.internal || {}

  // Helper to extract name from object or return string
  const extractName = (value: unknown): string => {
    if (typeof value === 'string') return value
    if (value && typeof value === 'object' && 'name' in value) {
      return (value as { name: string }).name
    }
    return 'Unknown'
  }

  // Helper to safely extract string from result_data paths
  const getResultDataString = (...paths: unknown[]): string => {
    for (const path of paths) {
      if (typeof path === 'string' && path) return path
    }
    return 'unknown'
  }

  return {
    id: result.device_id || result.device_name || `device_${index}`,
    name: internalData.hostname || result.device_name || result.device || `device_${index}`,
    role: internalData.role || extractName(result.role),
    status: internalData.status || result.device_status?.name || result.status || 'Unknown',
    location: internalData.location || extractName(result.location),
    result_data: result.result_data,
    error_message: result.error_message,
    processed_at: result.processed_at,
    checkmk_status: getResultDataString(
      result.checkmk_status,
      result.result_data?.data?.result,
      result.result_data?.comparison_result,
      result.result_data?.status
    ),
    normalized_config: result.normalized_config || result.result_data?.data?.normalized_config || result.result_data?.normalized_config,
    checkmk_config: result.checkmk_config || result.result_data?.data?.checkmk_config || result.result_data?.checkmk_config,
    diff: result.diff || result.result_data?.data?.diff || result.result_data?.diff,
    ignored_attributes: result.ignored_attributes || result.result_data?.data?.ignored_attributes || result.result_data?.ignored_attributes || []
  }
}
