import { useState, useCallback } from 'react'
import type { StatusMessage } from '@/types/features/checkmk/live-update'

export function useStatusMessages() {
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null)

  const showMessage = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    // Prevent showing the same message repeatedly
    setStatusMessage(prev => {
      if (prev?.text === text && prev?.type === type) {
        return prev // Don't update if it's the same message
      }
      return { type, text }
    })

    // Auto-hide after 5 seconds for success and info only (not errors)
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

  const clearMessage = useCallback(() => {
    setStatusMessage(null)
  }, [])

  return {
    statusMessage,
    showMessage,
    clearMessage
  }
}
