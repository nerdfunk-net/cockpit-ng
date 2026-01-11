import { useState, useCallback, useMemo } from 'react'
import { useCustomFieldsQuery } from './queries/use-custom-fields-query'
import { EMPTY_OBJECT } from '../constants'
import type { CustomField } from '../types'

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
  const [showModal, setShowModal] = useState(false)

  // Fetch custom fields when modal opens
  const { data: customFields = [], isLoading } = useCustomFieldsQuery({
    enabled: showModal,
  })

  // TODO: Load choices for select fields
  // This would require using useQueries for multiple choice queries

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
      customFieldChoices: {}, // TODO: Implement with useQueries
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
      isLoading,
      showModal,
      openModal,
      closeModal,
      updateFieldValue,
      clearFieldValues,
    ]
  )
}
