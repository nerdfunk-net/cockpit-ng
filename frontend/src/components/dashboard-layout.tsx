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
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-gray-200/50 shadow-apple">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              {/* Breadcrumb will be handled by individual pages */}
              <div className="flex items-center space-x-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Network Management Dashboard
                </h2>
              </div>
              
              {/* Quick Actions */}
              <div className="flex items-center space-x-2">
                {/* Theme toggle, notifications, etc. can be added here */}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="mt-auto border-t border-gray-200/50 bg-white/50 py-6">
          <div className="px-6">
            <p className="text-sm text-gray-500">
              © 2025 Cockpit Network Management Dashboard
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
