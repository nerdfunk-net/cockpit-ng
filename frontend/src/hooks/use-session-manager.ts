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
  activityTimeout: 25 * 60 * 1000, // 25 minutes of inactivity (less than 30 min token expiry)
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
  const refreshTokenRef = useRef<((retryCount?: number, maxRetries?: number) => Promise<boolean>) | null>(null)
  const isRefreshingRef = useRef<boolean>(false) // Track if refresh is in progress
  
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

  // Refresh token function with retry mechanism
  const refreshToken = useCallback(async (retryCount = 0, maxRetries = 3): Promise<boolean> => {
    if (!token || !user) {
      console.warn('Session Manager: No token or user available for refresh')
      return false
    }

    // Prevent concurrent refresh attempts
    if (isRefreshingRef.current) {
      console.warn('Session Manager: Refresh already in progress, skipping')
      return false
    }

    isRefreshingRef.current = true

    try {
      console.warn(`Session Manager: Refreshing token... (attempt ${retryCount + 1}/${maxRetries + 1})`)

      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        console.warn('Session Manager: Token refresh failed with status:', response.status)
        if (response.status === 401) {
          // Token is invalid/expired, logout user
          console.warn('Session Manager: Token invalid, logging out user')
          isRefreshingRef.current = false
          logout()
          // Redirect to login page - use replace to clear any URL parameters
          if (typeof window !== 'undefined') {
            window.location.replace('/login')
          }
          return false
        }

        // For transient errors (5xx, network), retry with exponential backoff
        if (response.status >= 500 && retryCount < maxRetries) {
          const delay = 1000 * Math.pow(2, retryCount) // Exponential backoff: 1s, 2s, 4s
          console.warn(`Session Manager: Retrying refresh in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          isRefreshingRef.current = false
          // Use ref to avoid circular dependency
          return refreshTokenRef.current ? refreshTokenRef.current(retryCount + 1, maxRetries) : false
        }

        // For 403 and other errors, don't logout but stop refresh attempts
        console.warn('Session Manager: Token refresh failed, but keeping user logged in')
        isRefreshingRef.current = false
        return false
      }

      const data = await response.json()

      if (data.access_token && data.user) {
        console.warn('Session Manager: Token refreshed successfully')

        // Handle both new RBAC roles (array) and legacy role (string) for backwards compatibility
        let roles: string[] = []
        if (Array.isArray(data.user.roles)) {
          roles = data.user.roles
        } else if (data.user.role && typeof data.user.role === 'string') {
          // Fallback: if roles array missing, use legacy single role field
          roles = [data.user.role]
          console.warn('Session Manager: Using legacy "role" field, "roles" array missing in refresh response')
        }

        login(data.access_token, {
          id: data.user.id?.toString() || data.user.username,
          username: data.user.username,
          email: data.user.email || `${data.user.username}@demo.com`,
          roles: roles,
          permissions: data.user.permissions,
        })
        isRefreshingRef.current = false
        return true
      } else {
        console.error('Session Manager: Invalid refresh response format')
        isRefreshingRef.current = false
        return false
      }
    } catch (error) {
      console.error('Session Manager: Token refresh error:', error)

      // Retry on network errors
      if (retryCount < maxRetries) {
        const delay = 1000 * Math.pow(2, retryCount)
        console.warn(`Session Manager: Network error, retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        isRefreshingRef.current = false
        // Use ref to avoid circular dependency
        return refreshTokenRef.current ? refreshTokenRef.current(retryCount + 1, maxRetries) : false
      }

      isRefreshingRef.current = false
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
      console.warn(`Session Manager: Token refresh scheduled in ${Math.round(timeUntilRefresh / 1000)} seconds`)

      refreshTimeoutRef.current = setTimeout(async () => {
        // Only refresh if user is still active
        if (isUserActive()) {
          console.warn('Session Manager: User is active, refreshing token')
          const success = await refreshToken()

          if (success) {
            // Schedule next refresh for the new token - use ref to avoid circular dependency
            const newExpiryTime = getTokenExpiry(useAuthStore.getState().token!)
            if (newExpiryTime && scheduleRefreshRef.current) {
              scheduleRefreshRef.current(newExpiryTime)
            }
          }
        } else {
          console.warn('Session Manager: User inactive, skipping token refresh')
        }
      }, timeUntilRefresh)
    } else {
      console.warn('Session Manager: Token already expired or expires very soon')
    }
  }, [finalConfig.refreshBeforeExpiry, isUserActive, refreshToken, getTokenExpiry])

  // Update ref whenever scheduleRefresh changes
  useEffect(() => {
    scheduleRefreshRef.current = scheduleRefresh
  }, [scheduleRefresh])

  // Update ref whenever refreshToken changes
  useEffect(() => {
    refreshTokenRef.current = refreshToken
  }, [refreshToken])

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
        console.warn('Session Manager: Cookies cleared externally, logging out')
        logout()
        // Redirect to login page - use replace to clear any URL parameters
        if (typeof window !== 'undefined') {
          window.location.replace('/login')
        }
        return
      }

      if (!currentToken) {
        console.warn('Session Manager: No token available, stopping periodic check')
        return
      }

      const expiryTime = getTokenExpiry(currentToken)
      if (!expiryTime) {
        console.warn('Session Manager: Cannot determine token expiry')
        return
      }

      const now = Date.now()
      const timeUntilExpiry = expiryTime - now

      // If token is about to expire and user is active, refresh immediately
      if (timeUntilExpiry < finalConfig.refreshBeforeExpiry && timeUntilExpiry > 0) {
        // Only refresh if user is active and no refresh is in progress
        if (isUserActive() && !isRefreshingRef.current) {
          console.warn('Session Manager: Token about to expire and user is active, refreshing now')
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

      // Grace period: Only logout if token expired more than 60 seconds ago AND no refresh in progress
      // This prevents race conditions where token expires during refresh
      const GRACE_PERIOD = 60 * 1000 // 60 seconds
      if (timeUntilExpiry <= -GRACE_PERIOD && !isRefreshingRef.current) {
        console.warn('Session Manager: Token expired beyond grace period, logging out')
        logout()
        // Redirect to login page - use replace to clear any URL parameters
        if (typeof window !== 'undefined') {
          window.location.replace('/login')
        }
      } else if (timeUntilExpiry <= 0 && timeUntilExpiry > -GRACE_PERIOD) {
        // Token expired but within grace period - give refresh a chance
        if (isRefreshingRef.current) {
          console.warn('Session Manager: Token expired but refresh in progress, waiting...')
        } else if (!isUserActive()) {
          // User is inactive and token expired - logout immediately
          console.warn('Session Manager: Token expired and user inactive, logging out')
          logout()
          // Redirect to login page - use replace to clear any URL parameters
          if (typeof window !== 'undefined') {
            window.location.replace('/login')
          }
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

    console.warn('Session Manager: Starting session management')

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
