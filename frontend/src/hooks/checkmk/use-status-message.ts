import { useState, useCallback, useMemo } from 'react'
import type { StatusMessage } from '@/types/checkmk/types'

interface UseStatusMessageReturn {
  statusMessage: StatusMessage | null
  showMessage: (text: string, type?: 'success' | 'error' | 'info') => void
  clearMessage: () => void
}

/**
 * Custom hook for managing status messages with automatic timeout
 * 
 * @returns Object with statusMessage state and control functions
 */
export function useStatusMessage(): UseStatusMessageReturn {
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null)

  /**
   * Show a status message to the user
   * Success and info messages auto-dismiss after 5 seconds
   * Error messages stay until manually cleared
   */
  const showMessage = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setStatusMessage(prev => {
      // Prevent duplicate messages
      if (prev?.text === text && prev?.type === type) {
        return prev
      }
      return { type, text }
    })

    // Auto-dismiss success and info messages
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        setStatusMessage(prev => {
          // Only clear if it's still the same message
          if (prev?.text === text) {
            return null
          }
          return prev
        })
      }, 5000)
    }
  }, [])

  /**
   * Manually clear the current status message
   */
  const clearMessage = useCallback(() => {
    setStatusMessage(null)
  }, [])

  return useMemo(() => ({
    statusMessage,
    showMessage,
    clearMessage
  }), [statusMessage, showMessage, clearMessage])
}
