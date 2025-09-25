'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/lib/auth-store'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSidebar } from './sidebar-context'
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
  Menu,
  Shield,
  ChevronDown,
  ChevronRight,
  LogOut,
  Activity,
  Eye,
  Minus,
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
    title: 'Nautobot',
    items: [
      { label: 'Onboard Device', href: '/onboard-device', icon: Plus },
      { label: 'Sync Devices', href: '/sync-devices', icon: RefreshCw },
      { label: 'Scan & Add', href: '/scan-and-add', icon: Search },
      { label: 'Offboarding', href: '/offboard-device', icon: Minus },
    ],
  },
  {
    title: 'CheckMK',
    items: [
      { label: 'Sync Devices', href: '/checkmk/sync-devices', icon: Shield },
      { label: 'Live Update', href: '/checkmk/live-update', icon: RefreshCw },
    ],
  },
  {
    title: 'Configs',
    items: [
      { label: 'View', href: '/configs', icon: Eye },
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
      { label: 'Jobs', href: '/settings/jobs', icon: Activity },
    ],
  },
]

interface AppSidebarProps {
  className?: string
}

export function AppSidebar({ className }: AppSidebarProps) {
  const { isCollapsed, toggleCollapsed } = useSidebar()
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const { user, logout } = useAuthStore()
  const pathname = usePathname()
  const router = useRouter()
  
  // Check if user is admin
  const isAdmin = user?.role === 'admin' || user?.permissions === 31

  const toggleSection = (sectionTitle: string) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sectionTitle)) {
        newSet.delete(sectionTitle)
      } else {
        newSet.add(sectionTitle)
      }
      return newSet
    })
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
        'translate-x-0',
        className
      )}
    >
      <div className="h-full bg-white border-r border-slate-200 shadow-analytics-lg flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            {!isCollapsed && user && (
              <div className="flex items-center space-x-3">
                <Link href="/profile">
                  <span className="text-sm font-semibold text-blue-600 hover:text-blue-700 cursor-pointer transition-colors uppercase">
                    {user.username}
                  </span>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    logout()
                    router.push('/login')
                  }}
                  className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleCollapsed}
              className="h-9 w-9 p-0 hover:bg-slate-100 button-analytics ml-auto"
            >
              <Menu className="h-5 w-5 text-slate-600" />
            </Button>
          </div>
        </div>


        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-6">
          <nav className="space-y-4">
            {visibleSections.map((section) => {
              const isSectionCollapsed = collapsedSections.has(section.title)
              
              return (
                <div key={section.title} className="px-6">
                    {!isCollapsed && (
                    <button
                      onClick={() => toggleSection(section.title)}
                      className="flex items-center justify-between w-full text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 hover:text-slate-700 transition-colors group"
                    >
                      <span>{section.title}</span>
                      {isSectionCollapsed ? (
                        <ChevronRight className="h-3 w-3 group-hover:text-slate-700 transition-colors" />
                      ) : (
                        <ChevronDown className="h-3 w-3 group-hover:text-slate-700 transition-colors" />
                      )}
                    </button>
                  )}
                  <div 
                    className={cn(
                      "space-y-1 transition-all duration-300 overflow-hidden",
                      !isCollapsed && isSectionCollapsed ? "max-h-0 opacity-0" : "max-h-none opacity-100"
                    )}
                  >
                    {section.items.map((item) => {
                      const isActive = pathname === item.href
                      const Icon = item.icon
                      
                      return (
                        <Link key={item.href} href={item.href}>
                          <Button
                            variant={isActive ? 'default' : 'ghost'}
                            className={cn(
                              'w-full justify-start h-9 transition-all duration-200 button-analytics',
                              isCollapsed ? 'px-3' : 'px-3',
                              isActive
                                ? 'bg-blue-600 text-white shadow-analytics hover:bg-blue-700'
                                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                            )}
                          >
                            <Icon className={cn('h-4 w-4', isCollapsed ? '' : 'mr-2')} />
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
              )
            })}
          </nav>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 p-6">
          {/* Copyright notice */}
          {!isCollapsed && (
            <div className="pt-4 border-t border-slate-100">
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
