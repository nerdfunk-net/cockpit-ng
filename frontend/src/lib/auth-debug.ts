import { useAuthStore } from './auth-store'

// Debug utility for authentication issues
export const debugAuth = () => {
  const state = useAuthStore.getState()
  console.log('Auth Debug Info:', {
    hasToken: !!state.token,
    tokenLength: state.token?.length || 0,
    hasUser: !!state.user,
    isAuthenticated: state.isAuthenticated,
    user: state.user
  })
}

// Development login helper - performs actual login with backend
export const devLogin = async () => {
  try {
    console.log('Attempting development login with backend...')
    
    const response = await fetch('/api/proxy/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin'
      })
    })

    if (!response.ok) {
      throw new Error('Admin login failed')
    }

    const data = await response.json()
    const { login } = useAuthStore.getState()
    const user = {
      id: data.user.username,
      username: data.user.username,
      email: `${data.user.username}@demo.com`
    }
    
    // Store in localStorage (like old version)
    localStorage.setItem('auth_token', data.access_token)
    localStorage.setItem('user_info', JSON.stringify(user))
    
    // Update auth store
    login(data.access_token, user)
    console.log('Development admin login successful:', data.user)
  } catch (error) {
    console.error('Development login failed:', error)
  }
}

// Check if we need authentication and attempt login
export const checkDevAuth = async () => {
  try {
    console.log('checkDevAuth: Checking authentication state...')
    const state = useAuthStore.getState()
    
    // Check localStorage first (like the old version)
    const storedToken = localStorage.getItem('auth_token')
    const storedUser = localStorage.getItem('user_info')
    
    if (storedToken && storedUser && !state.isAuthenticated) {
      console.log('checkDevAuth: Found stored credentials, restoring auth state')
      try {
        const user = JSON.parse(storedUser)
        const { login } = useAuthStore.getState()
        login(storedToken, {
          id: user.username || user.id,
          username: user.username,
          email: user.email || `${user.username}@demo.com`
        })
        return
      } catch (error) {
        console.error('checkDevAuth: Error parsing stored user:', error)
        localStorage.removeItem('auth_token')
        localStorage.removeItem('user_info')
      }
    }
    
    // Only attempt auto-login in development mode and if explicitly enabled
    const isDevMode = process.env.NODE_ENV === 'development'
    const autoLoginEnabled = process.env.NEXT_PUBLIC_DEV_AUTO_LOGIN === 'true'
    
    // If still not authenticated, try backend login only if enabled
    if (!state.isAuthenticated && !state.token && isDevMode && autoLoginEnabled) {
      console.log('checkDevAuth: No authentication found, attempting backend login (auto-login enabled)')
      await devLogin()
    } else if (!state.isAuthenticated && !state.token) {
      console.log('checkDevAuth: No authentication found, auto-login disabled - user needs to login manually')
    } else {
      console.log('checkDevAuth: Already authenticated')
    }
  } catch (error) {
    console.error('checkDevAuth: Authentication check failed:', error)
  }
}
