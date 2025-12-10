'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/lib/auth-store'

/**
 * AuthHydration component - Hydrates auth state from cookies on app start
 * This component should be included in the root layout to ensure 
 * authentication state is properly restored from cookies.
 */
export function AuthHydration() {
  const hydrate = useAuthStore(state => state.hydrate)
  
  useEffect(() => {
    // Hydrate auth state from cookies immediately on app start
    hydrate()
  }, [hydrate])

  // This component doesn't render anything, it just handles hydration
  return null
}