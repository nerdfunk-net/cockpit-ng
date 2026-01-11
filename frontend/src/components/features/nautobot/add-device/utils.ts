import type { LocationItem, DeviceSubmissionData } from './types'
import type { DeviceFormValues } from './validation'

/**
 * Builds hierarchical path for a location
 */
export function buildLocationPath(location: LocationItem, allLocations: LocationItem[]): string {
  const path: string[] = [location.name]
  let current = location

  while (current.parent) {
    const parent = allLocations.find((loc) => loc.id === current.parent?.id)
    if (!parent) break
    path.unshift(parent.name)
    current = parent
  }

  return path.join(' > ')
}

/**
 * Adds hierarchicalPath to all locations
 */
export function buildLocationHierarchy(locations: LocationItem[]): LocationItem[] {
  return locations.map((loc) => ({
    ...loc,
    hierarchicalPath: buildLocationPath(loc, locations),
  }))
}

/**
 * Converts DeviceFormValues to DeviceSubmissionData
 */
export function formatDeviceSubmissionData(formData: DeviceFormValues): DeviceSubmissionData {
  return {
    name: formData.deviceName,
    serial: formData.serialNumber || undefined,
    role: formData.selectedRole,
    status: formData.selectedStatus,
    location: formData.selectedLocation,
    device_type: formData.selectedDeviceType,
    platform: formData.selectedPlatform || undefined,
    software_version: formData.selectedSoftwareVersion || undefined,
    tags: formData.selectedTags.length > 0 ? formData.selectedTags : undefined,
    custom_fields:
      Object.keys(formData.customFieldValues).length > 0
        ? formData.customFieldValues
        : undefined,
    interfaces: formData.interfaces,
    add_prefix: formData.addPrefix,
    default_prefix_length: formData.defaultPrefixLength,
  }
}
