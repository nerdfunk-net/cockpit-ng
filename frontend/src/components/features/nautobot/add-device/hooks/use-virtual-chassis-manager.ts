'use client'

import { useState, useCallback, useMemo } from 'react'

export type VirtualChassisMode = 'select' | 'create'

export function useVirtualChassisManager() {
  const [showModal, setShowModal] = useState(false)
  const [selectedVcId, setSelectedVcId] = useState('')
  const [selectedVcName, setSelectedVcName] = useState('')
  const [newVcName, setNewVcName] = useState('')
  const [mode, setMode] = useState<VirtualChassisMode>('select')

  const openModal = useCallback(() => setShowModal(true), [])
  const closeModal = useCallback(() => setShowModal(false), [])

  const selectVirtualChassis = useCallback((id: string, name: string) => {
    setSelectedVcId(id)
    setSelectedVcName(name)
    setNewVcName('')
    setMode('select')
  }, [])

  const updateNewVcName = useCallback((name: string) => {
    setNewVcName(name)
    if (name.trim()) {
      setSelectedVcId('')
      setSelectedVcName('')
      setMode('create')
    }
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedVcId('')
    setSelectedVcName('')
    setNewVcName('')
    setMode('select')
  }, [])

  const isConfigured = selectedVcId !== '' || newVcName.trim() !== ''

  return useMemo(
    () => ({
      showModal,
      openModal,
      closeModal,
      selectedVcId,
      selectedVcName,
      newVcName,
      updateNewVcName,
      mode,
      setMode,
      selectVirtualChassis,
      clearSelection,
      isConfigured,
    }),
    [
      showModal,
      openModal,
      closeModal,
      selectedVcId,
      selectedVcName,
      newVcName,
      updateNewVcName,
      mode,
      setMode,
      selectVirtualChassis,
      clearSelection,
      isConfigured,
    ]
  )
}
