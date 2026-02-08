import { useState, useCallback, useMemo, useRef } from 'react'
import type { TemplateVariable } from '../types'
import { getDefaultVariables } from '../utils/category-variables'

interface DeviceData {
  devices: Array<{ id: string; name: string }>
  device_details: Record<string, unknown>
}

interface SnmpMapping {
  id: number
  name: string
  snmp_community: string | null
  snmp_version: string
  snmp_v3_user: string | null
  snmp_v3_auth_protocol: string | null
  snmp_v3_priv_protocol: string | null
  description: string
  is_active: boolean
  created_at: string
  updated_at: string
  snmp_v3_auth_password: string | null
  snmp_v3_priv_password: string | null
}

export function useTemplateVariables(initialCategory: string = '__none__') {
  const [variables, setVariables] = useState<TemplateVariable[]>(() =>
    getDefaultVariables(initialCategory)
  )
  
  // Cache for snmp_mapping value when temporarily removed
  const snmpMappingCacheRef = useRef<string>('')

  const updateForCategory = useCallback((category: string, includeSnmpMapping: boolean = true) => {
    setVariables((prev) => {
      const userVars = prev.filter((v) => !v.isDefault)
      const defaults = getDefaultVariables(category)
      
      // Filter out snmp_mapping if not needed
      const filteredDefaults = includeSnmpMapping 
        ? defaults 
        : defaults.filter(v => v.name !== 'snmp_mapping')
      
      return [...filteredDefaults, ...userVars]
    })
  }, [])

  const updateDeviceData = useCallback((deviceData: DeviceData | null) => {
    setVariables((prev) =>
      prev.map((v) => {
        if (!v.isDefault || !v.isAutoFilled) return v

        if (v.name === 'devices' && deviceData) {
          const newValue = JSON.stringify(deviceData.devices, null, 2)
          return {
            ...v,
            value: newValue,
          }
        }

        if (v.name === 'device_details' && deviceData) {
          const newValue = JSON.stringify(deviceData.device_details, null, 2)
          return {
            ...v,
            value: newValue,
          }
        }

        return v
      })
    )
  }, [])

  const updateSnmpMapping = useCallback((snmpMappings: SnmpMapping[] | null) => {
    const newValue = snmpMappings ? JSON.stringify(snmpMappings, null, 2) : ''
    // Always update cache
    snmpMappingCacheRef.current = newValue
    
    setVariables((prev) =>
      prev.map((v) => {
        if (v.name === 'snmp_mapping' && v.isDefault && v.isAutoFilled) {
          return {
            ...v,
            value: newValue,
          }
        }
        return v
      })
    )
  }, [])

  const toggleSnmpMappingVariable = useCallback((show: boolean) => {
    setVariables((prev) => {
      const existingSnmpVar = prev.find(v => v.name === 'snmp_mapping' && v.isDefault)
      
      if (show && !existingSnmpVar) {
        // Add snmp_mapping variable with cached value
        const snmpVar: TemplateVariable = {
          id: 'default-snmp_mapping',
          name: 'snmp_mapping',
          value: snmpMappingCacheRef.current,
          isDefault: true,
          isAutoFilled: true,
          description: 'SNMP credential mapping (if enabled)',
        }
        // Insert after device_details (index 1) but before path
        const defaultVars = prev.filter(v => v.isDefault)
        const userVars = prev.filter(v => !v.isDefault)
        const insertIndex = defaultVars.findIndex(v => v.name === 'path')
        if (insertIndex > 0) {
          defaultVars.splice(insertIndex, 0, snmpVar)
        } else {
          defaultVars.push(snmpVar)
        }
        return [...defaultVars, ...userVars]
      } else if (!show && existingSnmpVar) {
        // Cache the value before removing
        snmpMappingCacheRef.current = existingSnmpVar.value
        // Remove snmp_mapping variable
        return prev.filter(v => v.name !== 'snmp_mapping' || !v.isDefault)
      }
      
      return prev
    })
  }, [])

  const updatePath = useCallback((path: string) => {
    setVariables((prev) =>
      prev.map((v) => {
        if (v.name === 'path' && v.isDefault && v.isAutoFilled) {
          return {
            ...v,
            value: path,
          }
        }
        return v
      })
    )
  }, [])

  const addVariable = useCallback(() => {
    setVariables((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: '',
        value: '',
        isDefault: false,
        isAutoFilled: false,
      },
    ])
  }, [])

  const removeVariable = useCallback((id: string) => {
    setVariables((prev) => prev.filter((v) => v.id !== id || v.isDefault))
  }, [])

  const updateVariable = useCallback(
    (id: string, field: 'name' | 'value', value: string) => {
      setVariables((prev) =>
        prev.map((v) => (v.id === id ? { ...v, [field]: value } : v))
      )
    },
    []
  )

  return useMemo(
    () => ({
      variables,
      updateForCategory,
      updateDeviceData,
      updateSnmpMapping,
      toggleSnmpMappingVariable,
      updatePath,
      addVariable,
      removeVariable,
      updateVariable,
    }),
    [variables, updateForCategory, updateDeviceData, updateSnmpMapping, toggleSnmpMappingVariable, updatePath, addVariable, removeVariable, updateVariable]
  )
}
