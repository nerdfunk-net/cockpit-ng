import { useForm, UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { deviceFormSchema, type DeviceFormValues } from '../validation'

// ============================================================================
// Types
// ============================================================================

export interface NautobotDefaults {
  device_role?: string
  device_status?: string
  location?: string
  platform?: string
  interface_status?: string
  namespace?: string
}

interface UseDeviceFormOptions {
  defaults?: NautobotDefaults | null
  initialData?: Partial<DeviceFormValues> // NEW: Pre-populate from inventory/existing device
  mode?: 'create' | 'update' // NEW: Determines validation requirements
}

const DEFAULT_OPTIONS: UseDeviceFormOptions = {
  mode: 'create',
}

const DEFAULT_INTERFACE = {
  name: '',
  type: '',
  status: '',
  ip_address: '',
  namespace: '',
  enabled: true,
  mgmt_only: false,
  is_primary_ipv4: false,
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Enhanced device form hook that supports both create and update modes
 * 
 * @param options.defaults - Nautobot defaults from backend
 * @param options.initialData - Pre-populated form data (for updates/CheckMK sync)
 * @param options.mode - 'create' or 'update' mode
 * 
 * Usage:
 * ```tsx
 * // Create mode (add-device app)
 * const form = useDeviceForm({ defaults: nautobotDefaults })
 * 
 * // Update mode (CheckMK sync)
 * const form = useDeviceForm({
 *   defaults: nautobotDefaults,
 *   initialData: transformedCheckMKData,
 *   mode: 'update'
 * })
 * ```
 */
export function useDeviceForm(
  options: UseDeviceFormOptions = DEFAULT_OPTIONS
): UseFormReturn<DeviceFormValues> {
  const { defaults, initialData } = options

  const defaultValues: DeviceFormValues = useMemo(
    () => {
      // Start with defaults
      const baseValues: DeviceFormValues = {
        deviceName: '',
        serialNumber: '',
        selectedRole: defaults?.device_role || '',
        selectedStatus: defaults?.device_status || '',
        selectedLocation: defaults?.location || '',
        selectedDeviceType: '',
        selectedPlatform: defaults?.platform || '',
        selectedSoftwareVersion: '',
        selectedTags: [],
        customFieldValues: {},
        addPrefix: true,
        defaultPrefixLength: '/24',
        interfaces: [
          {
            id: '1',
            ...DEFAULT_INTERFACE,
            status: defaults?.interface_status || '',
            ip_addresses: [
              {
                id: '1',
                address: '',
                namespace: defaults?.namespace || 'Global',
                ip_role: 'none',
                is_primary: true,
              },
            ],
          },
        ],
      }

      // Merge with initial data if provided (for update/sync mode)
      if (initialData) {
        return {
          ...baseValues,
          ...initialData,
          // Ensure arrays are properly merged
          selectedTags: initialData.selectedTags || baseValues.selectedTags,
          customFieldValues: initialData.customFieldValues || baseValues.customFieldValues,
          interfaces: initialData.interfaces && initialData.interfaces.length > 0 
            ? initialData.interfaces 
            : baseValues.interfaces,
          // Preserve defaults for prefix configuration if not provided
          addPrefix: initialData.addPrefix !== undefined ? initialData.addPrefix : baseValues.addPrefix,
          defaultPrefixLength: initialData.defaultPrefixLength || baseValues.defaultPrefixLength,
        }
      }

      return baseValues
    },
    [defaults, initialData]
  )

  const form = useForm<DeviceFormValues>({
    resolver: zodResolver(deviceFormSchema),
    defaultValues,
    mode: 'onChange', // Validate on change
  })

  return form
}
