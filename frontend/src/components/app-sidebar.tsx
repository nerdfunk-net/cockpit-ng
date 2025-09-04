'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { generateAvatarDataUrl } from '@/components/ui/local-avatar'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/lib/auth-store'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSidebar } from './sidebar-context'
import { SessionStatus } from './session-status'
import {
  Home,
  Plus,
  RefreshCw,
  Search,
  Save,
  GitCompare,
  List,
  Database,
  FileText,
  GitBranch,
  Zap,
  Key,
  Users,
  LogOut,
  Menu,
  Eye,
  EyeOff,
  Heart,
  Shield,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

interface NavSection {
  title: string
  items: NavItem[]
}

const navigationSections: NavSection[] = [
  {
    title: 'General',
    items: [
      { label: 'Home', href: '/', icon: Home },
    ],
  },
  {
    title: 'Onboarding',
    items: [
      { label: 'Onboard Device', href: '/onboard-device', icon: Plus },
      { label: 'Sync Devices', href: '/sync-devices', icon: RefreshCw },
      { label: 'Scan & Add', href: '/scan-and-add', icon: Search },
    ],
  },
  {
    title: 'Configs',
    items: [
      { label: 'Backup', href: '/backup', icon: Save },
      { label: 'Compare', href: '/compare', icon: GitCompare },
    ],
  },
  {
    title: 'Ansible',
    items: [
      { label: 'Inventory', href: '/ansible-inventory', icon: List },
    ],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Nautobot', href: '/settings/nautobot', icon: Database },
      { label: 'CheckMK', href: '/settings/checkmk', icon: Shield },
      { label: 'Templates', href: '/settings/templates', icon: FileText },
      { label: 'Git Management', href: '/settings/git', icon: GitBranch },
      { label: 'Cache', href: '/settings/cache', icon: Zap },
      { label: 'Credentials', href: '/settings/credentials', icon: Key },
      { label: 'User Management', href: '/settings/users', icon: Users },
    ],
  },
]

interface AppSidebarProps {
  className?: string
}

export function AppSidebar({ className }: AppSidebarProps) {
  const { isCollapsed, toggleCollapsed } = useSidebar()
  const [isVisible, setIsVisible] = useState(true)
  const { user, logout } = useAuthStore()
  const pathname = usePathname()
  
  // Check if user is admin
  const isAdmin = user?.role === 'admin' || user?.permissions === 31

  const handleLogout = () => {
    logout()
    window.location.href = '/login'
  }

  const sidebarWidth = isCollapsed ? 'w-16' : 'w-64'
  
  // Filter navigation sections based on user role
  const visibleSections = navigationSections.filter(section => {
    // Hide Settings section for non-admin users
    if (section.title === 'Settings' && !isAdmin) {
      return false
    }
    return true
  })

  return (
    <div
      className={cn(
        'fixed left-0 top-0 z-40 h-screen transition-all duration-300',
        sidebarWidth,
        isVisible ? 'translate-x-0' : '-translate-x-full',
        className
      )}
    >
      <div className="h-full bg-white border-r border-slate-200 shadow-analytics-lg flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-analytics">
                <Heart className="w-6 h-6 text-white" />
              </div>
              {!isCollapsed && (
                <div>
                  <h1 className="text-xl font-bold text-slate-900">Analytics</h1>
                  <p className="text-xs text-slate-500">Network Dashboard</p>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleCollapsed}
              className="h-9 w-9 p-0 hover:bg-slate-100 button-analytics"
            >
              <Menu className="h-5 w-5 text-slate-600" />
            </Button>
          </div>
        </div>

        {/* User Profile */}
        {user && (
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center space-x-3">
              <Link href="/profile">
                <Avatar className="h-12 w-12 ring-2 ring-blue-100 hover:ring-blue-300 cursor-pointer transition-all">
                  <AvatarImage 
                    src={generateAvatarDataUrl(user.username, 48)}
                    onError={(e) => {
                      // If local generation fails, hide the image and show fallback
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">
                    {user.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Link>
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <Link href="/profile">
                    <p className="text-sm font-semibold text-slate-900 truncate hover:text-blue-600 cursor-pointer transition-colors">
                      {user.username}
                    </p>
                  </Link>
                  <div className="flex items-center space-x-2">
                    <p className="text-xs text-slate-500">Network Engineer</p>
                    {user.role === 'admin' && (
                      <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                        Admin
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center space-x-1 mt-1">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                    <span className="text-xs text-emerald-600 font-medium">Online</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-6">
          <nav className="space-y-8">
            {visibleSections.map((section) => (
              <div key={section.title} className="px-6">
                {!isCollapsed && (
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
                    {section.title}
                  </h3>
                )}
                <div className="space-y-2">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href
                    const Icon = item.icon
                    
                    return (
                      <Link key={item.href} href={item.href}>
                        <Button
                          variant={isActive ? 'default' : 'ghost'}
                          className={cn(
                            'w-full justify-start h-11 transition-all duration-200 button-analytics',
                            isCollapsed ? 'px-3' : 'px-4',
                            isActive
                              ? 'bg-blue-600 text-white shadow-analytics hover:bg-blue-700'
                              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                          )}
                        >
                          <Icon className={cn('h-5 w-5', isCollapsed ? '' : 'mr-3')} />
                          {!isCollapsed && (
                            <>
                              <span key="nav-label" className="flex-1 text-left font-medium">{item.label}</span>
                              {item.badge && (
                                <Badge key="nav-badge" variant="secondary" className="text-xs bg-slate-100 text-slate-600">
                                  {item.badge}
                                </Badge>
                              )}
                            </>
                          )}
                        </Button>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 p-6">
          {/* Session Status */}
          {!isCollapsed && (
            <div className="mb-4">
              <SessionStatus showDetails={false} />
            </div>
          )}
          
          <div className={cn('flex', isCollapsed ? 'flex-col space-y-2' : 'space-x-2')}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsVisible(!isVisible)}
              className={cn('h-10 button-analytics hover:bg-slate-100', isCollapsed ? 'w-10 p-0' : 'flex-1')}
              title={isVisible ? 'Hide sidebar' : 'Show sidebar'}
            >
              {isVisible ? <EyeOff className="h-4 w-4 text-slate-600" /> : <Eye className="h-4 w-4 text-slate-600" />}
              {!isCollapsed && <span className="ml-2 text-slate-700 font-medium">Hide</span>}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className={cn('h-10 text-red-600 hover:text-red-700 hover:bg-red-50 button-analytics', isCollapsed ? 'w-10 p-0' : 'flex-1')}
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
              {!isCollapsed && <span className="ml-2 font-medium">Logout</span>}
            </Button>
          </div>
          {/* Copyright notice */}
          {!isCollapsed && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-400 text-center leading-relaxed">
                © 2025 Analytics Dashboard
                <br />
                <span className="text-slate-300">Network Management</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
