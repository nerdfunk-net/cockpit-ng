import { useState, useCallback, useMemo } from 'react'

// Store variable overrides as a simple key-value map
export type VariableOverrides = Record<string, string>

const EMPTY_OVERRIDES: VariableOverrides = {}

export function useVariableManager() {
  const [variableOverrides, setVariableOverrides] = useState<VariableOverrides>(EMPTY_OVERRIDES)

  const updateVariableOverride = useCallback((name: string, value: string) => {
    setVariableOverrides(prev => ({
      ...prev,
      [name]: value
    }))
  }, [])

  const clearOverrides = useCallback(() => {
    setVariableOverrides(EMPTY_OVERRIDES)
  }, [])

  return useMemo(() => ({
    variableOverrides,
    updateVariableOverride,
    clearOverrides,
  }), [
    variableOverrides,
    updateVariableOverride,
    clearOverrides
  ])
}
