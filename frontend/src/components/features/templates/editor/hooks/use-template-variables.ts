import { useState, useCallback, useMemo, useRef } from 'react'
import type { TemplateVariable, NautobotDeviceDetails, VariableMetadata } from '../types'
import { getDefaultVariables } from '../utils/category-variables'

interface DeviceData {
  devices: Array<{ id: string; name: string }>
  device_details: NautobotDeviceDetails | Record<string, unknown>
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
  // Cache for device_details value when temporarily removed
  const deviceDetailsCacheRef = useRef<string>('')

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
    // Always update cache when we have new device data
    if (deviceData?.device_details) {
      deviceDetailsCacheRef.current = JSON.stringify(deviceData.device_details, null, 2)
    }

    setVariables((prev) => {
      let hasChanges = false
      const updated = prev.map((v) => {
        if (!v.isDefault || !v.isAutoFilled) return v

        if (v.name === 'devices' && deviceData) {
          const newValue = JSON.stringify(deviceData.devices, null, 2)
          if (v.value === newValue) return v
          hasChanges = true
          return { ...v, value: newValue }
        }

        if (v.name === 'device_details' && deviceData) {
          const newValue = JSON.stringify(deviceData.device_details, null, 2)
          if (v.value === newValue) return v
          hasChanges = true
          return { ...v, value: newValue }
        }

        return v
      })
      return hasChanges ? updated : prev
    })
  }, [])

  const updateSnmpMapping = useCallback((snmpMappings: SnmpMapping[] | null) => {
    const newValue = snmpMappings ? JSON.stringify(snmpMappings, null, 2) : ''
    // Always update cache
    snmpMappingCacheRef.current = newValue

    setVariables((prev) => {
      let hasChanges = false
      const updated = prev.map((v) => {
        if (v.name === 'snmp_mapping' && v.isDefault && v.isAutoFilled) {
          if (v.value === newValue) return v
          hasChanges = true
          return { ...v, value: newValue }
        }
        return v
      })
      return hasChanges ? updated : prev
    })
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
          type: 'auto-filled',
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

  const toggleDeviceDetailsVariable = useCallback((show: boolean) => {
    setVariables((prev) => {
      const existingDeviceDetailsVar = prev.find(v => v.name === 'device_details' && v.isDefault)
      
      if (show && !existingDeviceDetailsVar) {
        // Add device_details variable with cached value
        const deviceDetailsVar: TemplateVariable = {
          id: 'default-device_details',
          name: 'device_details',
          value: deviceDetailsCacheRef.current,
          type: 'auto-filled',
          isDefault: true,
          isAutoFilled: true,
          description: 'Detailed device data from Nautobot (per device)',
        }
        // Insert after devices (index 0)
        const defaultVars = prev.filter(v => v.isDefault)
        const userVars = prev.filter(v => !v.isDefault)
        const insertIndex = defaultVars.findIndex(v => v.name === 'devices')
        if (insertIndex >= 0) {
          defaultVars.splice(insertIndex + 1, 0, deviceDetailsVar)
        } else {
          defaultVars.unshift(deviceDetailsVar)
        }
        return [...defaultVars, ...userVars]
      } else if (!show && existingDeviceDetailsVar) {
        // Cache the value before removing
        deviceDetailsCacheRef.current = existingDeviceDetailsVar.value
        // Remove device_details variable
        return prev.filter(v => v.name !== 'device_details' || !v.isDefault)
      }
      
      return prev
    })
  }, [])

  const updatePath = useCallback((path: string) => {
    setVariables((prev) => {
      let hasChanges = false
      const updated = prev.map((v) => {
        if (v.name === 'path' && v.isDefault && v.isAutoFilled) {
          if (v.value === path) return v
          hasChanges = true
          return { ...v, value: path }
        }
        return v
      })
      return hasChanges ? updated : prev
    })
  }, [])

  const addVariable = useCallback(() => {
    setVariables((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: '',
        value: '',
        type: 'custom',
        isDefault: false,
        isAutoFilled: false,
      },
    ])
  }, [])

  const addVariableWithData = useCallback((name: string, value: string) => {
    const newId = crypto.randomUUID()
    setVariables((prev) => [
      ...prev,
      { id: newId, name, value, type: 'custom', isDefault: false, isAutoFilled: false },
    ])
    return newId
  }, [])

  const addVariableWithMetadata = useCallback(
    (
      name: string,
      value: string,
      type: 'custom' | 'nautobot' | 'yaml' | 'inventory',
      metadata?: VariableMetadata
    ) => {
      const newId = crypto.randomUUID()
      setVariables((prev) => [
        ...prev,
        { id: newId, name, value, type, metadata, isDefault: false, isAutoFilled: false },
      ])
      return newId
    },
    []
  )

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

  const setCustomVariables = useCallback((savedVars: Record<string, string | { value: string; type?: string; metadata?: unknown }>) => {
    setVariables((prev) => {
      // Keep only default variables, replace all custom ones with saved data
      const defaults = prev.filter((v) => v.isDefault)
      const custom: TemplateVariable[] = Object.entries(savedVars).map(([name, varData]) => {
        // Handle both old format (string) and new format (object)
        if (typeof varData === 'string') {
          // Old format: just a string value
          return {
            id: crypto.randomUUID(),
            name,
            value: varData,
            type: 'custom' as const,
            isDefault: false,
            isAutoFilled: false,
          }
        } else {
          // New format: object with value, type, metadata
          return {
            id: crypto.randomUUID(),
            name,
            value: varData.value,
            type: (varData.type as 'custom' | 'nautobot' | 'yaml' | 'inventory') || 'custom',
            metadata: varData.metadata as VariableMetadata | undefined,
            isDefault: false,
            isAutoFilled: false,
          }
        }
      })
      return [...defaults, ...custom]
    })
  }, [])

  const updatePreRunVariable = useCallback((variableName: 'pre_run.raw' | 'pre_run.parsed', value: string) => {
    setVariables((prev) =>
      prev.map((v) => {
        if (v.name === variableName && v.isDefault && v.requiresExecution) {
          return {
            ...v,
            value,
            isExecuting: false,
          }
        }
        return v
      })
    )
  }, [])

  const setPreRunExecuting = useCallback((variableName: 'pre_run.raw' | 'pre_run.parsed', isExecuting: boolean) => {
    setVariables((prev) =>
      prev.map((v) => {
        if (v.name === variableName && v.isDefault && v.requiresExecution) {
          return {
            ...v,
            isExecuting,
          }
        }
        return v
      })
    )
  }, [])

  const updateInventoryIdForInventoryVariables = useCallback((newInventoryId: number) => {
    setVariables((prev) => {
      let hasChanges = false
      const updated = prev.map((v) => {
        // Only update inventory-type variables
        if (v.type === 'inventory' && v.metadata?.inventory_id && v.metadata.inventory_id !== newInventoryId) {
          hasChanges = true
          return {
            ...v,
            metadata: {
              ...v.metadata,
              inventory_id: newInventoryId,
            },
          }
        }
        return v
      })
      return hasChanges ? updated : prev
    })
  }, [])

  const togglePreRunVariables = useCallback((show: boolean) => {
    setVariables((prev) => {
      if (show) {
        // Add pre_run variables if they don't exist
        const hasPreRunRaw = prev.some(v => v.name === 'pre_run.raw' && v.isDefault)
        const hasPreRunParsed = prev.some(v => v.name === 'pre_run.parsed' && v.isDefault)
        
        if (!hasPreRunRaw || !hasPreRunParsed) {
          const defaultVars = prev.filter(v => v.isDefault)
          const userVars = prev.filter(v => !v.isDefault)
          
          if (!hasPreRunRaw) {
            const preRunRaw: TemplateVariable = {
              id: 'default-pre_run.raw',
              name: 'pre_run.raw',
              value: '',
              type: 'auto-filled',
              isDefault: true,
              isAutoFilled: true,
              requiresExecution: true,
              isExecuting: false,
              description: 'Raw output from pre-run command execution',
            }
            defaultVars.push(preRunRaw)
          }

          if (!hasPreRunParsed) {
            const preRunParsed: TemplateVariable = {
              id: 'default-pre_run.parsed',
              name: 'pre_run.parsed',
              value: '',
              type: 'auto-filled',
              isDefault: true,
              isAutoFilled: true,
              requiresExecution: true,
              isExecuting: false,
              description: 'Parsed output from pre-run command (TextFSM)',
            }
            defaultVars.push(preRunParsed)
          }
          
          return [...defaultVars, ...userVars]
        }
        return prev
      } else {
        // Remove pre_run variables
        return prev.filter(v => !(v.name?.startsWith('pre_run.') && v.isDefault))
      }
    })
  }, [])

  return useMemo(
    () => ({
      variables,
      updateForCategory,
      updateDeviceData,
      updateSnmpMapping,
      toggleSnmpMappingVariable,
      toggleDeviceDetailsVariable,
      updatePath,
      addVariable,
      addVariableWithData,
      addVariableWithMetadata,
      removeVariable,
      updateVariable,
      setCustomVariables,
      updatePreRunVariable,
      setPreRunExecuting,
      togglePreRunVariables,
      updateInventoryIdForInventoryVariables,
    }),
    [variables, updateForCategory, updateDeviceData, updateSnmpMapping, toggleSnmpMappingVariable, toggleDeviceDetailsVariable, updatePath, addVariable, addVariableWithData, addVariableWithMetadata, removeVariable, updateVariable, setCustomVariables, updatePreRunVariable, setPreRunExecuting, togglePreRunVariables, updateInventoryIdForInventoryVariables]
  )
}
