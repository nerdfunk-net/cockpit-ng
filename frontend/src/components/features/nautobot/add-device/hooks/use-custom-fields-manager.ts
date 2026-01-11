import { useState, useCallback, useMemo, useEffect } from 'react'
import { useCustomFieldsQuery } from './queries/use-custom-fields-query'
import { EMPTY_OBJECT, EMPTY_STRING_ARRAY } from '../constants'
import type { CustomField } from '../types'
import { useApi } from '@/hooks/use-api'

export interface CustomFieldsManagerHook {
  customFields: CustomField[]
  customFieldValues: Record<string, string>
  customFieldChoices: Record<string, string[]>
  isLoading: boolean
  showModal: boolean
  openModal: () => void
  closeModal: () => void
  updateFieldValue: (key: string, value: string) => void
  setCustomFieldValues: (values: Record<string, string>) => void
  clearFieldValues: () => void
}

export function useCustomFieldsManager(): CustomFieldsManagerHook {
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>(EMPTY_OBJECT)
  const [customFieldChoices, setCustomFieldChoices] = useState<Record<string, string[]>>({})
  const [showModal, setShowModal] = useState(false)
  const { apiCall } = useApi()

  // Fetch custom fields when modal opens
  const { data: customFields = EMPTY_STRING_ARRAY as unknown as CustomField[], isLoading } = useCustomFieldsQuery({
    enabled: showModal,
  })

  // Load choices for select-type fields
  useEffect(() => {
    if (customFields.length > 0) {
      const selectFields = customFields.filter(
        (f) => f.type?.value === 'select' || f.type?.value === 'multi-select'
      )
      
      if (selectFields.length > 0) {
        Promise.all(
          selectFields.map(async (field) => {
            try {
              const choices = await apiCall<string[]>(
                `nautobot/custom-field-choices/${field.key}`,
                { method: 'GET' }
              )
              return { key: field.key, choices: choices || [] }
            } catch {
              return { key: field.key, choices: [] }
            }
          })
        ).then((results) => {
          const choicesMap: Record<string, string[]> = {}
          results.forEach((result) => {
            choicesMap[result.key] = result.choices
          })
          setCustomFieldChoices(choicesMap)
        })
      }
    }
  }, [customFields, apiCall])

  const openModal = useCallback(() => {
    setShowModal(true)
  }, [])

  const closeModal = useCallback(() => {
    setShowModal(false)
  }, [])

  const updateFieldValue = useCallback((key: string, value: string) => {
    setCustomFieldValues((prev) => ({
      ...prev,
      [key]: value,
    }))
  }, [])

  const clearFieldValues = useCallback(() => {
    setCustomFieldValues(EMPTY_OBJECT)
  }, [])

  return useMemo(
    () => ({
      customFields,
      customFieldValues,
      customFieldChoices,
      isLoading,
      showModal,
      openModal,
      closeModal,
      updateFieldValue,
      setCustomFieldValues,
      clearFieldValues,
    }),
    [
      customFields,
      customFieldValues,
      customFieldChoices,
      isLoading,
      showModal,
      openModal,
      closeModal,
      updateFieldValue,
      clearFieldValues,
    ]
  )
}
