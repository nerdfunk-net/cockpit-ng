import { useState, useCallback, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import type { OnboardFormData, StatusMessage, IPValidation, OnboardResponse } from '../types'
import { validateIPAddress } from '../utils/helpers'

export function useOnboardingForm() {
  const { apiCall } = useApi()

  const [formData, setFormData] = useState<OnboardFormData>({
    ip_address: '',
    location_id: '',
    namespace_id: '',
    role_id: '',
    status_id: '',
    platform_id: 'detect',
    secret_groups_id: '',
    interface_status_id: '',
    ip_address_status_id: '',
    prefix_status_id: '',
    port: 22,
    timeout: 30,
    sync_options: ['cables', 'software', 'vlans', 'vrfs']
  })

  const [ipValidation, setIpValidation] = useState<IPValidation>({
    isValid: false,
    message: ''
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isValidatingIP, setIsValidatingIP] = useState(false)
  const [isSearchingDevice, setIsSearchingDevice] = useState(false)

  const updateFormData = useCallback((updates: Partial<OnboardFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }))
  }, [])

  const handleIPChange = useCallback((value: string) => {
    setFormData(prev => ({ ...prev, ip_address: value }))

    const isValid = validateIPAddress(value)
    const ipCount = value.split(',').map(ip => ip.trim()).filter(ip => ip.length > 0).length
    
    setIpValidation({
      isValid,
      message: isValid 
        ? ipCount > 1 
          ? `✓ ${ipCount} valid IP addresses` 
          : 'Valid IP address'
        : 'Please enter valid IP address(es) separated by commas'
    })
  }, [])

  const checkIPInNautobot = useCallback(
    async (ipAddress: string): Promise<StatusMessage> => {
      if (!ipValidation.isValid) {
        return { type: 'error', message: 'Please enter valid IP address(es) first.' }
      }

      const ipAddresses = ipAddress.split(',').map(ip => ip.trim()).filter(ip => ip.length > 0)
      const firstIP = ipAddresses[0]

      setIsValidatingIP(true)
      try {
        const data = await apiCall<{
          exists: boolean
          is_assigned_to_device?: boolean
          assigned_devices?: Array<{ name: string }>
        }>('nautobot/check-ip', {
          method: 'POST',
          body: { ip_address: firstIP }
        })

        let message = ''
        if (ipAddresses.length > 1) {
          message += `Note: Checking only first IP (${firstIP}) of ${ipAddresses.length} addresses. `
        }

        if (data.exists) {
          if (data.is_assigned_to_device && data.assigned_devices?.length) {
            const deviceNames = data.assigned_devices.map(device => device.name).join(', ')
            return {
              type: 'error',
              message: `❌ ${message}IP address '${firstIP}' found in Nautobot and assigned to device(s): ${deviceNames}`
            }
          } else {
            return {
              type: 'warning',
              message: `⚠️ ${message}IP address '${firstIP}' found in Nautobot but not assigned to any device.`
            }
          }
        } else {
          return {
            type: 'success',
            message: `✅ ${message}IP address '${firstIP}' not found in Nautobot. Ready for onboarding.`
          }
        }
      } catch (error) {
        console.error('Error checking IP:', error)
        return {
          type: 'error',
          message: `❌ Error checking IP address: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      } finally {
        setIsValidatingIP(false)
      }
    },
    [apiCall, ipValidation.isValid]
  )

  const searchDevice = useCallback(
    async (deviceName: string): Promise<StatusMessage> => {
      if (!deviceName.trim()) {
        return { type: 'error', message: 'Please enter a device name to search.' }
      }

      setIsSearchingDevice(true)
      try {
        const data = await apiCall<{
          devices: Array<{
            name: string
            location?: { name: string }
            role?: { name: string }
            primary_ip4?: { address: string }
            status?: { name: string }
          }>
        }>(`nautobot/devices?filter_type=name&filter_value=${encodeURIComponent(deviceName)}&limit=10`)

        if (data.devices?.length > 0) {
          if (data.devices.length === 1 && data.devices[0]) {
            const device = data.devices[0]
            const location = device.location ? ` (${device.location.name})` : ''
            const role = device.role ? ` [${device.role.name}]` : ''
            const ip = device.primary_ip4 ? ` - ${device.primary_ip4.address}` : ''
            const status = device.status ? ` (${device.status.name})` : ''

            return {
              type: 'success',
              message: `✅ Device found in Nautobot: ${device.name}${role}${location}${ip}${status}`
            }
          } else {
            const deviceList = data.devices
              .map(device => {
                const location = device.location ? ` (${device.location.name})` : ''
                const role = device.role ? ` [${device.role.name}]` : ''
                const ip = device.primary_ip4 ? ` - ${device.primary_ip4.address}` : ''
                const status = device.status ? ` (${device.status.name})` : ''
                return `${device.name}${role}${location}${ip}${status}`
              })
              .join(', ')

            return {
              type: 'success',
              message: `✅ Found ${data.devices.length} device(s) matching "${deviceName}": ${deviceList}`
            }
          }
        } else {
          return {
            type: 'info',
            message: `ℹ️ No devices found in Nautobot with name containing "${deviceName}". This name is available for onboarding.`
          }
        }
      } catch (error) {
        console.error('Error searching device:', error)
        return {
          type: 'error',
          message: `❌ Error searching for device: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      } finally {
        setIsSearchingDevice(false)
      }
    },
    [apiCall]
  )

  const validateForm = useCallback((): { isValid: boolean; message?: string } => {
    if (!ipValidation.isValid) {
      return { isValid: false, message: 'Please enter valid IP address(es).' }
    }

    const requiredFields = [
      { field: 'location_id', name: 'Location' },
      { field: 'namespace_id', name: 'Namespace' },
      { field: 'role_id', name: 'Device Role' },
      { field: 'status_id', name: 'Device Status' },
      { field: 'secret_groups_id', name: 'Secret Group' },
      { field: 'interface_status_id', name: 'Interface Status' },
      { field: 'ip_address_status_id', name: 'IP Address Status' },
      { field: 'prefix_status_id', name: 'Prefix Status' }
    ]

    const missingFields = requiredFields.filter(
      ({ field }) => !formData[field as keyof OnboardFormData]
    )

    if (missingFields.length > 0) {
      const fieldNames = missingFields.map(f => f.name).join(', ')
      return { isValid: false, message: `Please fill in all required fields: ${fieldNames}` }
    }

    return { isValid: true }
  }, [formData, ipValidation.isValid])

  const submitOnboarding = useCallback(async (): Promise<OnboardResponse> => {
    setIsSubmitting(true)
    try {
      const response = await apiCall<OnboardResponse>('nautobot/devices/onboard', {
        method: 'POST',
        body: formData
      })
      return response
    } finally {
      setIsSubmitting(false)
    }
  }, [apiCall, formData])

  return useMemo(
    () => ({
      // Data
      formData,
      ipValidation,
      // State
      isSubmitting,
      isValidatingIP,
      isSearchingDevice,
      // Actions
      updateFormData,
      handleIPChange,
      checkIPInNautobot,
      searchDevice,
      validateForm,
      submitOnboarding
    }),
    [
      formData,
      ipValidation,
      isSubmitting,
      isValidatingIP,
      isSearchingDevice,
      updateFormData,
      handleIPChange,
      checkIPInNautobot,
      searchDevice,
      validateForm,
      submitOnboarding
    ]
  )
}
