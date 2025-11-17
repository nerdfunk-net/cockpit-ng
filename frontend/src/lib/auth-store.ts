import { create } from 'zustand'
import Cookies from 'js-cookie'

interface User {
  id: string
  username: string
  email?: string
  role?: string  // Legacy single role (for backward compatibility)
  roles?: string[]  // New RBAC roles array
  permissions?: number | Array<{ resource: string; action: string }>  // Legacy bitwise OR new RBAC permissions array
}

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
    role: user.role,
    roles: user.roles,  // Keep roles array (small)
    // Omit permissions array - too large for cookies
    // Permissions can be fetched on demand if needed
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

export const useAuthStore = create<AuthState>((set, _get) => ({
  token: null,
  user: null,
  isAuthenticated: false,

  login: (token: string, user: User) => {
    // Debug logging
    console.log('[AUTH] Login called with user:', user)
    console.log('[AUTH] User role (legacy):', user.role)
    console.log('[AUTH] User roles (RBAC array):', user.roles)
    console.log('[AUTH] User permissions count:', Array.isArray(user.permissions) ? user.permissions.length : 0)
    console.log('[AUTH] Roles is array?', Array.isArray(user.roles))
    console.log('[AUTH] Has admin in roles?', Array.isArray(user.roles) && user.roles.includes('admin'))
    
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
    // Remove cookies
    removeCookies()
    
    // Clear state
    set({
      token: null,
      user: null,
      isAuthenticated: false,
    })
  },

  setUser: (user: User) => {
    // Update user in cookies
    setCookieUser(user)
    set({ user })
  },

  hydrate: () => {
    // Load from cookies on app start
    const token = getCookieToken()
    const user = getCookieUser()
    
    console.log('[AUTH] Hydrate called')
    console.log('[AUTH] Token from cookie:', token ? 'exists' : 'missing')
    console.log('[AUTH] User from cookie:', user)
    
    if (token && user) {
      console.log('[AUTH] Hydrating with user role:', user.role)
      console.log('[AUTH] Hydrating with user roles:', user.roles)
      console.log('[AUTH] Hydrating with user permissions:', user.permissions)
      
      // Migration: If user doesn't have roles array (old cookie format), convert legacy role to roles array
      if (!user.roles && user.role) {
        console.log('[AUTH] MIGRATION: Converting legacy role to roles array')
        user.roles = [user.role]
        // Update cookie with migrated data
        setCookieUser(user)
        console.log('[AUTH] MIGRATION: Updated user with roles:', user.roles)
      }
      
      set({
        token,
        user,
        isAuthenticated: true,
      })
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
