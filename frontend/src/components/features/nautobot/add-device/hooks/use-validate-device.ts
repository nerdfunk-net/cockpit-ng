'use client'

import { useState, useCallback, useMemo } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import type { ValidationResults } from '../dialogs'
import type { DeviceFormValues } from '../utils/validation'

const DEFAULT_VALIDATION_RESULTS: ValidationResults = {
  isValid: true,
  deviceName: true,
  deviceRole: true,
  deviceStatus: true,
  deviceType: true,
  location: true,
  interfaceStatus: true,
  interfaceIssues: 0,
  ipAddresses: true,
  ipAddressIssues: 0,
}

const IPV4_CIDR_REGEX = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/
const IPV6_CIDR_REGEX = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}\/\d{1,3}$/

export function useValidateDevice(form: UseFormReturn<DeviceFormValues>) {
  const [showValidationSummary, setShowValidationSummary] = useState(false)
  const [validationResults, setValidationResults] = useState<ValidationResults>(
    DEFAULT_VALIDATION_RESULTS
  )

  const handleValidate = useCallback(() => {
    const values = form.getValues()

    const deviceName = !!values.deviceName?.trim()
    const deviceRole = !!values.selectedRole
    const deviceStatus = !!values.selectedStatus
    const deviceType = !!values.selectedDeviceType
    const location = !!values.selectedLocation

    const interfaces = values.interfaces || []
    let interfaceIssues = 0
    let allInterfacesValid = true
    let ipAddressIssues = 0
    let allIpAddressesValid = true

    interfaces.forEach(iface => {
      if (!iface.name || !iface.name.trim()) {
        allInterfacesValid = false
        interfaceIssues++
      }
      if (!iface.type) {
        allInterfacesValid = false
        interfaceIssues++
      }
      if (!iface.status) {
        allInterfacesValid = false
        interfaceIssues++
      }

      const ipAddresses = iface.ip_addresses || []
      ipAddresses.forEach(ip => {
        if (!ip.address || !ip.address.trim()) {
          allIpAddressesValid = false
          ipAddressIssues++
          return
        }

        const isValidCidr =
          IPV4_CIDR_REGEX.test(ip.address) || IPV6_CIDR_REGEX.test(ip.address)
        if (!isValidCidr) {
          allIpAddressesValid = false
          ipAddressIssues++
        }

        if (!ip.namespace || !ip.namespace.trim()) {
          allIpAddressesValid = false
          ipAddressIssues++
        }
      })
    })

    const isValid =
      deviceName &&
      deviceRole &&
      deviceStatus &&
      deviceType &&
      location &&
      allInterfacesValid &&
      allIpAddressesValid

    setValidationResults({
      isValid,
      deviceName,
      deviceRole,
      deviceStatus,
      deviceType,
      location,
      interfaceStatus: allInterfacesValid,
      interfaceIssues,
      ipAddresses: allIpAddressesValid,
      ipAddressIssues,
    })

    setShowValidationSummary(true)
  }, [form])

  return useMemo(
    () => ({ showValidationSummary, setShowValidationSummary, validationResults, handleValidate }),
    [showValidationSummary, validationResults, handleValidate]
  )
}
