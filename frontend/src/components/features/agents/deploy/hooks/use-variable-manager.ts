import { useState, useCallback, useMemo } from 'react'

interface TemplateVariable {
  id: string
  name: string
  value: string
}

const INITIAL_VARIABLES: TemplateVariable[] = [
  { id: crypto.randomUUID(), name: '', value: '' }
]

export function useVariableManager() {
  const [variables, setVariables] = useState<TemplateVariable[]>(INITIAL_VARIABLES)
  const [passSnmpMapping, setPassSnmpMapping] = useState(true)

  const addVariable = useCallback(() => {
    setVariables(prev => [...prev, { id: crypto.randomUUID(), name: '', value: '' }])
  }, [])

  const removeVariable = useCallback((id: string) => {
    setVariables(prev => {
      if (prev.length > 1) {
        return prev.filter(v => v.id !== id)
      }
      return prev
    })
  }, [])

  const updateVariable = useCallback((id: string, field: 'name' | 'value', value: string) => {
    setVariables(prev => prev.map(v =>
      v.id === id ? { ...v, [field]: value } : v
    ))
  }, [])

  return useMemo(() => ({
    variables,
    setVariables,
    passSnmpMapping,
    setPassSnmpMapping,
    addVariable,
    removeVariable,
    updateVariable,
  }), [
    variables,
    passSnmpMapping,
    addVariable,
    removeVariable,
    updateVariable
  ])
}
