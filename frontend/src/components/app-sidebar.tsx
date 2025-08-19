'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/lib/auth-store'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  LogOut,
  Menu,
  Eye,
  EyeOff,
  Heart,
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
      { label: 'Templates', href: '/settings/templates', icon: FileText },
      { label: 'Git Management', href: '/settings/git', icon: GitBranch },
      { label: 'Cache', href: '/settings/cache', icon: Zap },
      { label: 'Credentials', href: '/settings/credentials', icon: Key },
    ],
  },
]

interface AppSidebarProps {
  className?: string
}

export function AppSidebar({ className }: AppSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const { user, logout } = useAuthStore()
  const pathname = usePathname()

  const handleLogout = () => {
    logout()
    window.location.href = '/login'
  }

  const sidebarWidth = isCollapsed ? 'w-16' : 'w-64'

  return (
    <div
      className={cn(
        'fixed left-0 top-0 z-40 h-screen transition-all duration-300',
        sidebarWidth,
        isVisible ? 'translate-x-0' : '-translate-x-full',
        className
      )}
    >
      <div className="h-full bg-white/95 backdrop-blur-xl border-r border-gray-200/50 shadow-apple-lg flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <Heart className="w-5 h-5 text-white" />
              </div>
              {!isCollapsed && (
                <h1 className="text-xl font-semibold text-gray-900">Cockpit!</h1>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-8 w-8 p-0"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* User Profile */}
        {user && (
          <div className="p-4 border-b border-gray-200/50">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.username}`} />
                <AvatarFallback>
                  {user.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    Welcome, {user.username}
                  </p>
                  <p className="text-xs text-gray-500">Network Engineer</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-6">
            {navigationSections.map((section) => (
              <div key={section.title} className="px-4">
                {!isCollapsed && (
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    {section.title}
                  </h3>
                )}
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href
                    const Icon = item.icon
                    
                    return (
                      <Link key={item.href} href={item.href}>
                        <Button
                          variant={isActive ? 'default' : 'ghost'}
                          className={cn(
                            'w-full justify-start h-9 transition-all duration-200',
                            isCollapsed ? 'px-2' : 'px-3',
                            isActive
                              ? 'bg-blue-500 text-white shadow-apple hover:bg-blue-600'
                              : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                          )}
                        >
                          <Icon className={cn('h-4 w-4', isCollapsed ? '' : 'mr-3')} />
                          {!isCollapsed && (
                            <>
                              <span className="flex-1 text-left">{item.label}</span>
                              {item.badge && (
                                <Badge variant="secondary" className="text-xs">
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
        <div className="border-t border-gray-200/50 p-4">
          <div className={cn('flex', isCollapsed ? 'flex-col space-y-2' : 'space-x-2')}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsVisible(!isVisible)}
              className={cn('h-8', isCollapsed ? 'w-8 p-0' : 'flex-1')}
              title={isVisible ? 'Hide sidebar' : 'Show sidebar'}
            >
              {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {!isCollapsed && <span className="ml-2">Hide</span>}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className={cn('h-8 text-red-600 hover:text-red-700 hover:bg-red-50', isCollapsed ? 'w-8 p-0' : 'flex-1')}
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
              {!isCollapsed && <span className="ml-2">Logout</span>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
