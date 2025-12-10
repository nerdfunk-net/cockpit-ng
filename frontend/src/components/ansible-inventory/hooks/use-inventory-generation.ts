/**
 * Hook for managing template and inventory generation
 */

import { useState, useMemo } from 'react'

export function useInventoryGeneration() {
  // Template state
  const [templateCategories, setTemplateCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [availableTemplates, setAvailableTemplates] = useState<string[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [showTemplateSection, setShowTemplateSection] = useState(false)

  // Inventory generation
  const [generatedInventory, setGeneratedInventory] = useState('')
  const [showInventorySection, setShowInventorySection] = useState(false)
  const [isGeneratingInventory, setIsGeneratingInventory] = useState(false)

  // Custom fields
  const [showCustomFieldsMenu, setShowCustomFieldsMenu] = useState(false)

  const resetTemplateSelection = () => {
    setSelectedCategory('')
    setAvailableTemplates([])
    setSelectedTemplate('')
    setShowTemplateSection(false)
  }

  const resetGeneration = () => {
    setGeneratedInventory('')
    setShowInventorySection(false)
  }

  return useMemo(() => ({
    // Template state
    templateCategories,
    selectedCategory,
    availableTemplates,
    selectedTemplate,
    showTemplateSection,

    // Inventory state
    generatedInventory,
    showInventorySection,
    isGeneratingInventory,

    // UI state
    showCustomFieldsMenu,

    // Setters
    setTemplateCategories,
    setSelectedCategory,
    setAvailableTemplates,
    setSelectedTemplate,
    setShowTemplateSection,
    setGeneratedInventory,
    setShowInventorySection,
    setIsGeneratingInventory,
    setShowCustomFieldsMenu,

    // Actions
    resetTemplateSelection,
    resetGeneration,
  }), [
    templateCategories,
    selectedCategory,
    availableTemplates,
    selectedTemplate,
    showTemplateSection,
    generatedInventory,
    showInventorySection,
    isGeneratingInventory,
    showCustomFieldsMenu
  ])
}
