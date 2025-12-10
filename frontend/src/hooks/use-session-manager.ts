'use client'

import React, { useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/lib/auth-store'

interface SessionConfig {
  /** Time before token expiry to refresh (in milliseconds) */
  refreshBeforeExpiry?: number
  /** Activity timeout - max idle time before stopping auto-refresh (in milliseconds) */
  activityTimeout?: number
  /** Check interval for token expiry (in milliseconds) */
  checkInterval?: number
}

const DEFAULT_CONFIG: Required<SessionConfig> = {
  refreshBeforeExpiry: 2 * 60 * 1000, // 2 minutes before expiry
  activityTimeout: 15 * 60 * 1000, // 15 minutes of inactivity
  checkInterval: 30 * 1000, // Check every 30 seconds
}

const EMPTY_CONFIG: SessionConfig = {}

export function useSessionManager(config: SessionConfig = EMPTY_CONFIG) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  const { token, login, logout, user, hydrate } = useAuthStore()
  
  const lastActivityRef = useRef<number>(0)
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const scheduleRefreshRef = useRef<((expiryTime: number) => void) | null>(null)
  
  // Initialize lastActivityRef on mount only
  useEffect(() => {
    lastActivityRef.current = Date.now()
  }, [])
  
  // Hydrate auth state from cookies on component mount
  useEffect(() => {
    hydrate()
  }, [hydrate])
  
  // Track user activity
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
  }, [])

  // Activity event listeners (constant reference)
  const activityEvents = React.useMemo(() => [
    'mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click', 'focus'
  ], [])

  useEffect(() => {
    // Add activity listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true })
    })

    return () => {
      // Clean up activity listeners
      activityEvents.forEach(event => {
        document.removeEventListener(event, updateActivity)
      })
    }
  }, [updateActivity, activityEvents])

  // Parse JWT token to get expiry time
  const getTokenExpiry = useCallback((token: string): number | null => {
    try {
      const base64Url = token.split('.')[1]
      if (!base64Url) {
        return null
      }
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      )
      const decoded = JSON.parse(jsonPayload)
      return decoded.exp ? decoded.exp * 1000 : null // Convert to milliseconds
    } catch (error) {
      console.error('Failed to decode token:', error)
      return null
    }
  }, [])

  // Check if user is still active
  const isUserActive = useCallback((): boolean => {
    const timeSinceActivity = Date.now() - lastActivityRef.current
    return timeSinceActivity < finalConfig.activityTimeout
  }, [finalConfig.activityTimeout])

  // Refresh token function
  const refreshToken = useCallback(async (): Promise<boolean> => {
    if (!token || !user) {
      console.log('Session Manager: No token or user available for refresh')
      return false
    }

    try {
      console.log('Session Manager: Refreshing token...')
      
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        console.log('Session Manager: Token refresh failed with status:', response.status)
        if (response.status === 401) {
          // Token is invalid/expired, logout user
          console.log('Session Manager: Token invalid, logging out user')
          logout()
          // Redirect to login page
          if (typeof window !== 'undefined') {
            window.location.href = '/login'
          }
          return false
        }
        // For 403 and other errors, don't logout but stop refresh attempts
        console.log('Session Manager: Token refresh failed, but keeping user logged in')
        return false
      }

      const data = await response.json()
      
      if (data.access_token && data.user) {
        console.log('Session Manager: Token refreshed successfully')
        login(data.access_token, {
          id: data.user.id?.toString() || data.user.username,
          username: data.user.username,
          email: data.user.email || `${data.user.username}@demo.com`,
          role: data.user.role,
          permissions: data.user.permissions,
        })
        return true
      } else {
        console.error('Session Manager: Invalid refresh response format')
        return false
      }
    } catch (error) {
      console.error('Session Manager: Token refresh error:', error)
      return false
    }
  }, [token, user, login, logout])

  // Schedule token refresh - using ref pattern for recursive callback
  const scheduleRefresh = useCallback((expiryTime: number) => {
    // Clear existing timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current)
      refreshTimeoutRef.current = null
    }

    const now = Date.now()
    const refreshTime = expiryTime - finalConfig.refreshBeforeExpiry
    const timeUntilRefresh = refreshTime - now

    if (timeUntilRefresh > 0) {
      console.log(`Session Manager: Token refresh scheduled in ${Math.round(timeUntilRefresh / 1000)} seconds`)
      
      refreshTimeoutRef.current = setTimeout(async () => {
        // Only refresh if user is still active
        if (isUserActive()) {
          console.log('Session Manager: User is active, refreshing token')
          const success = await refreshToken()
          
          if (success) {
            // Schedule next refresh for the new token - use ref to avoid circular dependency
            const newExpiryTime = getTokenExpiry(useAuthStore.getState().token!)
            if (newExpiryTime && scheduleRefreshRef.current) {
              scheduleRefreshRef.current(newExpiryTime)
            }
          }
        } else {
          console.log('Session Manager: User inactive, skipping token refresh')
        }
      }, timeUntilRefresh)
    } else {
      console.log('Session Manager: Token already expired or expires very soon')
    }
  }, [finalConfig.refreshBeforeExpiry, isUserActive, refreshToken, getTokenExpiry])

  // Update ref whenever scheduleRefresh changes
  useEffect(() => {
    scheduleRefreshRef.current = scheduleRefresh
  }, [scheduleRefresh])

  // Periodic check for token expiry, user activity, and cookie presence
  const startPeriodicCheck = useCallback(() => {
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current)
      checkIntervalRef.current = null
    }

    checkIntervalRef.current = setInterval(() => {
      const currentToken = useAuthStore.getState().token
      
      // Check if cookies were cleared externally
      const cookieToken = typeof window !== 'undefined' ?
        document.cookie.split(';').find(row => row.trim().startsWith('cockpit_auth_token=')) : null

      if (currentToken && !cookieToken) {
        console.log('Session Manager: Cookies cleared externally, logging out')
        logout()
        // Redirect to login page
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        return
      }
      
      if (!currentToken) {
        console.log('Session Manager: No token available, stopping periodic check')
        return
      }

      const expiryTime = getTokenExpiry(currentToken)
      if (!expiryTime) {
        console.log('Session Manager: Cannot determine token expiry')
        return
      }

      const now = Date.now()
      const timeUntilExpiry = expiryTime - now

      // If token is about to expire and user is active, refresh immediately
      if (timeUntilExpiry < finalConfig.refreshBeforeExpiry && timeUntilExpiry > 0) {
        if (isUserActive()) {
          console.log('Session Manager: Token about to expire and user is active, refreshing now')
          refreshToken().then(success => {
            if (success) {
              const newExpiryTime = getTokenExpiry(useAuthStore.getState().token!)
              if (newExpiryTime && scheduleRefreshRef.current) {
                scheduleRefreshRef.current(newExpiryTime)
              }
            }
          })
        }
      }

      // If token has expired, logout
      if (timeUntilExpiry <= 0) {
        console.log('Session Manager: Token has expired, logging out')
        logout()
        // Redirect to login page
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
      }
    }, finalConfig.checkInterval)
  }, [getTokenExpiry, finalConfig.refreshBeforeExpiry, finalConfig.checkInterval, isUserActive, refreshToken, logout])

  // Main effect to manage session
  useEffect(() => {
    if (!token || !user) {
      // Clear any existing timers when not authenticated
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
        refreshTimeoutRef.current = null
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
        checkIntervalRef.current = null
      }
      return
    }

    console.log('Session Manager: Starting session management')
    
    // Get token expiry and schedule refresh
    const expiryTime = getTokenExpiry(token)
    if (expiryTime) {
      scheduleRefresh(expiryTime)
    }

    // Start periodic checking
    startPeriodicCheck()

    // Cleanup function
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
        refreshTimeoutRef.current = null
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
        checkIntervalRef.current = null
      }
    }
  }, [token, user, getTokenExpiry, scheduleRefresh, startPeriodicCheck])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
        refreshTimeoutRef.current = null
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
        checkIntervalRef.current = null
      }
    }
  }, [])

  // Return API with getter functions instead of calling impure functions during render
  return React.useMemo(() => ({
    isUserActive,
    getTimeSinceActivity: () => Date.now() - lastActivityRef.current,
    refreshToken,
  }), [isUserActive, refreshToken])
}
