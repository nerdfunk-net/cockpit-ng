'use client'

import { AppSidebar } from './app-sidebar'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/auth-store'
import { useEffect, useState } from 'react'

interface DashboardLayoutProps {
  children: React.ReactNode
  className?: string
}

export function DashboardLayout({ children, className }: DashboardLayoutProps) {
  const { isAuthenticated } = useAuthStore()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  
  // Check authentication status
  useEffect(() => {
    if (typeof window !== 'undefined' && !isAuthenticated) {
      const token = localStorage.getItem('cockpit-auth')
      if (!token) {
        window.location.href = '/login'
        return
      }
    }
  }, [isAuthenticated])

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
