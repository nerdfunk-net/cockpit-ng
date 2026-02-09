import { useState } from 'react'
import type { TemplateVariable } from '../types'
import { validateVariableName } from '../utils/netmiko-utils'

export function useVariableManager() {
  const [variables, setVariables] = useState<TemplateVariable[]>([
    { id: crypto.randomUUID(), name: '', value: '' }
  ])

  const addVariable = () => {
    setVariables([...variables, { id: crypto.randomUUID(), name: '', value: '' }])
  }

  const removeVariable = (id: string) => {
    if (variables.length > 1) {
      setVariables(variables.filter(v => v.id !== id))
    }
  }

  const updateVariable = (id: string, field: 'name' | 'value', value: string) => {
    setVariables(variables.map(v =>
      v.id === id ? { ...v, [field]: value } : v
    ))
  }

  return {
    variables,
    setVariables,
    addVariable,
    removeVariable,
    updateVariable,
    validateVariableName,
  }
}
