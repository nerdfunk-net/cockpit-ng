import { useState, useEffect, useCallback, useRef } from 'react'
import type { StatusMessage } from '@/types/features/nautobot/offboard'

export function useStatusMessages() {
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null)
  const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastMessageRef = useRef<string>('')

  const showMessage = useCallback((message: string, type: StatusMessage['type']) => {
    // Prevent showing duplicate messages
    if (message === lastMessageRef.current) return

    lastMessageRef.current = message

    // Clear any existing timeout
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current)
    }

    setStatusMessage({ type, message })

    // Auto-hide success messages after 2 seconds
    if (type === 'success') {
      messageTimeoutRef.current = setTimeout(() => {
        setStatusMessage(null)
        lastMessageRef.current = ''
      }, 2000)
    }
  }, [])

  const clearMessage = useCallback(() => {
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current)
    }
    setStatusMessage(null)
    lastMessageRef.current = ''
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current)
      }
    }
  }, [])

  return {
    statusMessage,
    showMessage,
    clearMessage
  }
}
