import { useState, useCallback, useMemo } from 'react'
import type { TemplateVariable } from '../types'
import { getDefaultVariables } from '../utils/category-variables'

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
      addVariable,
      removeVariable,
      updateVariable,
    }),
    [variables, updateForCategory, addVariable, removeVariable, updateVariable]
  )
}
