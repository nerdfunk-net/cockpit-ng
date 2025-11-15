/**
 * Hook for managing saved inventory operations
 */

import { useState } from 'react'
import type { GitRepository, SavedInventory } from '../types'

export function useSavedInventories() {
  // Repositories for saved inventories
  const [inventoryRepositories, setInventoryRepositories] = useState<GitRepository[]>([])
  const [selectedInventoryRepo, setSelectedInventoryRepo] = useState<number | null>(null)

  // Saved inventories
  const [savedInventories, setSavedInventories] = useState<SavedInventory[]>([])
  const [isLoadingInventories, setIsLoadingInventories] = useState(false)

  // Save modal
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveInventoryName, setSaveInventoryName] = useState('')
  const [saveInventoryDescription, setSaveInventoryDescription] = useState('')
  const [isSavingInventory, setIsSavingInventory] = useState(false)
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false)
  const [inventoryToOverwrite, setInventoryToOverwrite] = useState<string | null>(null)

  // Load modal
  const [showLoadModal, setShowLoadModal] = useState(false)

  const resetSaveModal = () => {
    setSaveInventoryName('')
    setSaveInventoryDescription('')
    setShowOverwriteConfirm(false)
    setInventoryToOverwrite(null)
  }

  const closeSaveModal = () => {
    setShowSaveModal(false)
    resetSaveModal()
  }

  const closeLoadModal = () => {
    setShowLoadModal(false)
  }

  return {
    // Repository state
    inventoryRepositories,
    selectedInventoryRepo,

    // Saved inventories state
    savedInventories,
    isLoadingInventories,

    // Save modal state
    showSaveModal,
    saveInventoryName,
    saveInventoryDescription,
    isSavingInventory,
    showOverwriteConfirm,
    inventoryToOverwrite,

    // Load modal state
    showLoadModal,

    // Setters
    setInventoryRepositories,
    setSelectedInventoryRepo,
    setSavedInventories,
    setIsLoadingInventories,
    setShowSaveModal,
    setSaveInventoryName,
    setSaveInventoryDescription,
    setIsSavingInventory,
    setShowOverwriteConfirm,
    setInventoryToOverwrite,
    setShowLoadModal,

    // Actions
    resetSaveModal,
    closeSaveModal,
    closeLoadModal,
  }
}
