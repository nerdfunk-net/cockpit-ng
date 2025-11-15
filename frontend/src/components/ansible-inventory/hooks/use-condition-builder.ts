/**
 * Hook for managing condition builder state
 * Handles logical conditions, field selections, and operators
 */

import { useState } from 'react'
import type { LogicalCondition, FieldOption, LocationItem, CustomField } from '../types'

export function useConditionBuilder() {
  // Condition state
  const [conditions, setConditions] = useState<LogicalCondition[]>([])
  const [currentField, setCurrentField] = useState('')
  const [currentOperator, setCurrentOperator] = useState('equals')
  const [currentValue, setCurrentValue] = useState('')
  const [currentLogic, setCurrentLogic] = useState('AND')

  // Field options
  const [fieldOptions, setFieldOptions] = useState<FieldOption[]>([])
  const [operatorOptions, setOperatorOptions] = useState<FieldOption[]>([])
  const [logicOptions, setLogicOptions] = useState<FieldOption[]>([])
  const [fieldValues, setFieldValues] = useState<FieldOption[]>([])
  const [customFields, setCustomFields] = useState<CustomField[]>([])

  // Location handling
  const [locations, setLocations] = useState<LocationItem[]>([])
  const [locationSearchValue, setLocationSearchValue] = useState('')
  const [showLocationDropdown, setShowLocationDropdown] = useState(false)

  // Loading states
  const [isLoadingFieldValues, setIsLoadingFieldValues] = useState(false)

  const addCondition = () => {
    if (!currentField || !currentValue) {
      return false
    }

    const newCondition: LogicalCondition = {
      field: currentField,
      operator: currentOperator,
      value: currentValue,
      logic: currentLogic
    }

    setConditions([...conditions, newCondition])
    setCurrentField('')
    setCurrentOperator('equals')
    setCurrentValue('')
    setFieldValues([])
    setLocationSearchValue('')
    return true
  }

  const removeCondition = (index: number) => {
    const newConditions = conditions.filter((_, i) => i !== index)
    setConditions(newConditions)
  }

  const clearAllConditions = () => {
    if (conditions.length === 0 || !confirm('Are you sure you want to clear all conditions?')) {
      return false
    }
    setConditions([])
    setCurrentField('')
    setCurrentOperator('equals')
    setCurrentValue('')
    setFieldValues([])
    setLocationSearchValue('')
    return true
  }

  const loadConditions = (loadedConditions: LogicalCondition[]) => {
    setConditions(loadedConditions)
  }

  return {
    // State
    conditions,
    currentField,
    currentOperator,
    currentValue,
    currentLogic,
    fieldOptions,
    operatorOptions,
    logicOptions,
    fieldValues,
    customFields,
    locations,
    locationSearchValue,
    showLocationDropdown,
    isLoadingFieldValues,

    // Setters
    setConditions,
    setCurrentField,
    setCurrentOperator,
    setCurrentValue,
    setCurrentLogic,
    setFieldOptions,
    setOperatorOptions,
    setLogicOptions,
    setFieldValues,
    setCustomFields,
    setLocations,
    setLocationSearchValue,
    setShowLocationDropdown,
    setIsLoadingFieldValues,

    // Actions
    addCondition,
    removeCondition,
    clearAllConditions,
    loadConditions,
  }
}
