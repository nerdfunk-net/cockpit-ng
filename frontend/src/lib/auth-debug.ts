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
      // Try guest login as fallback
      console.log('Admin login failed, trying guest login...')
      const guestResponse = await fetch('/api/proxy/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'guest',
          password: 'guest'
        })
      })

      if (!guestResponse.ok) {
        throw new Error('Both admin and guest login failed')
      }

      const guestData = await guestResponse.json()
      const { login } = useAuthStore.getState()
      const user = {
        id: guestData.user.username,
        username: guestData.user.username,
        email: `${guestData.user.username}@demo.com`
      }
      
      // Store in localStorage (like old version)
      localStorage.setItem('auth_token', guestData.access_token)
      localStorage.setItem('user_info', JSON.stringify(user))
      
      // Update auth store
      login(guestData.access_token, user)
      console.log('Development guest login successful:', guestData.user)
      return
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
    
    // If still not authenticated, try backend login
    if (!state.isAuthenticated && !state.token) {
      console.log('checkDevAuth: No authentication found, attempting backend login')
      await devLogin()
    } else {
      console.log('checkDevAuth: Already authenticated')
    }
  } catch (error) {
    console.error('checkDevAuth: Authentication check failed:', error)
  }
}
