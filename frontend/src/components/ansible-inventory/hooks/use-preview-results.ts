/**
 * Hook for managing preview results and device data
 */

import { useState } from 'react'
import type { DeviceInfo } from '../types'

export function usePreviewResults() {
  const [previewDevices, setPreviewDevices] = useState<DeviceInfo[]>([])
  const [totalDevices, setTotalDevices] = useState(0)
  const [operationsExecuted, setOperationsExecuted] = useState(0)
  const [showPreviewResults, setShowPreviewResults] = useState(false)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const resetPreview = () => {
    setPreviewDevices([])
    setTotalDevices(0)
    setOperationsExecuted(0)
    setShowPreviewResults(false)
    setCurrentPage(1)
  }

  const updatePreview = (devices: DeviceInfo[], total: number, operations: number) => {
    setPreviewDevices(devices)
    setTotalDevices(total)
    setOperationsExecuted(operations)
    setShowPreviewResults(true)
    setCurrentPage(1)
  }

  // Pagination calculations
  const totalPages = Math.ceil(previewDevices.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, previewDevices.length)
  const currentPageDevices = previewDevices.slice(startIndex, endIndex)

  return {
    // State
    previewDevices,
    totalDevices,
    operationsExecuted,
    showPreviewResults,
    isLoadingPreview,
    currentPage,
    pageSize,
    
    // Computed
    totalPages,
    startIndex,
    endIndex,
    currentPageDevices,

    // Setters
    setPreviewDevices,
    setTotalDevices,
    setOperationsExecuted,
    setShowPreviewResults,
    setIsLoadingPreview,
    setCurrentPage,
    setPageSize,

    // Actions
    resetPreview,
    updatePreview,
  }
}
