import { create } from 'zustand'
import Cookies from 'js-cookie'

interface User {
  id: string
  username: string
  email?: string
  role?: string
  permissions?: number
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
  Cookies.set('cockpit_user_info', JSON.stringify(user), COOKIE_CONFIG)
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
    // Set cookies
    setCookieToken(token)
    setCookieUser(user)
    
    // Update state
    set({
      token,
      user,
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
    
    if (token && user) {
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
