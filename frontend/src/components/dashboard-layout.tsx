'use client'

import { AppSidebar } from './app-sidebar'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/auth-store'
import { useEffect, useState } from 'react'
import { checkDevAuth, debugAuth } from '@/lib/auth-debug'

interface DashboardLayoutProps {
  children: React.ReactNode
  className?: string
}

export function DashboardLayout({ children, className }: DashboardLayoutProps) {
  const { isAuthenticated, token } = useAuthStore()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  
  // Check authentication status
  useEffect(() => {
    const initAuth = async () => {
      // Debug authentication state
      debugAuth()
      
      // For development, auto-login if no auth
      await checkDevAuth()
      
      // Give some time for auth to rehydrate
      setTimeout(() => {
        setIsLoading(false)
        
        const currentState = useAuthStore.getState()
        if (typeof window !== 'undefined' && !currentState.isAuthenticated && !currentState.token) {
          console.log('No authentication found after dev login attempt, redirecting to login')
          window.location.href = '/login'
        }
      }, 500) // Increased timeout for async login
    }
    
    initAuth()
  }, []) // Empty dependency array - only run once on mount

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <AppSidebar />
      
      {/* Main Content */}
      <div className={cn('pl-64 transition-all duration-300', className)}>
        {/* Page Content - Remove extra navigation, move content to the left */}
        <main className="pl-4 pr-6 pt-4 pb-6">
          {children}
        </main>
      </div>
    </div>
  )
}
