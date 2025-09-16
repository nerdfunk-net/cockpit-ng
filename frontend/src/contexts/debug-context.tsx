'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { setDebugEnabled, debug } from '@/lib/debug'

interface DebugContextType {
  isDebugEnabled: boolean
  toggleDebug: (enabled: boolean) => void
  refreshDebugState: () => Promise<void>
}

const DebugContext = createContext<DebugContextType | undefined>(undefined)

export function DebugProvider({ children }: { children: React.ReactNode }) {
  const [isDebugEnabled, setIsDebugEnabled] = useState(false)
  const { user, token } = useAuthStore()

  // Function to fetch debug state from backend
  const refreshDebugState = async () => {
    if (!user || !token) {
      setIsDebugEnabled(false)
      setDebugEnabled(false)
      return
    }

    try {
      const response = await fetch('/api/proxy/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        const debugMode = data.debug || false
        setIsDebugEnabled(debugMode)
        setDebugEnabled(debugMode)
        
        if (debugMode) {
          debug.log('Debug context: Debug mode loaded from profile - ENABLED')
        }
      }
    } catch (error) {
      console.error('Failed to load debug state:', error)
      setIsDebugEnabled(false)
      setDebugEnabled(false)
    }
  }

  // Function to toggle debug mode and update backend
  const toggleDebug = async (enabled: boolean) => {
    if (!user || !token) return

    try {
      const response = await fetch('/api/proxy/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ debug: enabled })
      })

      if (response.ok) {
        setIsDebugEnabled(enabled)
        setDebugEnabled(enabled)
        
        if (enabled) {
          debug.log('Debug context: Debug mode toggled - ENABLED')
        } else {
          console.log('🐛 [DEBUG] Debug context: Debug mode toggled - DISABLED')
        }
      } else {
        console.error('Failed to update debug preference')
      }
    } catch (error) {
      console.error('Error toggling debug mode:', error)
    }
  }

  // Load debug state when user changes or component mounts
  useEffect(() => {
    refreshDebugState()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token]) // refreshDebugState is stable and depends on user, token

  // Monitor for changes to debug mode via other means (like profile page)
  useEffect(() => {
    const checkDebugState = () => refreshDebugState()
    
    // Only check when user focuses the tab (no periodic polling)
    window.addEventListener('focus', checkDebugState)
    
    return () => {
      window.removeEventListener('focus', checkDebugState)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token]) // refreshDebugState is stable and depends on user, token

  const contextValue: DebugContextType = {
    isDebugEnabled,
    toggleDebug,
    refreshDebugState
  }

  return (
    <DebugContext.Provider value={contextValue}>
      {children}
    </DebugContext.Provider>
  )
}

export function useDebug() {
  const context = useContext(DebugContext)
  if (context === undefined) {
    throw new Error('useDebug must be used within a DebugProvider')
  }
  return context
}