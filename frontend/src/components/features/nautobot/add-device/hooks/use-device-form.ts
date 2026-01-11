import { useForm, UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { deviceFormSchema, type DeviceFormValues } from '../validation'
import { DEFAULT_INTERFACE } from '../constants'
import type { NautobotDefaults } from '../types'

interface UseDeviceFormOptions {
  defaults?: NautobotDefaults | null
}

const DEFAULT_OPTIONS: UseDeviceFormOptions = {}

export function useDeviceForm(
  options: UseDeviceFormOptions = DEFAULT_OPTIONS
): UseFormReturn<DeviceFormValues> {
  const { defaults } = options

  const defaultValues: DeviceFormValues = useMemo(
    () => ({
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
          namespace: defaults?.namespace || '',
        },
      ],
    }),
    [defaults]
  )

  const form = useForm<DeviceFormValues>({
    resolver: zodResolver(deviceFormSchema),
    defaultValues,
    mode: 'onChange', // Validate on change
  })

  return form
}
