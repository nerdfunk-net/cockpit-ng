'use client'

import { AppSidebar } from './app-sidebar'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/auth-store'
import { useEffect, useState } from 'react'
import { SidebarProvider, useSidebar } from './sidebar-context'
import { useSessionManager } from '@/hooks/use-session-manager'

interface DashboardLayoutProps {
  children: React.ReactNode
  className?: string
}

function DashboardLayoutInner({ children, className }: DashboardLayoutProps) {
  const { isAuthenticated, token } = useAuthStore()
  const { isCollapsed } = useSidebar()
  const [isLoading, setIsLoading] = useState(true)
  
  // Initialize session management for automatic token renewal
  useSessionManager({
    refreshBeforeExpiry: 2 * 60 * 1000, // Refresh 2 minutes before expiry
    activityTimeout: 15 * 60 * 1000,    // Consider user inactive after 15 minutes
    checkInterval: 30 * 1000,           // Check every 30 seconds
  })
  
  // Check authentication status
  useEffect(() => {
    const initAuth = async () => {

      // For development, auto-login if no auth (disabled for testing)
      // await checkDevAuth()

      // Give some time for auth to rehydrate
      setTimeout(() => {
        setIsLoading(false)

        const currentState = useAuthStore.getState()

        if (typeof window !== 'undefined' && !currentState.isAuthenticated && !currentState.token) {
          window.location.href = '/login'
        }
      }, 500) // Increased timeout for async login
    }

    initAuth()
  }, []) // Empty dependency array - only run once on mount

  // Monitor auth state changes and redirect if logged out
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !token) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }
  }, [isAuthenticated, token, isLoading])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-500 border-t-transparent mx-auto" />
          <p className="text-slate-600 font-medium">Loading Cockpit Dashboard...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-500 border-t-transparent mx-auto" />
          <p className="text-slate-600 font-medium">Authenticating...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppSidebar />
      
      {/* Main Content */}
      <div className={cn(
        'transition-all duration-300', 
        isCollapsed ? 'pl-16' : 'pl-64',
        className
      )}>
        {/* Page Content - Cockpit Dashboard Style */}
        <main className="px-6 py-6">
          <div className="fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export function DashboardLayout({ children, className }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <DashboardLayoutInner className={className}>
        {children}
      </DashboardLayoutInner>
    </SidebarProvider>
  )
}
