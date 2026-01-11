import { useState, useCallback, useMemo } from 'react'
import type { CheckMKHost } from '@/types/checkmk/types'

interface UseModalStateReturn {
  // Host Details Modal
  isHostModalOpen: boolean
  selectedHostForView: CheckMKHost | null
  openHostModal: (host: CheckMKHost) => void
  closeHostModal: () => void
  
  // Inventory Modal
  isInventoryModalOpen: boolean
  selectedHostForInventory: CheckMKHost | null
  openInventoryModal: (host: CheckMKHost) => void
  closeInventoryModal: () => void
}

/**
 * Custom hook for managing modal states in the hosts inventory page
 * Simplifies modal state management by grouping related states together
 * 
 * @returns Object with modal states and control functions
 */
export function useModalState(): UseModalStateReturn {
  // Host Details Modal
  const [isHostModalOpen, setIsHostModalOpen] = useState(false)
  const [selectedHostForView, setSelectedHostForView] = useState<CheckMKHost | null>(null)
  
  // Inventory Modal
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false)
  const [selectedHostForInventory, setSelectedHostForInventory] = useState<CheckMKHost | null>(null)

  /**
   * Open host details modal with selected host
   */
  const openHostModal = useCallback((host: CheckMKHost) => {
    setSelectedHostForView(host)
    setIsHostModalOpen(true)
  }, [])

  /**
   * Close host details modal
   */
  const closeHostModal = useCallback(() => {
    setIsHostModalOpen(false)
    setSelectedHostForView(null)
  }, [])

  /**
   * Open inventory modal with selected host
   */
  const openInventoryModal = useCallback((host: CheckMKHost) => {
    setSelectedHostForInventory(host)
    setIsInventoryModalOpen(true)
  }, [])

  /**
   * Close inventory modal
   */
  const closeInventoryModal = useCallback(() => {
    setIsInventoryModalOpen(false)
    setSelectedHostForInventory(null)
  }, [])

  return useMemo(() => ({
    isHostModalOpen,
    selectedHostForView,
    openHostModal,
    closeHostModal,
    isInventoryModalOpen,
    selectedHostForInventory,
    openInventoryModal,
    closeInventoryModal
  }), [
    isHostModalOpen,
    selectedHostForView,
    openHostModal,
    closeHostModal,
    isInventoryModalOpen,
    selectedHostForInventory,
    openInventoryModal,
    closeInventoryModal
  ])
}
