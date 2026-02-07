import { useState, useCallback, useMemo } from 'react'
import type { TemplateVariable } from '../types'
import { getDefaultVariables } from '../utils/category-variables'

interface DeviceData {
  devices: Array<{ id: string; name: string }>
  device_details: Record<string, unknown>
}

export function useTemplateVariables(initialCategory: string = '__none__') {
  const [variables, setVariables] = useState<TemplateVariable[]>(() =>
    getDefaultVariables(initialCategory)
  )

  const updateForCategory = useCallback((category: string) => {
    setVariables((prev) => {
      const userVars = prev.filter((v) => !v.isDefault)
      const defaults = getDefaultVariables(category)
      return [...defaults, ...userVars]
    })
  }, [])

  const updateDeviceData = useCallback((deviceData: DeviceData | null) => {
    setVariables((prev) =>
      prev.map((v) => {
        if (!v.isDefault || !v.isAutoFilled) return v

        if (v.name === 'devices' && deviceData) {
          return {
            ...v,
            value: JSON.stringify(deviceData.devices, null, 2),
          }
        }

        if (v.name === 'device_details' && deviceData) {
          return {
            ...v,
            value: JSON.stringify(deviceData.device_details, null, 2),
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
      addVariable,
      removeVariable,
      updateVariable,
    }),
    [variables, updateForCategory, updateDeviceData, addVariable, removeVariable, updateVariable]
  )
}
