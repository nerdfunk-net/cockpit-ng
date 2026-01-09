import { useState, useCallback } from 'react'
import type { StatusMessage } from '../types/sync-devices.types'

/**
 * Hook for managing status messages and modals
 */
export function useStatusMessage() {
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null)
  const [showStatusModal, setShowStatusModal] = useState(false)

  const showMessage = useCallback((text: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setStatusMessage({ type, message: text })
    setShowStatusModal(true)
    
    // Auto-hide after 3 seconds for success and info
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        setStatusMessage(null)
        setShowStatusModal(false)
      }, 3000)
    }
  }, [])

  const clearMessage = useCallback(() => {
    setStatusMessage(null)
    setShowStatusModal(false)
  }, [])

  return {
    statusMessage,
    showStatusModal,
    setShowStatusModal,
    showMessage,
    clearMessage
  }
}
