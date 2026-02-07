import { create } from 'zustand'
import Cookies from 'js-cookie'
import type { User } from '@/types/auth'

interface AuthState {
  token: string | null
  user: User | null
  isAuthenticated: boolean
  login: (token: string, user: User) => void
  logout: () => void
  setUser: (user: User) => void
  hydrate: () => void
}

// Cookie configuration
const COOKIE_CONFIG = {
  expires: 1, // 1 day
  secure: process.env.NODE_ENV === 'production', // Only secure in production
  sameSite: 'strict' as const,
}

// Helper functions for cookie operations
const getCookieToken = (): string | null => {
  if (typeof window === 'undefined') return null
  return Cookies.get('cockpit_auth_token') || null
}

const getCookieUser = (): User | null => {
  if (typeof window === 'undefined') return null
  const userCookie = Cookies.get('cockpit_user_info')
  if (!userCookie) return null
  
  try {
    return JSON.parse(userCookie)
  } catch (error) {
    console.warn('Failed to parse user cookie:', error)
    return null
  }
}

const setCookieToken = (token: string) => {
  Cookies.set('cockpit_auth_token', token, COOKIE_CONFIG)
}

const setCookieUser = (user: User) => {
  // Store minimal user data in cookie to avoid size limits (4096 bytes)
  // Full permissions array can be very large, so we only store essential fields
  const minimalUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    roles: user.roles,
    // Omit permissions array - too large for cookies
    // Permissions will be fetched via token refresh on hydration
  }
  Cookies.set('cockpit_user_info', JSON.stringify(minimalUser), COOKIE_CONFIG)
}

const removeCookies = () => {
  Cookies.remove('cockpit_auth_token')
  Cookies.remove('cockpit_user_info')
  // Also clear old localStorage entries for migration
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_info')
    localStorage.removeItem('cockpit-auth')
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,

  login: (token: string, user: User) => {
    // Set cookies with minimal user data (excluding permissions to avoid size limit)
    setCookieToken(token)
    setCookieUser(user)  // This now stores only essential fields

    // Update state with full user object including permissions
    set({
      token,
      user,  // Store full user object in memory
      isAuthenticated: true,
    })
  },

  logout: () => {
    // Call backend logout endpoint to log the event (fire and forget)
    const token = getCookieToken()
    if (token) {
      fetch('/api/proxy/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }).catch((error) => {
        // Silently ignore errors - logout should always work client-side
        console.warn('Failed to log logout event:', error)
      })
    }

    // Remove cookies
    removeCookies()

    // Clear OIDC-related sessionStorage to prevent stale state
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('oidc_state')
      sessionStorage.removeItem('oidc_provider_id')
      sessionStorage.removeItem('last_login_data')
    }

    // Clear state
    set({
      token: null,
      user: null,
      isAuthenticated: false,
    })
  },

  setUser: (user: User) => {
    // Update user in cookies (minimal data only)
    setCookieUser(user)
    // Update state with full user object
    set({ user })
  },

  hydrate: async () => {
    // Load from cookies on app start
    const token = getCookieToken()
    const user = getCookieUser()

    if (token && user) {
      // Set initial state with cookie data (no permissions)
      set({
        token,
        user,
        isAuthenticated: true,
      })

      // Fetch fresh user data with permissions via token refresh
      try {
        // Use Next.js API proxy to call backend
        const response = await fetch('/api/proxy/auth/refresh', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })

        if (response.ok) {
          const data = await response.json()

          // Update state with fresh user data including permissions
          set({
            token: data.access_token,
            user: data.user,
            isAuthenticated: true,
          })

          // Update cookies with new token
          setCookieToken(data.access_token)
        }
      } catch (error) {
        // Silently continue with cookie data if refresh fails
        console.error('Token refresh failed:', error)
      }
    } else {
      // Clean up any partial data
      removeCookies()
      set({
        token: null,
        user: null,
        isAuthenticated: false,
      })
    }
  },
}))
