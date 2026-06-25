import { create } from 'zustand'
import Cookies from 'js-cookie'
import type { User } from '@/types/auth'

interface AuthState {
  // Always null — token lives in a server-set httpOnly cookie and is never exposed to JS
  token: string | null
  user: User | null
  isAuthenticated: boolean
  login: (user: User) => void
  logout: () => void
  setUser: (user: User) => void
  hydrate: () => Promise<void>
}

const USER_COOKIE = 'cockpit_user_info'
const USER_COOKIE_CONFIG = {
  expires: 1,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
}

const setCookieUser = (user: User) => {
  const minimalUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    roles: user.roles,
  }
  Cookies.set(USER_COOKIE, JSON.stringify(minimalUser), USER_COOKIE_CONFIG)
}

const removeCookies = () => {
  Cookies.remove(USER_COOKIE)
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_info')
    localStorage.removeItem('cockpit-auth')
  }
}

export const useAuthStore = create<AuthState>(set => ({
  token: null,
  user: null,
  isAuthenticated: false,

  login: (user: User) => {
    setCookieUser(user)
    set({ token: null, user, isAuthenticated: true })
  },

  logout: () => {
    fetch('/api/auth/logout', { method: 'POST' }).catch(error => {
      console.warn('Failed to call logout endpoint:', error)
    })

    removeCookies()

    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('oidc_state')
      sessionStorage.removeItem('oidc_provider_id')
      sessionStorage.removeItem('last_login_data')
    }

    set({ token: null, user: null, isAuthenticated: false })
  },

  setUser: (user: User) => {
    setCookieUser(user)
    set({ user })
  },

  hydrate: async () => {
    try {
      const response = await fetch('/api/auth/refresh', { method: 'POST' })
      if (response.ok) {
        const data = await response.json()
        if (data.user) {
          setCookieUser(data.user)
          set({ token: null, user: data.user, isAuthenticated: true })
        }
      } else {
        removeCookies()
        set({ token: null, user: null, isAuthenticated: false })
      }
    } catch (error) {
      console.error('Token refresh failed:', error)
      set({ token: null, user: null, isAuthenticated: false })
    }
  },
}))
