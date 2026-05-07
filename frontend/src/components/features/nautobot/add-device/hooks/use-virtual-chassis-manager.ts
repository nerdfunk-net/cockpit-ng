'use client'

import { useState, useCallback, useMemo } from 'react'

export function useVirtualChassisManager() {
  const [showModal, setShowModal] = useState(false)
  const [selectedVcId, setSelectedVcId] = useState('')
  const [selectedVcName, setSelectedVcName] = useState('')

  const openModal = useCallback(() => setShowModal(true), [])
  const closeModal = useCallback(() => setShowModal(false), [])

  const selectVirtualChassis = useCallback((id: string, name: string) => {
    setSelectedVcId(id)
    setSelectedVcName(name)
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedVcId('')
    setSelectedVcName('')
  }, [])

  const isConfigured = selectedVcId !== ''

  return useMemo(
    () => ({
      showModal,
      openModal,
      closeModal,
      selectedVcId,
      selectedVcName,
      selectVirtualChassis,
      clearSelection,
      isConfigured,
    }),
    [showModal, openModal, closeModal, selectedVcId, selectedVcName, selectVirtualChassis, clearSelection, isConfigured]
  )
}
