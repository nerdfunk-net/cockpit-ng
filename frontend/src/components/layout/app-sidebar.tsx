'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/lib/auth-store'
import { hasPermission } from '@/lib/permissions'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSidebar } from './sidebar-context'
import {
  Home,
  Plus,
  RefreshCw,
  Save,
  List,
  Database,
  FileText,
  GitBranch,
  Zap,
  Key,
  Menu,
  Shield,
  ChevronDown,
  ChevronRight,
  LogOut,
  Eye,
  Minus,
  Terminal,
  CheckCircle,
  Search,
  Wrench,
  Server,
  Calendar,
  History,
  Download,
  Wifi,
  Plug,
  Settings,
  BarChart3,
  Edit,
  HelpCircle,
  Camera,
  FileSpreadsheet,
  GitCommit,
  ArrowLeftRight,
} from 'lucide-react'

interface NavItem {
  label: string
  href?: string  // Optional when item has children
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  children?: NavItem[]  // Support for nested menu items
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
      { label: 'Inventory', href: '/inventory', icon: List },
    ],
  },
  {
    title: 'Nautobot',
    items: [
      { label: 'Add Device', href: '/nautobot-add-device', icon: Plus },
      { label: 'Onboard Device', href: '/onboard-device', icon: Plus },
      { label: 'Sync Devices', href: '/sync-devices', icon: RefreshCw },
      { label: 'Offboarding', href: '/offboard-device', icon: Minus },
      {
        label: 'Tools',
        icon: Wrench,
        children: [
          { label: 'Check IP & Names', href: '/nautobot/tools/check-ip', icon: Search },
          { label: 'Bulk Edit', href: '/nautobot/tools/bulk-edit', icon: Edit },
          { label: 'CSV Updates', href: '/nautobot/tools/csv-updates', icon: FileSpreadsheet },
        ],
      },
      { label: 'Export', href: '/nautobot-export', icon: Download },
    ],
  },
  {
    title: 'CheckMK',
    items: [
      { label: 'Sync Devices', href: '/checkmk/sync-devices', icon: RefreshCw },
      { label: 'Diff Viewer', href: '/checkmk/diff-viewer', icon: ArrowLeftRight },
      { label: 'Hosts & Inventory', href: '/checkmk/hosts-inventory', icon: Server },
      { label: 'Tools', href: '/checkmk/tools', icon: Wrench },
    ],
  },
  {
    title: 'Agents',
    items: [
      { label: 'Deploy', href: '/agents/deploy', icon: GitCommit },
      { label: 'Templates', href: '/agents/templates', icon: FileText },
    ],
  },
  {
    title: 'Network',
    items: [
      {
        label: 'Configs',
        icon: FileText,
        children: [
          { label: 'View', href: '/configs', icon: Eye },
          { label: 'Backup', href: '/backup', icon: Save },
        ],
      },
      {
        label: 'Automation',
        icon: Zap,
        children: [
          { label: 'Netmiko', href: '/netmiko', icon: Terminal },
          { label: 'Templates', href: '/automation/templates', icon: FileText },
          { label: 'Snapshots', href: '/network/snapshots', icon: Camera },
        ],
      },
      {
        label: 'Tools',
        icon: Wrench,
        children: [
          { label: 'Ping', href: '/tools/ping', icon: Wifi },
        ],
      },
      { label: 'Compliance Check', href: '/compliance', icon: CheckCircle },
    ],
  },
  {
    title: 'Jobs',
    items: [
      { label: 'Job Templates', href: '/jobs/templates', icon: FileText },
      { label: 'Scheduler', href: '/jobs/scheduler', icon: Calendar },
      { label: 'View', href: '/jobs/view', icon: History },
    ],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Common', href: '/settings/common', icon: Settings },
      {
        label: 'Connections',
        icon: Plug,
        children: [
          { label: 'Nautobot', href: '/settings/nautobot', icon: Database },
          { label: 'CheckMK', href: '/settings/checkmk', icon: Shield },
          { label: 'Agents', href: '/settings/agents', icon: BarChart3 },
        ],
      },
      { label: 'Compliance', href: '/settings/compliance', icon: CheckCircle },
      { label: 'Templates', href: '/settings/templates', icon: FileText },
      { label: 'Git Management', href: '/settings/git', icon: GitBranch },
      { label: 'Cache', href: '/settings/cache', icon: Zap },
      { label: 'Celery', href: '/settings/celery', icon: Server },
      { label: 'Credentials', href: '/settings/credentials', icon: Key },
      { label: 'Users & Permissions', href: '/settings/permissions', icon: Shield },
    ],
  },
]

interface AppSidebarProps {
  className?: string
}

export function AppSidebar({ className }: AppSidebarProps) {
  const {
    isCollapsed,
    toggleCollapsed,
    collapsedSections,
    setCollapsedSections,
    collapsedItems,
    setCollapsedItems
  } = useSidebar()
  const { user, logout } = useAuthStore()
  const pathname = usePathname()
  const router = useRouter()

  // Check if user has permission to view Settings
  const canViewSettings = hasPermission(user, 'dashboard.settings', 'read')

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

  const toggleItem = (itemKey: string) => {
    setCollapsedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemKey)) {
        newSet.delete(itemKey)
      } else {
        newSet.add(itemKey)
      }
      return newSet
    })
  }

  const sidebarWidth = isCollapsed ? 'w-16' : 'w-64'

  // Filter navigation sections based on user permissions
  const visibleSections = navigationSections.filter(section => {
    // Hide Settings section for users without dashboard.settings:read permission
    if (section.title === 'Settings' && !canViewSettings) {
      return false
    }
    return true
  })

  // Helper function to check if any child is active
  const hasActiveChild = (item: NavItem): boolean => {
    if (item.href && pathname === item.href) return true
    if (item.children) {
      return item.children.some(child => hasActiveChild(child))
    }
    return false
  }

  // Recursive component to render menu items with collapsible submenus
  const renderMenuItem = (item: NavItem, sectionTitle: string, depth: number = 0) => {
    const itemKey = `${sectionTitle}-${item.label}`
    const isItemCollapsed = collapsedItems.has(itemKey)
    const hasChildren = item.children && item.children.length > 0
    const isActive = item.href ? pathname === item.href : hasActiveChild(item)
    const Icon = item.icon
    const paddingLeft = depth > 0 ? `${12 + depth * 16}px` : '12px'

    if (hasChildren) {
      // Item with submenu - clickable to collapse/expand
      return (
        <div key={itemKey}>
          <Button
            variant="ghost"
            onClick={() => toggleItem(itemKey)}
            style={{ paddingLeft }}
            className="w-full justify-start h-9 transition-all duration-200 button-analytics pr-3 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
          >
            <Icon className={cn('h-4 w-4', isCollapsed ? '' : 'mr-2')} />
            {!isCollapsed && (
              <>
                <span className="flex-1 text-left font-medium">{item.label}</span>
                {isItemCollapsed ? (
                  <ChevronRight className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </>
            )}
          </Button>
          {!isCollapsed && !isItemCollapsed && item.children && (
            <div className="mt-1 space-y-1">
              {item.children.map(child => renderMenuItem(child, sectionTitle, depth + 1))}
            </div>
          )}
        </div>
      )
    } else {
      // Regular item with link
      return (
        <Link key={itemKey} href={item.href || '#'}>
          <Button
            variant={isActive ? 'default' : 'ghost'}
            style={{ paddingLeft }}
            className={cn(
              'w-full justify-start h-9 transition-all duration-200 button-analytics pr-3',
              isActive
                ? 'bg-blue-600 text-white shadow-analytics hover:bg-blue-700'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            )}
          >
            <Icon className={cn('h-4 w-4', isCollapsed ? '' : 'mr-2')} />
            {!isCollapsed && (
              <>
                <span className="flex-1 text-left font-medium">{item.label}</span>
                {item.badge && (
                  <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-600">
                    {item.badge}
                  </Badge>
                )}
              </>
            )}
          </Button>
        </Link>
      )
    }
  }

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
                  onClick={() => router.push('/help')}
                  className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
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
                    {section.items.map((item) => renderMenuItem(item, section.title))}
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
                © 2026 Cockpit Dashboard
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
