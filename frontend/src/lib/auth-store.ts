import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface User {
  id: string
  username: string
  email?: string
}

interface AuthState {
  token: string | null
  user: User | null
  isAuthenticated: boolean
  login: (token: string, user: User) => void
  logout: () => void
  setUser: (user: User) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      login: (token: string, user: User) =>
        set({
          token,
          user,
          isAuthenticated: true,
        }),
      logout: () => {
        // Clear localStorage (like old version)
        localStorage.removeItem('auth_token')
        localStorage.removeItem('user_info')
        
        set({
          token: null,
          user: null,
          isAuthenticated: false,
        })
      },
      setUser: (user: User) => set({ user }),
    }),
    {
      name: 'cockpit-auth',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        // Ensure isAuthenticated is set correctly based on token presence
        if (state) {
          if (state.token && state.user) {
            state.isAuthenticated = true
          } else {
            state.isAuthenticated = false
          }
        }
      },
    }
  )
)
